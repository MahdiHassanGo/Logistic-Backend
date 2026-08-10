export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  badRequest: (code: string, message: string, details?: unknown) =>
    new AppError(400, code, message, details),
  unauthorized: (message = "Authentication is required") =>
    new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You do not have permission to perform this action") =>
    new AppError(403, "INSUFFICIENT_PERMISSION", message),
  notFound: (entity: string) => new AppError(404, "NOT_FOUND", `${entity} was not found`),
  conflict: (code: string, message: string, details?: unknown) =>
    new AppError(409, code, message, details)
};
