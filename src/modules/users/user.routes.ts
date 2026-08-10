import { Router } from "express";
import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { requirePermission } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  createUserController,
  listUsersController,
  updateUserPermissionsController,
  updateUserStatusController
} from "./user.controller.js";
import {
  createUserSchema,
  updateUserPermissionsSchema,
  updateUserStatusSchema,
  userIdParamsSchema,
  userListQuerySchema
} from "./user.schemas.js";

export const userRouter = Router();
userRouter.use(requirePermission(PERMISSIONS.USER_MANAGE));
userRouter.get("/", validate({ query: userListQuerySchema }), listUsersController);
userRouter.post("/", validate({ body: createUserSchema }), createUserController);
userRouter.patch(
  "/:id/status",
  validate({ params: userIdParamsSchema, body: updateUserStatusSchema }),
  updateUserStatusController
);
userRouter.put(
  "/:id/permissions",
  validate({ params: userIdParamsSchema, body: updateUserPermissionsSchema }),
  updateUserPermissionsController
);
