import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";

export async function getDueAging(shopId: string, customerId?: string) {
  const now = new Date();

  const customers = await prisma.customer.findMany({
    where: {
      shopId,
      deletedAt: null,
      status: "ACTIVE",
      ...(customerId ? { id: customerId } : {}),
      currentBalance: { gt: 0 }
    },
    include: {
      invoices: {
        where: { shopId, currentDue: { gt: 0 }, status: { not: "VOIDED" } },
        select: { id: true, invoiceNumber: true, invoiceDate: true, currentDue: true }
      }
    }
  });

  let totalDue = new Prisma.Decimal(0);
  let totalBucket0_30 = new Prisma.Decimal(0);
  let totalBucket31_60 = new Prisma.Decimal(0);
  let totalBucket61_90 = new Prisma.Decimal(0);
  let totalBucket90Plus = new Prisma.Decimal(0);

  const customerAging = customers.map((c) => {
    let bucket0_30 = new Prisma.Decimal(0);
    let bucket31_60 = new Prisma.Decimal(0);
    let bucket61_90 = new Prisma.Decimal(0);
    let bucket90Plus = new Prisma.Decimal(0);

    for (const inv of c.invoices) {
      const ageDays = Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
      const due = inv.currentDue;

      if (ageDays <= 30) bucket0_30 = bucket0_30.plus(due);
      else if (ageDays <= 60) bucket31_60 = bucket31_60.plus(due);
      else if (ageDays <= 90) bucket61_90 = bucket61_90.plus(due);
      else bucket90Plus = bucket90Plus.plus(due);
    }

    // Unallocated balance falls into 0-30 bucket if invoices don't account for all balance
    const invoiceSum = bucket0_30.plus(bucket31_60).plus(bucket61_90).plus(bucket90Plus);
    if (c.currentBalance.gt(invoiceSum)) {
      bucket0_30 = bucket0_30.plus(c.currentBalance.minus(invoiceSum));
    }

    totalDue = totalDue.plus(c.currentBalance);
    totalBucket0_30 = totalBucket0_30.plus(bucket0_30);
    totalBucket31_60 = totalBucket31_60.plus(bucket31_60);
    totalBucket61_90 = totalBucket61_90.plus(bucket61_90);
    totalBucket90Plus = totalBucket90Plus.plus(bucket90Plus);

    return {
      customerId: c.id,
      customerCode: c.customerCode,
      name: c.name,
      phone: c.phone,
      totalDue: c.currentBalance,
      bucket0_30,
      bucket31_60,
      bucket61_90,
      bucket90Plus
    };
  });

  return {
    summary: {
      totalDue,
      bucket0_30: totalBucket0_30,
      bucket31_60: totalBucket31_60,
      bucket61_90: totalBucket61_90,
      bucket90Plus: totalBucket90Plus
    },
    customers: customerAging
  };
}

export async function getReportSummary(shopId: string, startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const [purchases, payments, dueAgg] = await Promise.all([
    prisma.purchase.aggregate({
      where: { shopId, status: "CONFIRMED", purchaseDate: { gte: start, lte: end } },
      _sum: { netAmount: true, subtotal: true, discount: true },
      _count: true
    }),
    prisma.payment.aggregate({
      where: { shopId, status: "CONFIRMED", paymentDate: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: true
    }),
    prisma.customer.aggregate({
      where: { shopId, deletedAt: null, status: "ACTIVE" },
      _sum: { currentBalance: true }
    })
  ]);

  return {
    period: { startDate: start, endDate: end },
    totalSales: purchases._sum.netAmount ?? new Prisma.Decimal(0),
    totalSalesCount: purchases._count,
    totalCollections: payments._sum.amount ?? new Prisma.Decimal(0),
    totalCollectionsCount: payments._count,
    totalOutstandingDue: dueAgg._sum.currentBalance ?? new Prisma.Decimal(0)
  };
}

export async function getSalesReport(shopId: string, startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const purchases = await prisma.purchase.findMany({
    where: { shopId, status: "CONFIRMED", purchaseDate: { gte: start, lte: end } },
    include: { items: true, customer: { select: { id: true, name: true } } },
    orderBy: { purchaseDate: "asc" }
  });

  const dailyMap = new Map<string, { date: string; sales: Prisma.Decimal; count: number }>();
  const productMap = new Map<string, { name: string; quantity: Prisma.Decimal; totalAmount: Prisma.Decimal }>();

  for (const p of purchases) {
    const day = p.purchaseDate.toISOString().slice(0, 10);
    const existing = dailyMap.get(day) ?? { date: day, sales: new Prisma.Decimal(0), count: 0 };
    dailyMap.set(day, { date: day, sales: existing.sales.plus(p.netAmount), count: existing.count + 1 });

    for (const item of p.items) {
      const prodKey = item.nameSnapshot;
      const existingProd = productMap.get(prodKey) ?? { name: prodKey, quantity: new Prisma.Decimal(0), totalAmount: new Prisma.Decimal(0) };
      productMap.set(prodKey, {
        name: prodKey,
        quantity: existingProd.quantity.plus(item.quantity),
        totalAmount: existingProd.totalAmount.plus(item.lineTotal)
      });
    }
  }

  return {
    dailySales: Array.from(dailyMap.values()),
    productPerformance: Array.from(productMap.values()).sort((a, b) => b.totalAmount.cmp(a.totalAmount))
  };
}

export async function getPaymentsReport(shopId: string, startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const payments = await prisma.payment.findMany({
    where: { shopId, status: "CONFIRMED", paymentDate: { gte: start, lte: end } },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { paymentDate: "asc" }
  });

  const dailyMap = new Map<string, { date: string; amount: Prisma.Decimal; count: number }>();
  const methodMap = new Map<string, { method: string; amount: Prisma.Decimal; count: number }>();

  for (const p of payments) {
    const day = p.paymentDate.toISOString().slice(0, 10);
    const existingDay = dailyMap.get(day) ?? { date: day, amount: new Prisma.Decimal(0), count: 0 };
    dailyMap.set(day, { date: day, amount: existingDay.amount.plus(p.amount), count: existingDay.count + 1 });

    const methodKey = p.method;
    const existingMethod = methodMap.get(methodKey) ?? { method: methodKey, amount: new Prisma.Decimal(0), count: 0 };
    methodMap.set(methodKey, { method: methodKey, amount: existingMethod.amount.plus(p.amount), count: existingMethod.count + 1 });
  }

  return {
    dailyPayments: Array.from(dailyMap.values()),
    methodBreakdown: Array.from(methodMap.values())
  };
}

export async function exportReportData(
  shopId: string,
  type: "SALES" | "PAYMENTS" | "DUE_AGING",
  format: "CSV" | "EXCEL" = "CSV",
  startDate?: string,
  endDate?: string
): Promise<{ filename: string; contentType: string; csv: string }> {
  if (type === "DUE_AGING") {
    const data = await getDueAging(shopId);
    const headers = ["Customer Code", "Customer Name", "Phone", "Total Due", "0-30 Days", "31-60 Days", "61-90 Days", "90+ Days"];
    const rows = data.customers.map((c) => [
      `"${c.customerCode}"`,
      `"${c.name}"`,
      `"${c.phone}"`,
      c.totalDue.toString(),
      c.bucket0_30.toString(),
      c.bucket31_60.toString(),
      c.bucket61_90.toString(),
      c.bucket90Plus.toString()
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return { filename: `Due_Aging_Report.csv`, contentType: "text/csv", csv };
  }

  if (type === "SALES") {
    const data = await getSalesReport(shopId, startDate, endDate);
    const headers = ["Date", "Total Sales Amount", "Transaction Count"];
    const rows = data.dailySales.map((d) => [d.date, d.sales.toString(), d.count.toString()]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return { filename: `Sales_Report.csv`, contentType: "text/csv", csv };
  }

  // PAYMENTS
  const data = await getPaymentsReport(shopId, startDate, endDate);
  const headers = ["Date", "Total Collection Amount", "Transaction Count"];
  const rows = data.dailyPayments.map((d) => [d.date, d.amount.toString(), d.count.toString()]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  return { filename: `Payments_Report.csv`, contentType: "text/csv", csv };
}
