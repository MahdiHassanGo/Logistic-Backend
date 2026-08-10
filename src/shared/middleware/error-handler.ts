import type { ErrorRequestHandler } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: req.requestId
      }
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        success: false,
        error: {
          code: "DUPLICATE_RECORD",
          message: "A record with the same unique value already exists",
          requestId: req.requestId
        }
      });
      return;
    }

    if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "The requested record was not found",
          requestId: req.requestId
        }
      });
      return;
    }
  }

  logger.error(
    {
      err: error,
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      userId: req.auth?.userId
    },
    "unhandled request error"
  );

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred",
      requestId: req.requestId
    }
  });
};
