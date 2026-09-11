"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMyTodayAttendance } from "@/features/attendance/queries";
import { todayISO } from "@/utils/date";

type CheckResult = { error?: string; data?: { status: string; is_exception?: boolean; worked_minutes?: number } };

function post(url: string, body: Record<string, unknown>) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => res.json() as Promise<CheckResult>);
}

/**
 * Today's attendance card with geolocation check-in / check-out.
 * `onChanged` fires after a successful punch so parents can refresh dependent data.
 */
export default function CheckInOutCard({ employeeId, onChanged }: { employeeId: string; onChanged?: () => void }) {
  const [todayAtt, setTodayAtt] = useState<Record<string, unknown> | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setTodayAtt(await fetchMyTodayAttendance(employeeId));
  }, [employeeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  function punch(kind: "in" | "out") {
    const setBusy = kind === "in" ? setCheckingIn : setCheckingOut;
    const url = kind === "in" ? "/api/attendance/check-in" : "/api/attendance/check-out";
    const idempotencyKey = kind === "in" ? `checkin-${employeeId}-${todayISO()}` : undefined;

    setBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const json = await post(url, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          device_time: new Date().toISOString(),
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        });
        if (json.error) {
          setMessage(`Error: ${json.error}`);
        } else if (kind === "in") {
          setMessage(`Checked in — ${json.data?.status}${json.data?.is_exception ? " (exception raised for review)" : ""}`);
        } else {
          const mins = json.data?.worked_minutes ?? 0;
          setMessage(`Checked out — ${Math.floor(mins / 60)}h ${mins % 60}m worked (${json.data?.status})`);
        }
        setBusy(false);
        void refresh();
        onChanged?.();
      },
      (err) => { setMessage(`Location error: ${err.message}`); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const hasCheckedIn = !!todayAtt?.check_in_at;
  const hasCheckedOut = !!todayAtt?.check_out_at;
  const isError = message?.startsWith("Error") || message?.startsWith("Location error");

  return (
    <div className="checkin-card">
      <div className="checkin-card-main">
        <span className="checkin-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <div>
          <div className="checkin-eyebrow">Today&apos;s Attendance</div>
          <div className="checkin-date">{todayISO()}</div>
          <div className="checkin-status">
            {hasCheckedIn
              ? `Checked in at ${new Date(String(todayAtt?.check_in_at)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}${hasCheckedOut ? ` · Checked out at ${new Date(String(todayAtt?.check_out_at)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}`
              : "Not checked in yet"}
          </div>
          {message && (
            <div className="checkin-message" style={{ color: isError ? "var(--danger)" : "var(--success)" }}>
              {message}
            </div>
          )}
        </div>
      </div>
      <div className="checkin-actions">
        {!hasCheckedIn && (
          <button className="btn btn-primary" onClick={() => punch("in")} disabled={checkingIn}>
            {checkingIn ? "Getting location…" : "Check In"}
          </button>
        )}
        {hasCheckedIn && !hasCheckedOut && (
          <button className="btn btn-secondary" onClick={() => punch("out")} disabled={checkingOut}>
            {checkingOut ? "Getting location…" : "Check Out"}
          </button>
        )}
        {hasCheckedOut && <span className="pill pill-green">Day complete</span>}
      </div>
    </div>
  );
}
