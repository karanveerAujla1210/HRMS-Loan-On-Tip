import "server-only";
import { createHash } from "node:crypto";
import { adminClient, hasAdminCredentials } from "./supabase";
import { ApiError } from "./errors";
import { ERROR_CODES } from "@hrms/api-contract";

export type IdempotencyClaim =
  | { kind: "fresh"; key: string }
  | { kind: "replay"; key: string; status: number; body: unknown }
  | { kind: "in_flight"; key: string }
  | { kind: "disabled" };

export function hashRequest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

/**
 * Claims an idempotency key for an employee + endpoint pair.
 *
 * The unique constraint on (employee_id, idempotency_key) makes the claim
 * atomic, so two concurrent submissions of the same logical action — a
 * double-click or a mobile retry — can never both proceed.
 */
export async function claimIdempotency(args: {
  employeeId: string;
  key: string | undefined;
  endpoint: string;
  payload: unknown;
}): Promise<IdempotencyClaim> {
  if (!args.key) return { kind: "disabled" };
  if (!hasAdminCredentials()) return { kind: "disabled" };

  const db = adminClient();
  const requestHash = hashRequest(args.payload);

  const { error } = await db.from("idempotency_keys").insert({
    employee_id: args.employeeId,
    idempotency_key: args.key,
    endpoint: args.endpoint,
    request_hash: requestHash,
  });

  if (!error) return { kind: "fresh", key: args.key };

  // 23505 = unique violation: the key was already claimed.
  if ((error as { code?: string }).code !== "23505") {
    throw new ApiError(ERROR_CODES.INTERNAL_ERROR, `Idempotency check failed: ${error.message}`);
  }

  const { data: existing } = await db
    .from("idempotency_keys")
    .select("response_status,response_body,request_hash,endpoint")
    .eq("employee_id", args.employeeId)
    .eq("idempotency_key", args.key)
    .maybeSingle<{
      response_status: number | null;
      response_body: unknown;
      request_hash: string | null;
      endpoint: string;
    }>();

  if (!existing) return { kind: "in_flight", key: args.key };

  if (existing.endpoint !== args.endpoint || (existing.request_hash && existing.request_hash !== requestHash)) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      "This idempotency key was already used for a different request."
    );
  }

  if (existing.response_status && existing.response_body) {
    return {
      kind: "replay",
      key: args.key,
      status: existing.response_status,
      body: existing.response_body,
    };
  }

  return { kind: "in_flight", key: args.key };
}

/** Stores the response so a retry replays it instead of re-executing. */
export async function completeIdempotency(args: {
  employeeId: string;
  key: string;
  status: number;
  body: unknown;
}): Promise<void> {
  if (!hasAdminCredentials()) return;
  await adminClient()
    .from("idempotency_keys")
    .update({ response_status: args.status, response_body: args.body })
    .eq("employee_id", args.employeeId)
    .eq("idempotency_key", args.key);
}

/** Releases a claim when the handler failed, so the caller may retry. */
export async function releaseIdempotency(args: {
  employeeId: string;
  key: string;
}): Promise<void> {
  if (!hasAdminCredentials()) return;
  await adminClient()
    .from("idempotency_keys")
    .delete()
    .eq("employee_id", args.employeeId)
    .eq("idempotency_key", args.key)
    .is("response_status", null);
}
