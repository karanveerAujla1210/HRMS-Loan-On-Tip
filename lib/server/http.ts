import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ApiResponse, Permission } from "@hrms/api-contract";
import { RATE_LIMITS } from "@hrms/config";
import { getAuthContext, requireCompany, requireEmployee, requirePermission, type AuthContext } from "./auth";
import { ApiError, toApiError, validationError } from "./errors";
import { writeApiLog, writeAudit, type AuditEvent } from "./audit";
import {
  claimIdempotency,
  completeIdempotency,
  releaseIdempotency,
} from "./idempotency";
import { consumeRateLimit } from "./rate-limit";
import { cronSecret } from "./env";

export const REQUEST_ID_HEADER = "x-request-id";

function envelope<T>(data: T | null, error: ApiResponse<T>["error"], requestId: string): ApiResponse<T> {
  return { data, error, requestId };
}

export function jsonOk<T>(data: T, requestId: string, status = 200): NextResponse {
  return NextResponse.json(envelope(data, null, requestId), {
    status,
    headers: { [REQUEST_ID_HEADER]: requestId },
  });
}

export function jsonError(error: ApiError, requestId: string): NextResponse {
  return NextResponse.json(envelope(null, error.toBody(), requestId), {
    status: error.status,
    headers: { [REQUEST_ID_HEADER]: requestId },
  });
}

export function csvResponse(filename: string, csv: string, requestId: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

type ZodAny = z.ZodTypeAny;

export type ApiHandlerArgs<TBody, TQuery, TParams> = {
  req: NextRequest;
  requestId: string;
  ctx: AuthContext;
  body: TBody;
  query: TQuery;
  params: TParams;
  /**
   * Appends an audit event pre-filled with actor, company, request id and
   * client metadata. Failure to audit fails the request.
   */
  audit: (event: Omit<AuditEvent, "companyId" | "actorEmployeeId" | "actorAuthUserId" | "requestId" | "ipAddress" | "userAgent">) => Promise<void>;
};

export type ApiRouteConfig<TBodySchema extends ZodAny, TQuerySchema extends ZodAny, TParams> = {
  /** Permission required to invoke the route. */
  permission?: Permission;
  /** Any one of these permissions is sufficient. */
  anyPermission?: readonly Permission[];
  /** Require a linked employee record (default true for mutations). */
  requireEmployee?: boolean;
  /** Require a resolved company (default true). */
  requireCompany?: boolean;
  body?: TBodySchema;
  query?: TQuerySchema;
  /** Enables idempotent replay for this endpoint. */
  idempotencyEndpoint?: string;
  /** Extracts the idempotency key from the parsed body or request headers. */
  idempotencyKey?: (body: z.output<TBodySchema>, req: NextRequest) => string | undefined;
  rateLimit?: { limit: number; windowMs: number } | false;
  /** Machine-to-machine endpoint authenticated by CRON_SECRET instead of a session. */
  cron?: boolean;
  handler: (
    args: ApiHandlerArgs<z.output<TBodySchema>, z.output<TQuerySchema>, TParams>
  ) => Promise<{ data: unknown; status?: number } | NextResponse>;
};

type RouteSegment<TParams> = { params: Promise<TParams> };

/**
 * Wraps a route handler with the platform contract:
 * request id → authentication → authorisation → validation → rate limit →
 * idempotency → execution → standard envelope → audit/API log.
 *
 * Dynamic route params are awaited here, which is mandatory in Next.js 15.
 */
export function withApi<
  TBodySchema extends ZodAny = z.ZodTypeAny,
  TQuerySchema extends ZodAny = z.ZodTypeAny,
  TParams extends Record<string, string | string[]> = Record<string, string>,
>(config: ApiRouteConfig<TBodySchema, TQuerySchema, TParams>) {
  return async function route(
    req: NextRequest,
    segment?: RouteSegment<TParams>
  ): Promise<NextResponse> {
    const requestId = req.headers.get(REQUEST_ID_HEADER) ?? randomUUID();
    const startedAt = Date.now();
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;
    const userAgent = req.headers.get("user-agent");
    const endpoint = new URL(req.url).pathname;

    let ctx: AuthContext | null = null;
    let idempotencyKeyUsed: string | null = null;
    let statusForLog = 200;
    let errorCodeForLog: string | null = null;

    try {
      // ── Machine-to-machine endpoints ────────────────────────────────────
      if (config.cron) {
        const secret = cronSecret();
        const provided = req.headers.get("authorization");
        if (!secret || provided !== `Bearer ${secret}`) {
          throw new ApiError("UNAUTHORIZED", "Invalid or missing cron credentials.");
        }
      }

      // ── Params ──────────────────────────────────────────────────────────
      const params = ((await segment?.params) ?? {}) as TParams;

      // ── Body / query validation ─────────────────────────────────────────
      let body = undefined as z.output<TBodySchema>;
      if (config.body) {
        let raw: unknown = {};
        try {
          const text = await req.text();
          raw = text ? JSON.parse(text) : {};
        } catch {
          throw validationError({ body: ["Request body is not valid JSON"] });
        }
        const parsed = config.body.safeParse(raw);
        if (!parsed.success) throw validationError(parsed.error.flatten());
        body = parsed.data as z.output<TBodySchema>;
      }

      let query = undefined as z.output<TQuerySchema>;
      if (config.query) {
        const url = new URL(req.url);
        const raw: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          if (value !== "") raw[key] = value;
        });
        const parsed = config.query.safeParse(raw);
        if (!parsed.success) throw validationError(parsed.error.flatten());
        query = parsed.data as z.output<TQuerySchema>;
      }

      // ── Authentication and authorisation ────────────────────────────────
      if (!config.cron) {
        ctx = await getAuthContext(req);
        if (config.requireCompany !== false) requireCompany(ctx);
        if (config.requireEmployee !== false) requireEmployee(ctx);
        if (config.permission) requirePermission(ctx, config.permission);
        if (config.anyPermission && config.anyPermission.length > 0) {
          const allowed = config.anyPermission.some((p) => ctx!.permissions.includes(p));
          if (!allowed) {
            throw new ApiError(
              "FORBIDDEN",
              `Missing one of the required permissions: ${config.anyPermission.join(", ")}`
            );
          }
        }
      } else {
        ctx = {
          authUserId: "00000000-0000-0000-0000-000000000000",
          email: null,
          profileId: null,
          employeeId: null,
          employeeCode: null,
          displayName: "system",
          companyId: null,
          companyName: null,
          locationId: null,
          managerId: null,
          timezone: "Asia/Kolkata",
          roles: [],
          primaryRole: null,
          permissions: [],
        };
      }

      const c = ctx;

      // ── Rate limiting ───────────────────────────────────────────────────
      if (config.rateLimit !== false) {
        const limits = config.rateLimit ?? {
          limit: RATE_LIMITS.mutationsPerMinute,
          windowMs: 60_000,
        };
        consumeRateLimit({
          key: `${c.employeeId ?? c.authUserId}:${endpoint}`,
          limit: limits.limit,
          windowMs: limits.windowMs,
        });
      }

      // ── Idempotency ─────────────────────────────────────────────────────
      if (config.idempotencyEndpoint && c.employeeId) {
        const key =
          config.idempotencyKey?.(body, req) ??
          req.headers.get("idempotency-key") ??
          undefined;
        const claim = await claimIdempotency({
          employeeId: c.employeeId,
          key,
          endpoint: config.idempotencyEndpoint,
          payload: body ?? null,
        });
        if (claim.kind === "replay") {
          statusForLog = claim.status;
          return NextResponse.json(claim.body, {
            status: claim.status,
            headers: { [REQUEST_ID_HEADER]: requestId, "idempotent-replay": "true" },
          });
        }
        if (claim.kind === "in_flight") {
          throw new ApiError(
            "CONFLICT",
            "An identical request is already being processed."
          );
        }
        if (claim.kind === "fresh") idempotencyKeyUsed = claim.key;
      }

      // ── Execute ─────────────────────────────────────────────────────────
      const audit: ApiHandlerArgs<never, never, never>["audit"] = async (event) => {
        await writeAudit({
          ...event,
          companyId: c?.companyId ?? null,
          actorEmployeeId: c?.employeeId ?? null,
          actorAuthUserId: config.cron ? null : c?.authUserId ?? null,
          requestId,
          ipAddress,
          userAgent,
        });
      };

      const result = await config.handler({
        req,
        requestId,
        ctx,
        body,
        query,
        params,
        audit: audit as ApiHandlerArgs<
          z.output<TBodySchema>,
          z.output<TQuerySchema>,
          TParams
        >["audit"],
      });

      if (result instanceof NextResponse) {
        statusForLog = result.status;
        return result;
      }

      const status = result.status ?? 200;
      statusForLog = status;
      const responseBody = envelope(result.data, null, requestId);

      if (idempotencyKeyUsed && c.employeeId) {
        await completeIdempotency({
          employeeId: c.employeeId,
          key: idempotencyKeyUsed,
          status,
          body: responseBody,
        });
      }

      return NextResponse.json(responseBody, {
        status,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    } catch (error) {
      const apiError = toApiError(error);
      statusForLog = apiError.status;
      errorCodeForLog = apiError.code;

      if (idempotencyKeyUsed && ctx?.employeeId) {
        await releaseIdempotency({ employeeId: ctx.employeeId, key: idempotencyKeyUsed });
      }

      if (apiError.status >= 500) {
        console.error(`[${requestId}] ${req.method} ${endpoint}`, apiError.message, apiError.details);
      }

      return jsonError(apiError, requestId);
    } finally {
      void writeApiLog({
        requestId,
        authUserId: config.cron ? null : ctx?.authUserId ?? null,
        employeeId: ctx?.employeeId ?? null,
        method: req.method,
        endpoint,
        statusCode: statusForLog,
        durationMs: Date.now() - startedAt,
        ipAddress,
        userAgent,
        errorCode: errorCodeForLog,
      });
    }
  };
}
