import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, RefreshControl,
} from "react-native";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";

type TodayRecord = {
  id: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtWorked(mins: number) {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const [record, setRecord] = useState<TodayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("employee_id, company_id")
      .eq("auth_user_id", user.id)
      .single();
    if (data) { setEmployeeId(data.employee_id); setCompanyId(data.company_id); }
  }, []);

  const loadToday = useCallback(async () => {
    if (!employeeId) return;
    const { data } = await supabase
      .from("attendance")
      .select("id,status,check_in_at,check_out_at,worked_minutes")
      .eq("employee_id", employeeId)
      .eq("attendance_date", todayStr())
      .maybeSingle();
    setRecord(data as TodayRecord | null);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);
  useEffect(() => { if (employeeId) void loadToday(); }, [employeeId, loadToday]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadToday();
    setRefreshing(false);
  }, [loadToday]);

  async function getLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Location permission is required to punch attendance.");
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return loc;
  }

  async function handleCheckIn() {
    setPunching(true);
    const loc = await getLocation();
    if (!loc) { setPunching(false); return; }

    const idempotencyKey = `checkin-${employeeId}-${todayStr()}`;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token ?? "";

    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiUrl}/api/attendance/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy_m: loc.coords.accuracy,
        device_time: new Date().toISOString(),
        idempotency_key: idempotencyKey,
      }),
    });

    const json = await res.json() as { error?: string; data?: { status: string; is_exception: boolean } };
    setPunching(false);

    if (json.error) { Alert.alert("Check-in failed", String(json.error)); return; }

    const msg = json.data?.is_exception
      ? "Checked in ✓\nNote: Location outside office radius — flagged for manager review."
      : `Checked in ✓ (${json.data?.status})`;
    Alert.alert("Success", msg);
    await loadToday();
  }

  async function handleCheckOut() {
    setPunching(true);
    const loc = await getLocation();
    if (!loc) { setPunching(false); return; }

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token ?? "";
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

    const res = await fetch(`${apiUrl}/api/attendance/check-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy_m: loc.coords.accuracy,
        device_time: new Date().toISOString(),
      }),
    });

    const json = await res.json() as { error?: string; data?: { worked_minutes: number; status: string } };
    setPunching(false);

    if (json.error) { Alert.alert("Check-out failed", String(json.error)); return; }
    Alert.alert("Checked out ✓", `Worked: ${fmtWorked(json.data?.worked_minutes ?? 0)} (${json.data?.status})`);
    await loadToday();
  }

  const hasIn = !!record?.check_in_at;
  const hasOut = !!record?.check_out_at;

  const statusColor: Record<string, string> = {
    PRESENT: "#16a34a", LATE: "#d97706", ABSENT: "#dc2626",
    HALF_DAY: "#9333ea", ON_LEAVE: "#2563eb",
  };

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Date card */}
      <View style={s.dateCard}>
        <Text style={s.dateLabel}>Today</Text>
        <Text style={s.dateValue}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </Text>
      </View>

      {/* Status card */}
      <View style={s.statusCard}>
        {loading ? (
          <ActivityIndicator color="#1a56db" />
        ) : (
          <>
            <View style={s.statusRow}>
              <Text style={s.statusLabel}>Status</Text>
              <View style={[s.pill, { backgroundColor: statusColor[record?.status ?? ""] ?? "#6b7280" }]}>
                <Text style={s.pillText}>{record?.status ?? "NOT MARKED"}</Text>
              </View>
            </View>

            <View style={s.timeRow}>
              <View style={s.timeBox}>
                <Text style={s.timeLabel}>Check-in</Text>
                <Text style={s.timeValue}>{hasIn ? fmtTime(record!.check_in_at!) : "—"}</Text>
              </View>
              <View style={s.timeDivider} />
              <View style={s.timeBox}>
                <Text style={s.timeLabel}>Check-out</Text>
                <Text style={s.timeValue}>{hasOut ? fmtTime(record!.check_out_at!) : "—"}</Text>
              </View>
              <View style={s.timeDivider} />
              <View style={s.timeBox}>
                <Text style={s.timeLabel}>Worked</Text>
                <Text style={s.timeValue}>
                  {record?.worked_minutes ? fmtWorked(record.worked_minutes) : "—"}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Punch button */}
      {!loading && (
        <View style={s.punchArea}>
          {!hasIn && (
            <TouchableOpacity style={[s.punchBtn, s.punchIn]} onPress={handleCheckIn} disabled={punching}>
              {punching ? <ActivityIndicator color="#fff" size="large" /> : (
                <>
                  <Text style={s.punchIcon}>✓</Text>
                  <Text style={s.punchText}>Check In</Text>
                  <Text style={s.punchSub}>Tap to record your arrival</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {hasIn && !hasOut && (
            <TouchableOpacity style={[s.punchBtn, s.punchOut]} onPress={handleCheckOut} disabled={punching}>
              {punching ? <ActivityIndicator color="#fff" size="large" /> : (
                <>
                  <Text style={s.punchIcon}>✗</Text>
                  <Text style={s.punchText}>Check Out</Text>
                  <Text style={s.punchSub}>Tap to record your departure</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {hasOut && (
            <View style={[s.punchBtn, s.punchDone]}>
              <Text style={s.punchIcon}>🎉</Text>
              <Text style={s.punchText}>Day Complete</Text>
              <Text style={s.punchSub}>See you tomorrow!</Text>
            </View>
          )}
        </View>
      )}

      <Text style={s.hint}>Your location is captured only at the moment of punch.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f3f4f6" },
  container: { padding: 16, gap: 16 },
  dateCard: { backgroundColor: "#1a56db", borderRadius: 12, padding: 16 },
  dateLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  dateValue: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 2 },
  statusCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 16 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  pill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  timeRow: { flexDirection: "row", justifyContent: "space-around" },
  timeBox: { alignItems: "center", flex: 1 },
  timeDivider: { width: 1, backgroundColor: "#e5e7eb" },
  timeLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  timeValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  punchArea: { alignItems: "center" },
  punchBtn: {
    width: 200, height: 200, borderRadius: 100,
    alignItems: "center", justifyContent: "center", gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  punchIn: { backgroundColor: "#16a34a" },
  punchOut: { backgroundColor: "#dc2626" },
  punchDone: { backgroundColor: "#6b7280" },
  punchIcon: { fontSize: 36, color: "#fff" },
  punchText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  punchSub: { fontSize: 11, color: "rgba(255,255,255,0.8)", textAlign: "center" },
  hint: { textAlign: "center", fontSize: 11, color: "#9ca3af" },
});
