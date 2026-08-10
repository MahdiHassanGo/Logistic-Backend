import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { errors } from "../errors/app-error.js";

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return async (req, _res, next) => {
    const validated: Express.Request["validated"] = {};

    for (const key of ["body", "params", "query"] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = await schema.safeParseAsync(req[key]);
      if (!result.success) {
        throw errors.badRequest("VALIDATION_ERROR", "Request validation failed", result.error.flatten());
      }
      validated[key] = result.data;
    }

    req.validated = validated;
    next();
  };
}
