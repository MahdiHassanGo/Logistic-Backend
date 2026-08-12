import type { InvoiceStatus, Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { errors } from "../../shared/errors/app-error.js";

export async function listInvoices(
  shopId: string,
  input: {
    page: number;
    limit: number;
    customerId?: string;
    status?: InvoiceStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const where: Prisma.InvoiceWhereInput = {
    shopId,
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.startDate || input.endDate
      ? {
          invoiceDate: {
            ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
            ...(input.endDate ? { lte: new Date(input.endDate) } : {})
          }
        }
      : {}),
    ...(input.search
      ? {
          OR: [
            { invoiceNumber: { contains: input.search, mode: "insensitive" } },
            { customer: { name: { contains: input.search, mode: "insensitive" } } },
            { customer: { phone: { contains: input.search, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  const [items, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        purchase: { select: { id: true, purchaseNumber: true, purchaseDate: true } },
        allocations: { include: { payment: { select: { id: true, receiptNumber: true, paymentDate: true } } } },
        delivery: { select: { id: true, deliveryNumber: true, status: true } }
      },
      orderBy: { invoiceDate: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit
    }),
    prisma.invoice.count({ where })
  ]);

  return { items, total, page: input.page, limit: input.limit, pages: Math.ceil(total / input.limit) };
}

export async function getInvoice(id: string, shopId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, shopId },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true, username: true } },
      purchase: {
        include: {
          items: {
            include: {
              product: { select: { id: true, code: true, name: true, unit: true } }
            }
          }
        }
      },
      allocations: {
        include: {
          payment: { select: { id: true, receiptNumber: true, paymentDate: true, method: true, status: true } }
        }
      },
      delivery: true
    }
  });

  if (!invoice) throw errors.notFound("Invoice");
  return invoice;
}

export async function renderInvoicePdf(id: string, shopId: string): Promise<{ filename: string; contentType: string; content: Buffer }> {
  const invoice = await getInvoice(id, shopId);
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #333; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
    .shop-title { font-size: 24px; font-weight: bold; color: #2563eb; }
    .invoice-title { font-size: 20px; text-align: right; font-weight: bold; }
    .meta-table { width: 100%; margin-bottom: 30px; }
    .meta-table td { vertical-align: top; width: 50%; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    .items-table th { background: #f8fafc; }
    .total-row { font-weight: bold; background: #f1f5f9; }
    .text-right { text-align: right; }
    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 15px; }
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
      <div class="invoice-title">INVOICE</div>
      <div># ${invoice.invoiceNumber}</div>
      <div>Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}</div>
      <div>Status: ${invoice.status}</div>
    </div>
  </div>

  <table class="meta-table">
    <tr>
      <td>
        <strong>Billed To:</strong><br>
        ${invoice.customer.name}<br>
        Phone: ${invoice.customer.phone}<br>
        ${invoice.customer.address ? invoice.customer.address + "<br>" : ""}
        ${invoice.customer.businessName ? "Business: " + invoice.customer.businessName : ""}
      </td>
      <td>
        <strong>Purchase Ref:</strong> ${invoice.purchase.purchaseNumber}<br>
        <strong>Created By:</strong> ${invoice.createdBy.name}
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th>Item</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Discount</th>
        <th class="text-right">Line Total</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.purchase.items
        .map(
          (item) => `
        <tr>
          <td>${item.nameSnapshot}</td>
          <td class="text-right">${item.quantity} ${item.unitSnapshot}</td>
          <td class="text-right">৳${item.unitPrice}</td>
          <td class="text-right">৳${item.discount}</td>
          <td class="text-right">৳${item.lineTotal}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="text-right">Subtotal:</td>
        <td class="text-right">৳${invoice.subtotal}</td>
      </tr>
      <tr>
        <td colspan="4" class="text-right">Discount:</td>
        <td class="text-right">৳${invoice.discount}</td>
      </tr>
      <tr>
        <td colspan="4" class="text-right">Previous Due:</td>
        <td class="text-right">৳${invoice.previousDueSnapshot}</td>
      </tr>
      <tr class="total-row">
        <td colspan="4" class="text-right">Grand Total:</td>
        <td class="text-right">৳${invoice.grandTotal}</td>
      </tr>
      <tr>
        <td colspan="4" class="text-right">Paid Amount:</td>
        <td class="text-right">৳${invoice.paidAmount}</td>
      </tr>
      <tr class="total-row">
        <td colspan="4" class="text-right">Current Due:</td>
        <td class="text-right">৳${invoice.currentDue}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    ${invoice.footer ?? "Thank you for doing business with us!"}
  </div>
</body>
</html>`;

  return {
    filename: `Invoice_${invoice.invoiceNumber}.pdf`,
    contentType: "text/html",
    content: Buffer.from(html, "utf-8")
  };
}
