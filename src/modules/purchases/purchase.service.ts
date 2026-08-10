import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { writeAuditLog } from "../../shared/audit/audit.js";
import { retrySerializable } from "../../shared/database/retry.js";
import { SERIALIZABLE_TRANSACTION_OPTIONS } from "../../shared/database/transaction.js";
import { errors } from "../../shared/errors/app-error.js";
import { publishDomainEvent } from "../../shared/queue/domain-events.js";
import { invoiceStatus } from "../../shared/utils/decimal.js";
import { createReference } from "../../shared/utils/reference.js";
import type { CreatePurchaseInput } from "./purchase.schemas.js";

export async function createPurchase(input: CreatePurchaseInput, shopId: string, actorId: string) {
  const created = await retrySerializable(() =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${input.customerId} FOR UPDATE`;
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, shopId, status: "ACTIVE", deletedAt: null }
      });
      if (!customer) throw errors.badRequest("CUSTOMER_INACTIVE", "Customer is missing or inactive");

      const productIds = [...new Set(input.items.flatMap((item) => (item.productId ? [item.productId] : [])))];
      const products = productIds.length
        ? await tx.product.findMany({ where: { id: { in: productIds }, shopId, deletedAt: null } })
        : [];
      const productMap = new Map(products.map((product) => [product.id, product]));
      if (products.length !== productIds.length) {
        throw errors.badRequest("PRODUCT_NOT_FOUND", "One or more products do not exist");
      }

      let subtotal = new Prisma.Decimal(0);
      let itemDiscountTotal = new Prisma.Decimal(0);
      const normalizedItems = input.items.map((item) => {
        const product = item.productId ? productMap.get(item.productId) : undefined;
        if (product && !product.isActive) {
          throw errors.badRequest("PRODUCT_INACTIVE", `Product ${product.name} is inactive`);
        }

        const quantity = new Prisma.Decimal(item.quantity);
        const unitPrice = item.unitPrice
          ? new Prisma.Decimal(item.unitPrice)
          : product?.defaultPrice;
        if (!unitPrice) throw errors.badRequest("UNIT_PRICE_REQUIRED", "Unit price is required");
        if (quantity.lte(0) || unitPrice.lt(0)) {
          throw errors.badRequest("INVALID_ITEM_VALUE", "Quantity must be positive and price cannot be negative");
        }

        const lineBase = quantity.mul(unitPrice).toDecimalPlaces(2);
        const itemDiscount = new Prisma.Decimal(item.discount);
        if (itemDiscount.lt(0) || itemDiscount.gt(lineBase)) {
          throw errors.badRequest("INVALID_ITEM_DISCOUNT", "Item discount cannot exceed its gross amount");
        }
        const lineTotal = lineBase.minus(itemDiscount).toDecimalPlaces(2);
        subtotal = subtotal.plus(lineBase);
        itemDiscountTotal = itemDiscountTotal.plus(itemDiscount);

        return {
          productId: product?.id,
          nameSnapshot: product?.name ?? item.name!,
          unitSnapshot: product?.unit ?? item.unit!,
          quantity,
          unitPrice,
          discount: itemDiscount,
          lineTotal,
          note: item.note
        };
      });

      const orderDiscount = new Prisma.Decimal(input.discount);
      if (orderDiscount.lt(0)) throw errors.badRequest("INVALID_DISCOUNT", "Discount cannot be negative");
      const netAmount = subtotal.minus(itemDiscountTotal).minus(orderDiscount).toDecimalPlaces(2);
      if (netAmount.lte(0)) {
        throw errors.badRequest("INVALID_PURCHASE_TOTAL", "Purchase total must be greater than zero");
      }

      const initialPaid = new Prisma.Decimal(input.initialPayment?.amount ?? "0");
      if (initialPaid.gt(netAmount)) {
        throw errors.badRequest("INITIAL_PAYMENT_TOO_LARGE", "Initial payment cannot exceed this invoice total");
      }

      const previousBalance = customer.currentBalance;
      const resultingBalance = previousBalance.plus(netAmount).minus(initialPaid);
      if (customer.creditLimit.gt(0) && resultingBalance.gt(customer.creditLimit)) {
        throw errors.badRequest("CREDIT_LIMIT_EXCEEDED", "This purchase would exceed the customer credit limit");
      }

      const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : new Date();
      const purchase = await tx.purchase.create({
        data: {
          shopId,
          purchaseNumber: createReference("PUR", purchaseDate),
          customerId: customer.id,
          purchaseDate,
          subtotal,
          discount: itemDiscountTotal.plus(orderDiscount),
          netAmount,
          previousBalanceSnapshot: previousBalance,
          initialPaidAmount: initialPaid,
          resultingBalanceSnapshot: resultingBalance,
          notes: input.notes,
          status: "CONFIRMED",
          createdById: actorId,
          items: { create: normalizedItems }
        }
      });

      const invoice = await tx.invoice.create({
        data: {
          shopId,
          invoiceNumber: createReference("INV", purchaseDate),
          purchaseId: purchase.id,
          customerId: customer.id,
          invoiceDate: purchaseDate,
          subtotal,
          discount: itemDiscountTotal.plus(orderDiscount),
          previousDueSnapshot: previousBalance,
          grandTotal: netAmount,
          paidAmount: initialPaid,
          currentDue: netAmount.minus(initialPaid),
          status: invoiceStatus(netAmount, initialPaid),
          customerSnapshot: {
            customerCode: customer.customerCode,
            name: customer.name,
            phone: customer.phone,
            businessName: customer.businessName,
            address: customer.address,
            area: customer.area,
            district: customer.district
          },
          createdById: actorId
        }
      });

      let runningBalance = previousBalance.plus(netAmount);
      await tx.customerLedgerEntry.create({
        data: {
          shopId,
          customerId: customer.id,
          entryDate: purchaseDate,
          type: "PURCHASE",
          debit: netAmount,
          balanceAfter: runningBalance,
          sourceType: "PURCHASE",
          sourceId: purchase.id,
          description: `Purchase ${purchase.purchaseNumber}`,
          createdById: actorId
        }
      });

      let payment = null;
      if (input.initialPayment && initialPaid.gt(0)) {
        payment = await tx.payment.create({
          data: {
            shopId,
            receiptNumber: createReference("RCT", purchaseDate),
            customerId: customer.id,
            paymentDate: purchaseDate,
            amount: initialPaid,
            method: input.initialPayment.method,
            reference: input.initialPayment.reference,
            note: input.initialPayment.note,
            collectedById: actorId,
            allocations: { create: { invoiceId: invoice.id, amount: initialPaid } }
          }
        });
        runningBalance = runningBalance.minus(initialPaid);
        await tx.customerLedgerEntry.create({
          data: {
            shopId,
            customerId: customer.id,
            entryDate: purchaseDate,
            type: "PAYMENT",
            credit: initialPaid,
            balanceAfter: runningBalance,
            sourceType: "PAYMENT",
            sourceId: payment.id,
            description: `Initial payment ${payment.receiptNumber}`,
            createdById: actorId
          }
        });
      }

      let delivery = null;
      if (input.delivery) {
        delivery = await tx.delivery.create({
          data: {
            shopId,
            deliveryNumber: createReference("DLV", purchaseDate),
            purchaseId: purchase.id,
            invoiceId: invoice.id,
            customerId: customer.id,
            addressSnapshot: input.delivery.address,
            contactSnapshot: input.delivery.contact,
            scheduledAt: input.delivery.scheduledAt ? new Date(input.delivery.scheduledAt) : null,
            transportCharge: new Prisma.Decimal(input.delivery.transportCharge),
            notes: input.delivery.notes,
            history: {
              create: { toStatus: "PENDING", actorId, note: "Delivery created with purchase" }
            }
          }
        });
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: { currentBalance: resultingBalance }
      });
      await writeAuditLog({
        shopId,
        actorId,
        action: "purchase.create",
        entityType: "Purchase",
        entityId: purchase.id,
        metadata: {
          purchaseNumber: purchase.purchaseNumber,
          invoiceId: invoice.id,
          customerId: customer.id,
          netAmount: netAmount.toString(),
          initialPaid: initialPaid.toString()
        }
      }, tx);

      return { purchase, invoice, payment, delivery, resultingBalance };
    }, SERIALIZABLE_TRANSACTION_OPTIONS)
  );

  await publishDomainEvent("purchase.created", {
    eventId: createReference("EVT"),
    purchaseId: created.purchase.id,
    invoiceId: created.invoice.id,
    customerId: created.purchase.customerId
  });

  return getPurchase(created.purchase.id, shopId);
}

export async function getPurchase(id: string, shopId: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, shopId },
    include: {
      customer: true,
      items: true,
      invoice: { include: { allocations: { include: { payment: true } } } },
      delivery: { include: { driver: true, vehicle: true, history: true } }
    }
  });
  if (!purchase) throw errors.notFound("Purchase");
  return purchase;
}

export async function listPurchases(
  shopId: string,
  input: {
    page: number;
    limit: number;
    customerId?: string;
    status?: "DRAFT" | "CONFIRMED" | "VOIDED";
    from?: string;
    to?: string;
  }
) {
  const where: Prisma.PurchaseWhereInput = {
    shopId,
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.from || input.to
      ? {
          purchaseDate: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lte: new Date(input.to) } : {})
          }
        }
      : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.purchase.findMany({
      where,
      include: { customer: true, invoice: true, delivery: true },
      orderBy: { purchaseDate: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit
    }),
    prisma.purchase.count({ where })
  ]);
  return { items, total, page: input.page, limit: input.limit, pages: Math.ceil(total / input.limit) };
}
