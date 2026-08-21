import type { CheckInRequest, CheckOutRequest, ApiResponse } from "@hrms/api-contract";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

async function post<T>(path: string, body: unknown, token: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const attendanceApi = {
  checkIn: (body: CheckInRequest, token: string) =>
    post("/api/attendance/check-in", body, token),
  checkOut: (body: CheckOutRequest, token: string) =>
    post("/api/attendance/check-out", body, token),
};
