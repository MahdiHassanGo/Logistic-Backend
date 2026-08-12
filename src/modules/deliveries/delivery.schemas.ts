import { z } from "zod";

const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);

export const createDriverSchema = z.strictObject({
  userId: z.string().uuid().optional(),
  driverCode: z.string().trim().toUpperCase().min(2).max(50),
  name: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(7).max(20),
  licenseNo: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional()
});

export const createVehicleSchema = z.strictObject({
  registrationNumber: z.string().trim().toUpperCase().min(3).max(50),
  type: z.string().trim().min(2).max(80),
  capacity: money.optional(),
  notes: z.string().trim().max(500).optional()
});

export const createDeliverySchema = z.strictObject({
  customerId: z.string().uuid(),
  purchaseId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  address: z.string().trim().min(3).max(500),
  contact: z.string().trim().min(7).max(100),
  scheduledAt: z.iso.datetime().optional(),
  transportCharge: money.default("0"),
  notes: z.string().trim().max(1000).optional()
});

export const updateDeliveryStatusSchema = z.strictObject({
  status: z.enum(["ASSIGNED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]),
  version: z.number().int().positive(),
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  note: z.string().trim().max(1000).optional(),
  proofUrl: z.string().url().optional(),
  receiverName: z.string().trim().max(150).optional(),
  latitude: z.string().regex(/^-?\d{1,2}(\.\d{1,7})?$/).optional(),
  longitude: z.string().regex(/^-?\d{1,3}(\.\d{1,7})?$/).optional()
});

export const driverIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const driverListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE"]).optional(),
  search: z.string().trim().optional()
});

export const updateDriverSchema = z.strictObject({
  userId: z.string().uuid().optional().nullable(),
  driverCode: z.string().trim().toUpperCase().min(2).max(50).optional(),
  name: z.string().trim().min(2).max(150).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  licenseNo: z.string().trim().max(100).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE"]).optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

export const vehicleIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const vehicleListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE", "INACTIVE"]).optional(),
  search: z.string().trim().optional()
});

export const updateVehicleSchema = z.strictObject({
  registrationNumber: z.string().trim().toUpperCase().min(3).max(50).optional(),
  type: z.string().trim().min(2).max(80).optional(),
  capacity: money.optional().nullable(),
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE", "INACTIVE"]).optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

export const deliveryIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const deliveryListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "ASSIGNED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]).optional(),
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional()
});
