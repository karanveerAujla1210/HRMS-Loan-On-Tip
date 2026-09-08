import { ApiError } from "./errors";
import { ERROR_CODES } from "@hrms/api-contract";

/**
 * Fixed-window in-process rate limiter.
 *
 * Deliberately simple: it protects a single server instance against runaway
 * clients and accidental retry storms. It is not a distributed limiter — on a
 * multi-instance deployment each instance keeps its own counters. Abuse
 * protection at the edge is documented in `/docs/SECURITY.md`.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export function consumeRateLimit(args: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): void {
  const now = args.now ?? Date.now();
  const bucket = buckets.get(args.key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();
    buckets.set(args.key, { count: 1, resetAt: now + args.windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > args.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new ApiError(
      ERROR_CODES.RATE_LIMITED,
      `Too many requests. Retry in ${retryAfterSeconds}s.`,
      { retryAfterSeconds }
    );
  }
}

/** Test seam. */
export function resetRateLimits(): void {
  buckets.clear();
}
