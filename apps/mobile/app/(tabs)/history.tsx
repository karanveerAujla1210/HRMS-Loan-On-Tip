import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";

type AttRow = {
  attendance_date: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
};

const STATUS_COLOR: Record<string, string> = {
  PRESENT: "#16a34a", LATE: "#d97706", ABSENT: "#dc2626",
  HALF_DAY: "#9333ea", ON_LEAVE: "#2563eb",
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("employee_id").eq("auth_user_id", user.id).single();
    if (!profile?.employee_id) return;

    const monthStart = new Date();
    monthStart.setDate(1);
    const { data } = await supabase
      .from("attendance")
      .select("attendance_date,status,check_in_at,check_out_at,worked_minutes")
      .eq("employee_id", profile.employee_id)
      .gte("attendance_date", monthStart.toISOString().slice(0, 10))
      .order("attendance_date", { ascending: false });

    setRows((data as AttRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#1a56db" />;

  return (
    <FlatList
      style={s.list}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16, padding: 16, gap: 8 }}
      data={rows}
      keyExtractor={(r) => r.attendance_date}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={s.empty}>No records this month.</Text>}
      renderItem={({ item }) => (
        <View style={s.row}>
          <View style={s.left}>
            <Text style={s.date}>{new Date(item.attendance_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}</Text>
            <Text style={s.times}>{fmtTime(item.check_in_at)} → {fmtTime(item.check_out_at)}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] ?? "#6b7280" }]}>
            <Text style={s.badgeText}>{item.status}</Text>
          </View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#f3f4f6" },
  row: {
    backgroundColor: "#fff", borderRadius: 10, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  left: { gap: 4 },
  date: { fontSize: 14, fontWeight: "700", color: "#111827" },
  times: { fontSize: 12, color: "#6b7280" },
  badge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
});
