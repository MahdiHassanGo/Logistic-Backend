import { describe, expect, it } from "vitest";
import { driverListQuerySchema, updateDriverSchema, updateVehicleSchema } from "../src/modules/deliveries/delivery.schemas.js";
import { invoiceListQuerySchema } from "../src/modules/invoices/invoice.schemas.js";
import { exportReportSchema } from "../src/modules/reports/report.schemas.js";
import { getSmsSettings } from "../src/modules/sms/sms.service.js";

describe("LogiKhata New Backend Endpoints & Validation", () => {
  it("validates invoice list query parameters correctly", () => {
    const valid = invoiceListQuerySchema.parse({ page: "1", limit: "20", status: "UNPAID" });
    expect(valid.page).toBe(1);
    expect(valid.limit).toBe(20);
    expect(valid.status).toBe("UNPAID");
  });

  it("validates driver and vehicle update schemas", () => {
    const driver = updateDriverSchema.parse({ name: "Rahim Uddin", status: "ACTIVE" });
    expect(driver.name).toBe("Rahim Uddin");
    expect(driver.status).toBe("ACTIVE");

    const vehicle = updateVehicleSchema.parse({ registrationNumber: "DHAKA-METRO-1234", capacity: "5.5" });
    expect(vehicle.registrationNumber).toBe("DHAKA-METRO-1234");
    expect(vehicle.capacity).toBe("5.5");
  });

  it("validates report export request schema", () => {
    const reportReq = exportReportSchema.parse({ type: "DUE_AGING", format: "CSV" });
    expect(reportReq.type).toBe("DUE_AGING");
    expect(reportReq.format).toBe("CSV");
  });

  it("returns fallback SMS settings for shopId", async () => {
    const settings = await getSmsSettings("test-shop-id");
    expect(settings.provider).toBe("MOCK");
    expect(settings.autoSmsOnPurchase).toBe(true);
  });
});
