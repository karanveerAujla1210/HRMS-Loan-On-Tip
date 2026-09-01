import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { LeaveDecisionSchema } from "@hrms/api-contract";
import { adminClient } from "@/lib/server/supabase";
import { writeAudit } from "@/lib/audit";

export const PATCH = withApi({
  permission: "leave.approve",
  body: LeaveDecisionSchema,
  idempotencyEndpoint: "leave/decide",
  idempotencyKey: (body) => body.idempotency_key,
  handler: async ({ req, ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const leaveId = params.id;
    const db = adminClient();

    const { data: leave, error: lvErr } = await db
      .from("leave_requests")
      .select("id, employee_id, leave_type_id, from_date, total_days, status, company_id")
      .eq("id", leaveId)
      .maybeSingle();
    if (lvErr) throw lvErr;
    if (!leave) {
      return jsonOk(
        { error: "NOT_FOUND", message: "Leave request not found" },
        requestId,
        404
      );
    }
    if ((leave as { company_id: string }).company_id !== companyId) {
      return jsonOk(
        { error: "FORBIDDEN", message: "Leave request belongs to another company" },
        requestId,
        403
      );
    }
    if ((leave as { status: string }).status !== "PENDING") {
      return jsonOk(
        { error: "ALREADY_DECIDED", message: "This leave request has already been processed" },
        requestId,
        409
      );
    }

    // Atomic, idempotent approval that also updates the leave balance inside a
    // single transaction (see migration 38).
    const { data: resultId, error: rpcErr } = await db.rpc("apply_leave_approval", {
      p_leave_request_id: leaveId,
      p_actor_id: ctx.employeeId,
      p_action: body.action,
      p_comments: body.comments ?? null,
    });
    if (rpcErr) throw rpcErr;

    const { data, error: updErr } = await db
      .from("leave_requests")
      .select("id, status")
      .eq("id", resultId ?? leaveId)
      .single();
    if (updErr) throw updErr;

    await audit({
      action: body.action === "APPROVED" ? "LEAVE_APPROVE" : "LEAVE_REJECT",
      entityType: "leave_requests",
      entityId: leaveId,
      newValues: { action: body.action, comments: body.comments ?? null },
    });

    return jsonOk(data, requestId);
  },
});