import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { ApiError, mapDatabaseError, notFound as notFoundError, forbidden } from "@/lib/server/errors";

type RouteParams = { id: string };

const RunPatchSchema = z
  .object({
    action: z.enum(["APPROVED", "LOCKED"]),
  })
  .strict();

export const GET = withApi<z.ZodTypeAny, z.ZodTypeAny, RouteParams>({
  permission: "payroll.view",
  rateLimit: { limit: 120, windowMs: 60_000 },
  handler: async ({ ctx, params, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data: run, error: runErr } = await db
      .from("payroll_runs")
      .select("*")
      .eq("id", params.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (runErr) throw mapDatabaseError(runErr);
    if (!run) throw notFoundError("Payroll run not found");

    const { data: items, error: itemsErr } = await db
      .from("payroll_items")
      .select("id,employee_id,paid_days,gross_salary,total_earnings,total_deductions,net_salary,status")
      .eq("payroll_run_id", params.id)
      .order("gross_salary", { ascending: false });
    if (itemsErr) throw mapDatabaseError(itemsErr);

    return jsonOk({ run, items: items ?? [] }, requestId);
  },
});

export const PATCH = withApi<typeof RunPatchSchema, z.ZodTypeAny, RouteParams>({
  // APPROVED requires finance approval; LOCKED requires the lock permission.
  // The per-action check inside the handler enforces the split because
  // anyPermission cannot express conditional requirements.
  anyPermission: ["payroll.approve", "payroll.lock"],
  body: RunPatchSchema,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    if (body.action === "APPROVED") {
      if (!ctx.permissions.includes("payroll.approve")) {
        throw forbidden("Missing required permission: payroll.approve");
      }
    } else if (!ctx.permissions.includes("payroll.lock")) {
      throw forbidden("Missing required permission: payroll.lock");
    }

    const { data: run, error: runErr } = await db
      .from("payroll_runs")
      .select("id, status, company_id")
      .eq("id", params.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (runErr) throw mapDatabaseError(runErr);
    if (!run) throw notFoundError("Payroll run not found");

    const currentStatus = (run as { status: string }).status;
    // Validate state transitions: APPROVED requires CALCULATED; LOCKED requires APPROVED.
    if (body.action === "APPROVED" && currentStatus !== "CALCULATED") {
      throw new ApiError("PAYROLL_INVALID_STATE", "Only CALCULATED runs can be approved.");
    }
    if (body.action === "LOCKED" && currentStatus !== "APPROVED") {
      throw new ApiError("PAYROLL_INVALID_STATE", "Only APPROVED runs can be locked.");
    }

    const update: Record<string, unknown> = {
      status: body.action,
      updated_at: new Date().toISOString(),
    };
    if (body.action === "APPROVED") {
      update.approved_by = ctx.employeeId;
      update.approved_at = new Date().toISOString();
    }
    const { data, error } = await db
      .from("payroll_runs")
      .update(update)
      .eq("id", params.id)
      .select("id, status")
      .single();
    if (error) throw mapDatabaseError(error);

    // Publishing payslips on lock.
    if (body.action === "LOCKED") {
      await db
        .from("payslips")
        .update({ published_at: new Date().toISOString() })
        .eq("payroll_run_id", params.id);
    }

    await audit({
      action: body.action === "APPROVED" ? "PAYROLL_APPROVE" : "PAYROLL_LOCK",
      entityType: "payroll_runs",
      entityId: params.id,
      oldValues: { status: currentStatus },
      newValues: { status: body.action },
    });

    return jsonOk(data, requestId);
  },
});