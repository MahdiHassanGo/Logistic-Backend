import { prisma } from "../../shared/database/prisma.js";

export async function getDashboardSummary(shopId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    activeCustomers,
    customerBalance,
    todaySales,
    monthSales,
    todayCollections,
    pendingDeliveries,
    recentPurchases,
    recentPayments
  ] = await Promise.all([
    prisma.customer.count({ where: { shopId, status: "ACTIVE", deletedAt: null } }),
    prisma.customer.aggregate({
      where: { shopId, status: "ACTIVE", deletedAt: null, currentBalance: { gt: 0 } },
      _sum: { currentBalance: true }
    }),
    prisma.purchase.aggregate({
      where: { shopId, status: "CONFIRMED", purchaseDate: { gte: today } },
      _sum: { netAmount: true }
    }),
    prisma.purchase.aggregate({
      where: { shopId, status: "CONFIRMED", purchaseDate: { gte: monthStart } },
      _sum: { netAmount: true }
    }),
    prisma.payment.aggregate({
      where: { shopId, status: "CONFIRMED", paymentDate: { gte: today } },
      _sum: { amount: true }
    }),
    prisma.delivery.count({ where: { shopId, status: { in: ["PENDING", "ASSIGNED", "IN_TRANSIT"] } } }),
    prisma.purchase.findMany({
      where: { shopId },
      take: 8,
      orderBy: { purchaseDate: "desc" },
      include: { customer: { select: { id: true, name: true, phone: true } }, invoice: true }
    }),
    prisma.payment.findMany({
      where: { shopId },
      take: 8,
      orderBy: { paymentDate: "desc" },
      include: { customer: { select: { id: true, name: true, phone: true } } }
    })
  ]);

  return {
    activeCustomers,
    totalDue: customerBalance._sum.currentBalance ?? "0",
    todaySales: todaySales._sum.netAmount ?? "0",
    monthSales: monthSales._sum.netAmount ?? "0",
    todayCollections: todayCollections._sum.amount ?? "0",
    pendingDeliveries,
    recentPurchases,
    recentPayments
  };
}
