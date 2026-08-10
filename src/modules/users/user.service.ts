import type { UserRole } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { errors } from "../../shared/errors/app-error.js";
import { hashPassword } from "../../shared/security/hash.js";

export async function createUser(
  input: {
    name: string;
    username: string;
    email?: string;
    phone?: string;
    password: string;
    role: UserRole;
  },
  shopId: string,
  actorRole: UserRole
) {
  if (input.role === "OWNER" && actorRole !== "OWNER") {
    throw errors.forbidden("Only an owner can create another owner account");
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      shopId,
      name: input.name,
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role
    },
    select: {
      id: true,
      shopId: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function listUsers(
  shopId: string,
  input: {
    page: number;
    limit: number;
    role?: UserRole;
    status?: "ACTIVE" | "INACTIVE" | "LOCKED";
    search?: string;
  }
) {
  const where = {
    shopId,
    deletedAt: null,
    ...(input.role ? { role: input.role } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { username: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
            { phone: { contains: input.search } }
          ]
        }
      : {})
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        shopId: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.user.count({ where })
  ]);

  return { items, total, page: input.page, limit: input.limit, pages: Math.ceil(total / input.limit) };
}

export async function updateUserStatus(
  id: string,
  shopId: string,
  status: "ACTIVE" | "INACTIVE" | "LOCKED",
  actorId: string
) {
  if (id === actorId && status !== "ACTIVE") {
    throw errors.badRequest("SELF_DEACTIVATION_NOT_ALLOWED", "You cannot disable your own account");
  }
  const existing = await prisma.user.findFirst({ where: { id, shopId, deletedAt: null } });
  if (!existing) throw errors.notFound("User");

  const user = await prisma.user.update({
    where: { id },
    data: { status },
    select: { id: true, shopId: true, name: true, username: true, role: true, status: true, updatedAt: true }
  });
  if (status !== "ACTIVE") {
    await prisma.refreshSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
  return user;
}

export async function replaceUserPermissionOverrides(
  userId: string,
  shopId: string,
  input: { allow: string[]; deny: string[] }
) {
  const targetUser = await prisma.user.findFirst({ where: { id: userId, shopId, deletedAt: null } });
  if (!targetUser) throw errors.notFound("User");

  const permissionKeys = [...new Set([...input.allow, ...input.deny])];
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  if (permissions.length !== permissionKeys.length) {
    const found = new Set(permissions.map((item) => item.key));
    throw errors.badRequest(
      "UNKNOWN_PERMISSION",
      "One or more permission keys are unknown",
      permissionKeys.filter((key) => !found.has(key))
    );
  }

  const byKey = new Map(permissions.map((item) => [item.key, item.id]));
  await prisma.$transaction(async (tx) => {
    await tx.userPermissionOverride.deleteMany({ where: { userId } });
    await tx.userPermissionOverride.createMany({
      data: [
        ...input.allow.map((key) => ({ userId, permissionId: byKey.get(key)!, allow: true })),
        ...input.deny.map((key) => ({ userId, permissionId: byKey.get(key)!, allow: false }))
      ]
    });
  });

  return prisma.userPermissionOverride.findMany({
    where: { userId },
    select: { allow: true, permission: { select: { key: true } } }
  });
}
