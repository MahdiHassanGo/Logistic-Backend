import { Prisma, type DeliveryStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { writeAuditLog } from "../../shared/audit/audit.js";
import { errors } from "../../shared/errors/app-error.js";
import { publishDomainEvent } from "../../shared/queue/domain-events.js";
import { createReference } from "../../shared/utils/reference.js";

const ALLOWED_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

export async function createDriver(
  input: {
    userId?: string;
    driverCode: string;
    name: string;
    phone: string;
    licenseNo?: string;
    notes?: string;
  },
  shopId: string
) {
  return prisma.driver.create({ data: { ...input, shopId } });
}

export async function createVehicle(
  input: {
    registrationNumber: string;
    type: string;
    capacity?: string;
    notes?: string;
  },
  shopId: string
) {
  return prisma.vehicle.create({
    data: {
      ...input,
      shopId,
      capacity: input.capacity ? new Prisma.Decimal(input.capacity) : undefined
    }
  });
}

async function assertResourcesAvailable(
  input: {
    shopId: string;
    driverId?: string;
    vehicleId?: string;
    scheduledAt?: Date | null;
    excludeDeliveryId?: string;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  if (input.driverId) {
    const driver = await db.driver.findFirst({ where: { id: input.driverId, shopId: input.shopId } });
    if (!driver || driver.status !== "ACTIVE") {
      throw errors.badRequest("DRIVER_UNAVAILABLE", "Driver is missing or unavailable");
    }
  }
  if (input.vehicleId) {
    const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, shopId: input.shopId } });
    if (!vehicle || !["AVAILABLE", "IN_USE"].includes(vehicle.status)) {
      throw errors.badRequest("VEHICLE_UNAVAILABLE", "Vehicle is missing or unavailable");
    }
  }

  if (!input.scheduledAt || (!input.driverId && !input.vehicleId)) return;
  const twoHours = 2 * 60 * 60 * 1000;
  const conflict = await db.delivery.findFirst({
    where: {
      shopId: input.shopId,
      id: input.excludeDeliveryId ? { not: input.excludeDeliveryId } : undefined,
      status: { in: ["ASSIGNED", "IN_TRANSIT"] },
      scheduledAt: {
        gte: new Date(input.scheduledAt.getTime() - twoHours),
        lte: new Date(input.scheduledAt.getTime() + twoHours)
      },
      OR: [
        ...(input.driverId ? [{ driverId: input.driverId }] : []),
        ...(input.vehicleId ? [{ vehicleId: input.vehicleId }] : [])
      ]
    }
  });
  if (conflict) {
    throw errors.conflict(
      "DELIVERY_RESOURCE_CONFLICT",
      "Driver or vehicle is already assigned near this scheduled time"
    );
  }
}

export async function createDelivery(
  input: {
    customerId: string;
    purchaseId?: string;
    invoiceId?: string;
    driverId?: string;
    vehicleId?: string;
    address: string;
    contact: string;
    scheduledAt?: string;
    transportCharge: string;
    notes?: string;
  },
  shopId: string,
  actorId: string
) {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const delivery = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, shopId, deletedAt: null, status: "ACTIVE" }
    });
    if (!customer) throw errors.badRequest("CUSTOMER_INACTIVE", "Customer is missing or inactive");

    const [purchase, invoice] = await Promise.all([
      input.purchaseId
        ? tx.purchase.findFirst({ where: { id: input.purchaseId, shopId }, select: { id: true, customerId: true } })
        : Promise.resolve(null),
      input.invoiceId
        ? tx.invoice.findFirst({
            where: { id: input.invoiceId, shopId },
            select: { id: true, customerId: true, purchaseId: true }
          })
        : Promise.resolve(null)
    ]);

    if (input.purchaseId && (!purchase || purchase.customerId !== customer.id)) {
      throw errors.badRequest("INVALID_DELIVERY_PURCHASE", "Purchase does not belong to this customer");
    }
    if (input.invoiceId && (!invoice || invoice.customerId !== customer.id)) {
      throw errors.badRequest("INVALID_DELIVERY_INVOICE", "Invoice does not belong to this customer");
    }
    if (purchase && invoice && invoice.purchaseId !== purchase.id) {
      throw errors.badRequest("DELIVERY_SOURCE_MISMATCH", "Purchase and invoice do not belong together");
    }

    await assertResourcesAvailable({
      shopId,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      scheduledAt
    }, tx);

    const status: DeliveryStatus = input.driverId && input.vehicleId ? "ASSIGNED" : "PENDING";
    const created = await tx.delivery.create({
      data: {
        shopId,
        deliveryNumber: createReference("DLV"),
        customerId: customer.id,
        purchaseId: input.purchaseId,
        invoiceId: input.invoiceId,
        driverId: input.driverId,
        vehicleId: input.vehicleId,
        addressSnapshot: input.address,
        contactSnapshot: input.contact,
        scheduledAt,
        transportCharge: new Prisma.Decimal(input.transportCharge),
        notes: input.notes,
        status,
        history: { create: { toStatus: status, actorId, note: "Delivery created" } }
      },
      include: { driver: true, vehicle: true, customer: true, history: true }
    });

    await writeAuditLog({
      shopId,
      actorId,
      action: "delivery.create",
      entityType: "Delivery",
      entityId: created.id,
      metadata: {
        deliveryNumber: created.deliveryNumber,
        customerId: customer.id,
        status: created.status
      }
    }, tx);

    return created;
  });

  await publishDomainEvent("delivery.updated", {
    eventId: createReference("EVT"),
    deliveryId: delivery.id,
    status: delivery.status
  });
  return delivery;
}

export async function updateDeliveryStatus(
  id: string,
  shopId: string,
  input: {
    status: DeliveryStatus;
    version: number;
    driverId?: string;
    vehicleId?: string;
    note?: string;
    proofUrl?: string;
    receiverName?: string;
    latitude?: string;
    longitude?: string;
  },
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.delivery.findFirst({ where: { id, shopId } });
    if (!current) throw errors.notFound("Delivery");
    if (!ALLOWED_TRANSITIONS[current.status].includes(input.status)) {
      throw errors.conflict(
        "INVALID_DELIVERY_TRANSITION",
        `Delivery cannot move from ${current.status} to ${input.status}`
      );
    }

    const driverId = input.driverId ?? current.driverId ?? undefined;
    const vehicleId = input.vehicleId ?? current.vehicleId ?? undefined;
    if (["ASSIGNED", "IN_TRANSIT", "DELIVERED"].includes(input.status) && (!driverId || !vehicleId)) {
      throw errors.badRequest("DELIVERY_ASSIGNMENT_REQUIRED", "Driver and vehicle are required");
    }

    await assertResourcesAvailable({
      shopId,
      driverId,
      vehicleId,
      scheduledAt: current.scheduledAt,
      excludeDeliveryId: current.id
    }, tx);

    const updateResult = await tx.delivery.updateMany({
      where: { id, shopId, version: input.version },
      data: {
        status: input.status,
        driverId,
        vehicleId,
        proofUrl: input.proofUrl,
        receiverName: input.receiverName,
        startedAt: input.status === "IN_TRANSIT" ? new Date() : current.startedAt,
        deliveredAt: input.status === "DELIVERED" ? new Date() : current.deliveredAt,
        version: { increment: 1 }
      }
    });
    if (updateResult.count !== 1) {
      throw errors.conflict("DELIVERY_VERSION_CONFLICT", "Delivery was updated by another request");
    }

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: id,
        fromStatus: current.status,
        toStatus: input.status,
        actorId,
        note: input.note,
        latitude: input.latitude ? new Prisma.Decimal(input.latitude) : undefined,
        longitude: input.longitude ? new Prisma.Decimal(input.longitude) : undefined
      }
    });

    await writeAuditLog({
      shopId,
      actorId,
      action: "delivery.status.update",
      entityType: "Delivery",
      entityId: id,
      metadata: { fromStatus: current.status, toStatus: input.status, version: input.version }
    }, tx);

    return tx.delivery.findFirstOrThrow({
      where: { id, shopId },
      include: { driver: true, vehicle: true, customer: true, history: { orderBy: { createdAt: "asc" } } }
    });
  });

  await publishDomainEvent("delivery.updated", {
    eventId: createReference("EVT"),
    deliveryId: result.id,
    status: result.status
  });
  return result;
}

export async function getDelivery(id: string, shopId: string) {
  const delivery = await prisma.delivery.findFirst({
    where: { id, shopId },
    include: {
      customer: true,
      purchase: true,
      invoice: true,
      driver: true,
      vehicle: true,
      history: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!delivery) throw errors.notFound("Delivery");
  return delivery;
}

export async function listDeliveries(
  shopId: string,
  input: {
    page: number;
    limit: number;
    status?: DeliveryStatus;
    driverId?: string;
    vehicleId?: string;
    customerId?: string;
  }
) {
  const where: Prisma.DeliveryWhereInput = {
    shopId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.driverId ? { driverId: input.driverId } : {}),
    ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
    ...(input.customerId ? { customerId: input.customerId } : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.delivery.findMany({
      where,
      include: { customer: true, driver: true, vehicle: true },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit
    }),
    prisma.delivery.count({ where })
  ]);
  return { items, total, page: input.page, limit: input.limit, pages: Math.ceil(total / input.limit) };
}

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
