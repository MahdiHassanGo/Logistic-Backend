import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { writeAuditLog } from "../../shared/audit/audit.js";
import { retrySerializable } from "../../shared/database/retry.js";
import { SERIALIZABLE_TRANSACTION_OPTIONS } from "../../shared/database/transaction.js";
import { errors } from "../../shared/errors/app-error.js";
import { publishDomainEvent } from "../../shared/queue/domain-events.js";
import { invoiceStatus } from "../../shared/utils/decimal.js";
import { createReference } from "../../shared/utils/reference.js";
import type { CreatePaymentInput } from "./payment.schemas.js";

interface AllocationPlan {
  invoiceId: string;
  amount: Prisma.Decimal;
  invoice: {
    id: string;
    grandTotal: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    currentDue: Prisma.Decimal;
  };
}

export async function createPayment(input: CreatePaymentInput, shopId: string, actorId: string) {
  const created = await retrySerializable(() =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${input.customerId} FOR UPDATE`;
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, shopId, status: "ACTIVE", deletedAt: null }
      });
      if (!customer) throw errors.badRequest("CUSTOMER_INACTIVE", "Customer is missing or inactive");

      const amount = new Prisma.Decimal(input.amount);
      if (amount.lte(0)) throw errors.badRequest("INVALID_PAYMENT_AMOUNT", "Payment must be greater than zero");
      if (amount.gt(customer.currentBalance)) {
        throw errors.badRequest("PAYMENT_EXCEEDS_BALANCE", "Payment cannot exceed the customer's current balance");
      }

      let allocationPlan: AllocationPlan[] = [];

      if (input.allocations) {
        const duplicateIds = input.allocations
          .map((item) => item.invoiceId)
          .filter((id, index, all) => all.indexOf(id) !== index);
        if (duplicateIds.length) {
          throw errors.badRequest("DUPLICATE_ALLOCATION", "An invoice can appear only once in allocations");
        }

        const invoiceIds = input.allocations.map((item) => item.invoiceId);
        for (const invoiceId of invoiceIds) {
          await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
        }
        const invoices = await tx.invoice.findMany({
          where: { id: { in: invoiceIds }, customerId: customer.id, shopId, status: { not: "VOIDED" } }
        });
        if (invoices.length !== invoiceIds.length) {
          throw errors.badRequest("INVALID_PAYMENT_ALLOCATION", "One or more invoices are invalid for this customer");
        }
        const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
        allocationPlan = input.allocations.map((allocation) => {
          const invoice = invoiceMap.get(allocation.invoiceId)!;
          const allocationAmount = new Prisma.Decimal(allocation.amount);
          if (allocationAmount.lte(0) || allocationAmount.gt(invoice.currentDue)) {
            throw errors.badRequest(
              "PAYMENT_ALLOCATION_CONFLICT",
              `Allocation exceeds the current due for invoice ${invoice.invoiceNumber}`
            );
          }
          return { invoiceId: invoice.id, amount: allocationAmount, invoice };
        });

        const allocated = allocationPlan.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0)
        );
        if (!allocated.equals(amount)) {
          throw errors.badRequest("ALLOCATION_TOTAL_MISMATCH", "Allocation total must equal payment amount");
        }
      } else {
        const outstanding = await tx.invoice.findMany({
          where: { customerId: customer.id, shopId, currentDue: { gt: 0 }, status: { not: "VOIDED" } },
          orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }]
        });
        let remaining = amount;
        for (const invoice of outstanding) {
          if (remaining.lte(0)) break;
          await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoice.id} FOR UPDATE`;
          const allocationAmount = Prisma.Decimal.min(remaining, invoice.currentDue);
          allocationPlan.push({ invoiceId: invoice.id, amount: allocationAmount, invoice });
          remaining = remaining.minus(allocationAmount);
        }
        if (remaining.gt(0)) {
          throw errors.badRequest("INSUFFICIENT_INVOICE_DUE", "Payment amount exceeds outstanding invoice dues");
        }
      }

      const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
      const payment = await tx.payment.create({
        data: {
          shopId,
          receiptNumber: createReference("RCT", paymentDate),
          customerId: customer.id,
          paymentDate,
          amount,
          method: input.method,
          reference: input.reference,
          note: input.note,
          attachmentUrl: input.attachmentUrl,
          collectedById: actorId,
          allocations: {
            create: allocationPlan.map((allocation) => ({
              invoiceId: allocation.invoiceId,
              amount: allocation.amount
            }))
          }
        }
      });

      for (const allocation of allocationPlan) {
        const nextPaid = allocation.invoice.paidAmount.plus(allocation.amount);
        const nextDue = allocation.invoice.currentDue.minus(allocation.amount);
        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: nextPaid,
            currentDue: nextDue,
            status: invoiceStatus(allocation.invoice.grandTotal, nextPaid)
          }
        });
      }

      const nextBalance = customer.currentBalance.minus(amount);
      await tx.customerLedgerEntry.create({
        data: {
          shopId,
          customerId: customer.id,
          entryDate: paymentDate,
          type: "PAYMENT",
          credit: amount,
          balanceAfter: nextBalance,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          description: `Payment ${payment.receiptNumber}`,
          createdById: actorId
        }
      });
      await tx.customer.update({ where: { id: customer.id }, data: { currentBalance: nextBalance } });
      await writeAuditLog({
        shopId,
        actorId,
        action: "payment.create",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { receiptNumber: payment.receiptNumber, customerId: customer.id, amount: amount.toString() }
      }, tx);

      return payment;
    }, SERIALIZABLE_TRANSACTION_OPTIONS)
  );

  await publishDomainEvent("payment.created", {
    eventId: createReference("EVT"),
    paymentId: created.id,
    customerId: created.customerId
  });
  return getPayment(created.id, shopId);
}

export async function reversePayment(paymentId: string, shopId: string, reason: string, actorId: string) {
  const reversed = await retrySerializable(() =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, shopId },
        include: { allocations: { include: { invoice: true } }, customer: true }
      });
      if (!payment) throw errors.notFound("Payment");
      if (payment.status === "REVERSED") {
        throw errors.conflict("PAYMENT_ALREADY_REVERSED", "Payment has already been reversed");
      }

      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${payment.customerId} FOR UPDATE`;
      for (const allocation of payment.allocations) {
        await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${allocation.invoiceId} FOR UPDATE`;
        const nextPaid = allocation.invoice.paidAmount.minus(allocation.amount);
        const nextDue = allocation.invoice.currentDue.plus(allocation.amount);
        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: nextPaid,
            currentDue: nextDue,
            status: invoiceStatus(allocation.invoice.grandTotal, nextPaid)
          }
        });
      }

      const nextBalance = payment.customer.currentBalance.plus(payment.amount);
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversedById: actorId,
          reversalReason: reason
        }
      });
      await tx.customer.update({ where: { id: payment.customerId }, data: { currentBalance: nextBalance } });
      await tx.customerLedgerEntry.create({
        data: {
          shopId,
          customerId: payment.customerId,
          type: "REVERSAL",
          debit: payment.amount,
          balanceAfter: nextBalance,
          sourceType: "PAYMENT_REVERSAL",
          sourceId: payment.id,
          description: `Reversal of ${payment.receiptNumber}: ${reason}`,
          createdById: actorId
        }
      });
      await writeAuditLog({
        shopId,
        actorId,
        action: "payment.reverse",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { receiptNumber: payment.receiptNumber, customerId: payment.customerId, amount: payment.amount.toString(), reason }
      }, tx);
      return payment;
    }, SERIALIZABLE_TRANSACTION_OPTIONS)
  );

  await publishDomainEvent("payment.reversed", {
    eventId: createReference("EVT"),
    paymentId: reversed.id,
    customerId: reversed.customerId
  });
  return getPayment(reversed.id, shopId);
}

export async function getPayment(id: string, shopId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id, shopId },
    include: {
      customer: true,
      collectedBy: { select: { id: true, name: true, username: true } },
      reversedBy: { select: { id: true, name: true, username: true } },
      allocations: { include: { invoice: true } }
    }
  });
  if (!payment) throw errors.notFound("Payment");
  return payment;
}

export async function listPayments(
  shopId: string,
  input: {
    page: number;
    limit: number;
    customerId?: string;
    status?: "CONFIRMED" | "REVERSED";
    from?: string;
    to?: string;
  }
) {
  const where: Prisma.PaymentWhereInput = {
    shopId,
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.from || input.to
      ? {
          paymentDate: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lte: new Date(input.to) } : {})
          }
        }
      : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      include: { customer: true, allocations: { include: { invoice: true } } },
      orderBy: { paymentDate: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit
    }),
    prisma.payment.count({ where })
  ]);
  return { items, total, page: input.page, limit: input.limit, pages: Math.ceil(total / input.limit) };
}

export async function renderPaymentReceiptPdf(id: string, shopId: string): Promise<{ filename: string; contentType: string; content: Buffer }> {
  const payment = await getPayment(id, shopId);
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt ${payment.receiptNumber}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #333; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
    .shop-title { font-size: 24px; font-weight: bold; color: #16a34a; }
    .receipt-title { font-size: 20px; text-align: right; font-weight: bold; }
    .meta-table { width: 100%; margin-bottom: 30px; }
    .meta-table td { vertical-align: top; width: 50%; }
    .allocations-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .allocations-table th, .allocations-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    .allocations-table th { background: #f8fafc; }
    .total-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; text-align: right; font-size: 18px; font-weight: bold; margin-bottom: 30px; }
    .text-right { text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="shop-title">${shop?.name ?? "LogiKhata Enterprise"}</div>
      <div>${shop?.address ?? ""}</div>
      <div>Phone: ${shop?.phone ?? ""}</div>
    </div>
    <div>
      <div class="receipt-title">PAYMENT RECEIPT</div>
      <div># ${payment.receiptNumber}</div>
      <div>Date: ${new Date(payment.paymentDate).toLocaleDateString()}</div>
      <div>Status: ${payment.status}</div>
    </div>
  </div>

  <table class="meta-table">
    <tr>
      <td>
        <strong>Received From:</strong><br>
        ${payment.customer.name}<br>
        Phone: ${payment.customer.phone}<br>
        ${payment.customer.address ? payment.customer.address + "<br>" : ""}
      </td>
      <td>
        <strong>Payment Method:</strong> ${payment.method}<br>
        <strong>Reference:</strong> ${payment.reference ?? "N/A"}<br>
        <strong>Collected By:</strong> ${payment.collectedBy.name}
      </td>
    </tr>
  </table>

  <div class="total-box">
    Amount Received: ৳${payment.amount}
  </div>

  <h3>Allocated Invoices</h3>
  <table class="allocations-table">
    <thead>
      <tr>
        <th>Invoice Number</th>
        <th>Invoice Date</th>
        <th class="text-right">Grand Total</th>
        <th class="text-right">Allocated Amount</th>
      </tr>
    </thead>
    <tbody>
      ${payment.allocations
        .map(
          (alloc) => `
        <tr>
          <td>${alloc.invoice.invoiceNumber}</td>
          <td>${new Date(alloc.invoice.invoiceDate).toLocaleDateString()}</td>
          <td class="text-right">৳${alloc.invoice.grandTotal}</td>
          <td class="text-right">৳${alloc.amount}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;

  return {
    filename: `Receipt_${payment.receiptNumber}.pdf`,
    contentType: "text/html",
    content: Buffer.from(html, "utf-8")
  };
}
