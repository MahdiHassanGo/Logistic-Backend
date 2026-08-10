import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { errors } from "../../shared/errors/app-error.js";
import { createReference } from "../../shared/utils/reference.js";

export async function createCustomer(
  input: {
    name: string;
    phone: string;
    alternatePhone?: string;
    businessName?: string;
    address?: string;
    area?: string;
    district?: string;
    notes?: string;
    creditLimit: string;
    openingBalance: string;
    avatarUrl?: string;
  },
  shopId: string,
  actorId: string
) {
  const openingBalance = new Prisma.Decimal(input.openingBalance);
  const customerCode = createReference("CUS");

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        shopId,
        customerCode,
        name: input.name,
        phone: input.phone,
        alternatePhone: input.alternatePhone,
        businessName: input.businessName,
        address: input.address,
        area: input.area,
        district: input.district,
        notes: input.notes,
        creditLimit: new Prisma.Decimal(input.creditLimit),
        currentBalance: openingBalance,
        avatarUrl: input.avatarUrl,
        createdById: actorId
      }
    });

    if (openingBalance.gt(0)) {
      await tx.customerLedgerEntry.create({
        data: {
          shopId,
          customerId: customer.id,
          type: "OPENING_BALANCE",
          debit: openingBalance,
          credit: 0,
          balanceAfter: openingBalance,
          sourceType: "CUSTOMER",
          sourceId: customer.id,
          description: "Opening balance",
          createdById: actorId
        }
      });
    }

    return customer;
  });
}

export async function listCustomers(
  shopId: string,
  input: {
    page: number;
    limit: number;
    search?: string;
    status?: "ACTIVE" | "INACTIVE";
    hasDue?: boolean;
  }
) {
  const where: Prisma.CustomerWhereInput = {
    shopId,
    deletedAt: null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.hasDue === true ? { currentBalance: { gt: 0 } } : {}),
    ...(input.hasDue === false ? { currentBalance: { lte: 0 } } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { businessName: { contains: input.search, mode: "insensitive" } },
            { phone: { contains: input.search } },
            { customerCode: { contains: input.search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { purchases: true, payments: true, deliveries: true } }
      }
    }),
    prisma.customer.count({ where })
  ]);

  return { items, total, page: input.page, limit: input.limit, pages: Math.ceil(total / input.limit) };
}

export async function getCustomer(id: string, shopId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, shopId, deletedAt: null },
    include: {
      purchases: { where: { shopId }, take: 10, orderBy: { purchaseDate: "desc" }, include: { invoice: true } },
      payments: { where: { shopId }, take: 10, orderBy: { paymentDate: "desc" } },
      deliveries: { where: { shopId }, take: 10, orderBy: { createdAt: "desc" } }
    }
  });
  if (!customer) throw errors.notFound("Customer");
  return customer;
}

export async function updateCustomer(
  id: string,
  shopId: string,
  input: {
    name?: string;
    phone?: string;
    alternatePhone?: string;
    businessName?: string;
    address?: string;
    area?: string;
    district?: string;
    notes?: string;
    creditLimit?: string;
    avatarUrl?: string;
    status?: "ACTIVE" | "INACTIVE";
  }
) {
  const existing = await prisma.customer.findFirst({ where: { id, shopId, deletedAt: null } });
  if (!existing) throw errors.notFound("Customer");

  return prisma.customer.update({
    where: { id },
    data: {
      name: input.name,
      phone: input.phone,
      alternatePhone: input.alternatePhone,
      businessName: input.businessName,
      address: input.address,
      area: input.area,
      district: input.district,
      notes: input.notes,
      creditLimit: input.creditLimit ? new Prisma.Decimal(input.creditLimit) : undefined,
      avatarUrl: input.avatarUrl,
      status: input.status
    }
  });
}

export async function getCustomerLedger(id: string, shopId: string, page: number, limit: number) {
  const [customer, items, total] = await prisma.$transaction([
    prisma.customer.findFirst({ where: { id, shopId, deletedAt: null }, select: { id: true, currentBalance: true } }),
    prisma.customerLedgerEntry.findMany({
      where: { customerId: id, shopId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.customerLedgerEntry.count({ where: { customerId: id, shopId } })
  ]);
  if (!customer) throw errors.notFound("Customer");
  return { customer, items, total, page, limit, pages: Math.ceil(total / limit) };
}
