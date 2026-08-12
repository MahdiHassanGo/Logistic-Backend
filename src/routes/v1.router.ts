import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { customerRouter } from "../modules/customers/customer.routes.js";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import { deliveryRouter } from "../modules/deliveries/delivery.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { paymentRouter } from "../modules/payments/payment.routes.js";
import { productRouter } from "../modules/products/product.routes.js";
import { purchaseRouter } from "../modules/purchases/purchase.routes.js";
import { invoiceRouter } from "../modules/invoices/invoice.routes.js";
import { reportRouter } from "../modules/reports/report.routes.js";
import { settingsRouter } from "../modules/settings/settings.routes.js";
import { smsRouter } from "../modules/sms/sms.routes.js";
import { userRouter } from "../modules/users/user.routes.js";
import { authenticate } from "../shared/middleware/authenticate.js";

export const v1Router = Router();

v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);

v1Router.use(authenticate);
v1Router.use("/users", userRouter);
v1Router.use("/customers", customerRouter);
v1Router.use("/products", productRouter);
v1Router.use("/purchases", purchaseRouter);
v1Router.use("/invoices", invoiceRouter);
v1Router.use("/payments", paymentRouter);
v1Router.use("/deliveries", deliveryRouter);
v1Router.use("/dashboard", dashboardRouter);
v1Router.use("/reports", reportRouter);
v1Router.use("/sms", smsRouter);
v1Router.use("/settings", settingsRouter);
