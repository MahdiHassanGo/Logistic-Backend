import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type UserRole } from "../src/generated/prisma/client.js";
import { PERMISSIONS } from "../src/shared/auth/permissions.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.SEED_OWNER_PASSWORD) throw new Error("SEED_OWNER_PASSWORD is required");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const all = Object.values(PERMISSIONS);
const rolePermissions: Partial<Record<UserRole, string[]>> = {
  ADMIN: all,
  MANAGER: [
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PURCHASE_READ,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.DELIVERY_READ,
    PERMISSIONS.DELIVERY_CREATE,
    PERMISSIONS.DELIVERY_ASSIGN,
    PERMISSIONS.DELIVERY_UPDATE_STATUS,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT
  ],
  ACCOUNTANT: [
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.PURCHASE_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_REVERSE,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT
  ],
  OPERATOR: [
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PURCHASE_READ,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.DELIVERY_READ,
    PERMISSIONS.DELIVERY_CREATE,
    PERMISSIONS.DASHBOARD_READ
  ],
  DRIVER: [PERMISSIONS.DELIVERY_READ, PERMISSIONS.DELIVERY_UPDATE_STATUS],
  VIEWER: [
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PURCHASE_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.DELIVERY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REPORT_READ
  ]
};

async function main() {
  for (const key of all) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key.replaceAll(".", " ") }
    });
  }

  const permissions = await prisma.permission.findMany();
  const permissionIds = new Map(permissions.map((permission) => [permission.key, permission.id]));

  for (const [role, keys] of Object.entries(rolePermissions) as [UserRole, string[]][]) {
    await prisma.rolePermission.deleteMany({ where: { role } });
    await prisma.rolePermission.createMany({
      data: keys.map((key) => ({ role, permissionId: permissionIds.get(key)! })),
      skipDuplicates: true
    });
  }

  // Create Shop 1
  const shop1 = await prisma.shop.upsert({
    where: { code: "SHOP-001" },
    update: { name: "Green Valley Traders" },
    create: {
      name: "Green Valley Traders",
      code: "SHOP-001",
      phone: "+8801700000001",
      address: "Dhaka, Bangladesh"
    }
  });

  // Create Shop 2
  const shop2 = await prisma.shop.upsert({
    where: { code: "SHOP-002" },
    update: { name: "Sunrise Superstore" },
    create: {
      name: "Sunrise Superstore",
      code: "SHOP-002",
      phone: "+8801700000002",
      address: "Chittagong, Bangladesh"
    }
  });

  const passwordHash = await argon2.hash(process.env.SEED_OWNER_PASSWORD!, { type: argon2.argon2id });
  
  // Owner 1 for Shop 1
  const owner1 = await prisma.user.upsert({
    where: { username: process.env.SEED_OWNER_USERNAME ?? "owner" },
    update: {
      shopId: shop1.id,
      name: process.env.SEED_OWNER_NAME ?? "System Owner",
      email: process.env.SEED_OWNER_EMAIL ?? "owner@example.com",
      passwordHash,
      role: "OWNER",
      status: "ACTIVE"
    },
    create: {
      shopId: shop1.id,
      name: process.env.SEED_OWNER_NAME ?? "System Owner",
      username: process.env.SEED_OWNER_USERNAME ?? "owner",
      email: process.env.SEED_OWNER_EMAIL ?? "owner@example.com",
      passwordHash,
      role: "OWNER",
      status: "ACTIVE"
    }
  });

  // Owner 2 for Shop 2
  const owner2 = await prisma.user.upsert({
    where: { username: "owner2" },
    update: {
      shopId: shop2.id,
      name: "Sunrise Owner",
      email: "owner2@example.com",
      passwordHash,
      role: "OWNER",
      status: "ACTIVE"
    },
    create: {
      shopId: shop2.id,
      name: "Sunrise Owner",
      username: "owner2",
      email: "owner2@example.com",
      passwordHash,
      role: "OWNER",
      status: "ACTIVE"
    }
  });

  await prisma.shop.update({ where: { id: shop1.id }, data: { ownerId: owner1.id } });
  await prisma.shop.update({ where: { id: shop2.id }, data: { ownerId: owner2.id } });

  console.log(`Seed complete. Shop 1 Owner: ${owner1.username}, Shop 2 Owner: ${owner2.username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
