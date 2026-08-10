import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { errors } from "../../shared/errors/app-error.js";

export async function createProduct(
  input: {
    code: string;
    categoryId?: string;
    name: string;
    description?: string;
    unit: string;
    defaultPrice: string;
    isActive: boolean;
  },
  shopId: string,
  actorId: string
) {
  return prisma.product.create({
    data: {
      ...input,
      shopId,
      defaultPrice: new Prisma.Decimal(input.defaultPrice),
      createdById: actorId
    },
    include: { category: true }
  });
}

export async function listProducts(
  shopId: string,
  input: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: string;
    isActive?: boolean;
  }
) {
  const where: Prisma.ProductWhereInput = {
    shopId,
    deletedAt: null,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { code: { contains: input.search, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit
    }),
    prisma.product.count({ where })
  ]);
  return { items, total, page: input.page, limit: input.limit, pages: Math.ceil(total / input.limit) };
}

export async function updateProduct(
  id: string,
  shopId: string,
  input: {
    code?: string;
    categoryId?: string;
    name?: string;
    description?: string;
    unit?: string;
    defaultPrice?: string;
    isActive?: boolean;
  }
) {
  const existing = await prisma.product.findFirst({ where: { id, shopId, deletedAt: null } });
  if (!existing) throw errors.notFound("Product");

  return prisma.product.update({
    where: { id },
    data: {
      code: input.code,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      unit: input.unit,
      defaultPrice: input.defaultPrice ? new Prisma.Decimal(input.defaultPrice) : undefined,
      isActive: input.isActive
    },
    include: { category: true }
  });
}
