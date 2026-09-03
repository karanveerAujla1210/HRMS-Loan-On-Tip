import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role } from "@hrms/api-contract";
import { getAuthContext } from "./server/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Stable, safe error envelope returned by every API route.
 * Never include raw database error text in `message` — map it first.
 */
export type ApiErrorBody = {
  code: string;
  message: string;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(code: string, message: string) {
  return new ApiError(400, code, message);
}
export function unauthorized(message = "Sign in required") {
  return new ApiError(401, "UNAUTHENTICATED", message);
}
export function forbidden(message = "You are not allowed to perform this action") {
  return new ApiError(403, "FORBIDDEN", message);
}
export function notFound(message = "Record not found") {
  return new ApiError(404, "NOT_FOUND", message);
}

/** Service-role client. Bypasses RLS — every caller must be authorised first. */
export function serviceClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiError(500, "SERVER_CONFIG", "Service role key is not configured");
  }
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Actor = {
  authUserId: string;
  employeeId: string | null;
  companyId: string | null;
  profileId: string;
  permissions: Set<string>;
  role: string | null;
  roles: Role[];
};

/**
 * Resolves the calling user from the session cookie and loads their company,
 * primary role and effective permission set (computed from the DB, never from
 * the client). Throws {@link ApiError} when unauthenticated / unlinked.
 */
export async function resolveActor(): Promise<Actor> {
  const ctx = await getAuthContext();
  if (!ctx.profileId) throw forbidden("No profile is linked to this account");

  return {
    authUserId: ctx.authUserId,
    employeeId: ctx.employeeId,
    companyId: ctx.companyId,
    profileId: ctx.profileId,
    permissions: new Set(ctx.permissions),
    role: ctx.primaryRole,
    roles: ctx.roles,
  };
}

export function requirePermission(actor: Actor, code: string): void {
  if (!actor.permissions.has(code)) throw forbidden(`Missing permission: ${code}`);
}

export function requireAnyPermission(actor: Actor, codes: string[]): void {
  if (!codes.some((c) => actor.permissions.has(c))) {
    throw forbidden(`Missing one of: ${codes.join(", ")}`);
  }
}

export function requireCompany(actor: Actor): string {
  if (!actor.companyId) throw forbidden("Account is not linked to a company");
  return actor.companyId;
}

function newRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(
    { data, error: null, requestId: newRequestId() },
    init
  );
}

export function fail(err: unknown) {
  const requestId = newRequestId();
  if (err instanceof ApiError) {
    return NextResponse.json(
      { data: null, error: { code: err.code, message: err.message } satisfies ApiErrorBody, requestId },
      { status: err.status }
    );
  }
  const _message = err instanceof Error ? err.message : "Unexpected error";
  return NextResponse.json(
    {
      data: null,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      requestId,
    },
    { status: 500 }
  );
}

/**
 * Maps a Postgres error to a safe {@link ApiError}. Raw database messages are
 * never forwarded to the client — only stable codes and a generic message.
 */
export function dbError(err: unknown): ApiError {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case "23505":
      return new ApiError(409, "DUPLICATE", "A record with these details already exists");
    case "23503":
      return new ApiError(400, "FK_INVALID", "A referenced record does not exist");
    case "23514":
      return new ApiError(400, "CHECK_VIOLATION", "One or more values are not allowed");
    case "42501":
      return new ApiError(403, "FORBIDDEN", "Operation not permitted");
    case "P0001":
      return new ApiError(400, "VALIDATION", "The request failed validation");
    default:
      return new ApiError(400, "DB_ERROR", "The request could not be completed");
  }
}

/** Parses a JSON body, returning an empty object when absent or invalid. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Wraps a route handler, guaranteeing the safe envelope and central error mapping. */
export function route<T extends unknown[]>(
  handler: (req: Request, ...args: T) => Promise<NextResponse>
) {
  return async (req: Request, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      return fail(err);
    }
  };
}
