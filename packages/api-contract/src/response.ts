import { z } from "zod";
import { ERROR_CODES, type ErrorCode } from "./errors";

/** Standard error object embedded in every failed response. */
export type ApiErrorBody = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

/**
 * The one and only response envelope used by every /api/v1 endpoint.
 * Web and mobile clients must not invent alternative shapes.
 */
export type ApiResponse<T> = {
  data: T | null;
  error: ApiErrorBody | null;
  requestId: string;
};

export const ApiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema.nullable(),
    error: ApiErrorBodySchema.nullable(),
    requestId: z.string(),
  });
}

/** Pagination request/response contract shared by all list endpoints. */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });
}

export const isErrorCode = (value: string): value is ErrorCode =>
  Object.prototype.hasOwnProperty.call(ERROR_CODES, value);
