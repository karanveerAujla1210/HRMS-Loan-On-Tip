import { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";

type LeaveType = { id: string; name: string; code: string };
type LeaveBalance = { leave_type: string; balance: number };
type LeaveRequest = {
  id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  total_days: number;
  status: string;
  submitted_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#d97706", APPROVED: "#16a34a", REJECTED: "#dc2626", CANCELLED: "#6b7280",
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function LeaveScreen() {
  const insets = useSafeAreaInsets();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedType, setSelectedType] = useState("");
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("employee_id, company_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!prof?.employee_id) { setLoading(false); return; }
    setEmployeeId(prof.employee_id);
    setCompanyId(prof.company_id);

    const year = new Date().getFullYear();
    const [typesRes, balRes, reqRes] = await Promise.all([
      supabase.from("leave_types").select("id,name,code").eq("company_id", prof.company_id).eq("is_active", true),
      supabase.from("leave_balances")
        .select("closing_balance,leave_types(name)")
        .eq("employee_id", prof.employee_id)
        .eq("year", year),
      supabase.from("leave_requests")
        .select("id,from_date,to_date,total_days,status,submitted_at,leave_types(name)")
        .eq("employee_id", prof.employee_id)
        .order("submitted_at", { ascending: false })
        .limit(30),
    ]);

    setLeaveTypes((typesRes.data as LeaveType[]) ?? []);

    const bal = ((balRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      leave_type: (r.leave_types as { name: string } | null)?.name ?? "—",
      balance: Number(r.closing_balance),
    }));
    setBalances(bal);

    const reqs = ((reqRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      leave_type: (r.leave_types as { name: string } | null)?.name ?? "—",
      from_date: String(r.from_date),
      to_date: String(r.to_date),
      total_days: Number(r.total_days),
      status: String(r.status),
      submitted_at: String(r.submitted_at),
    }));
    setRequests(reqs);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function submitLeave() {
    if (!employeeId || !selectedType || !fromDate || !toDate) {
      Alert.alert("Missing fields", "Please fill all required fields.");
      return;
    }
    const days = Math.max(1, Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1);
    setSubmitting(true);
    const { error } = await supabase.from("leave_requests").insert({
      employee_id: employeeId,
      leave_type_id: selectedType,
      from_date: fromDate,
      to_date: toDate,
      total_days: days,
      reason: reason || null,
      status: "PENDING",
    });
    setSubmitting(false);
    if (error) { Alert.alert("Error", error.message); return; }
    Alert.alert("Success", "Leave request submitted successfully.");
    setShowForm(false);
    setSelectedType("");
    setFromDate(todayStr());
    setToDate(todayStr());
    setReason("");
    void load();
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#1a56db" />;

  return (
    <View style={[s.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        style={s.list}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        data={requests}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Balances */}
            {balances.length > 0 && (
              <View style={s.balanceCard}>
                <Text style={s.sectionTitle}>Leave Balances</Text>
                <View style={s.balanceRow}>
                  {balances.map((b, i) => (
                    <View key={i} style={s.balanceItem}>
                      <Text style={s.balanceValue}>{b.balance.toFixed(1)}</Text>
                      <Text style={s.balanceLabel}>{b.leave_type}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <Text style={[s.sectionTitle, { marginBottom: 8 }]}>My Requests</Text>
          </>
        }
        ListEmptyComponent={<Text style={s.empty}>No leave requests yet.</Text>}
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowType}>{item.leave_type}</Text>
              <Text style={s.rowDates}>{item.from_date} → {item.to_date} ({item.total_days}d)</Text>
            </View>
            <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] ?? "#6b7280" }]}>
              <Text style={s.badgeText}>{item.status}</Text>
            </View>
          </View>
        )}
      />

      {/* Apply button */}
      <TouchableOpacity style={[s.fab, { bottom: insets.bottom + 16 }]} onPress={() => setShowForm(true)}>
        <Text style={s.fabText}>+ Apply Leave</Text>
      </TouchableOpacity>

      {/* Apply Leave Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={s.modal} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
          <Text style={s.modalTitle}>Apply for Leave</Text>

          <Text style={s.label}>Leave Type *</Text>
          <View style={s.pickerWrap}>
            {leaveTypes.map((lt) => (
              <TouchableOpacity
                key={lt.id}
                style={[s.typeBtn, selectedType === lt.id && s.typeBtnActive]}
                onPress={() => setSelectedType(lt.id)}
              >
                <Text style={[s.typeBtnText, selectedType === lt.id && s.typeBtnTextActive]}>
                  {lt.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>From Date *</Text>
          <TextInput
            style={s.input}
            value={fromDate}
            onChangeText={setFromDate}
            placeholder="YYYY-MM-DD"
          />

          <Text style={s.label}>To Date *</Text>
          <TextInput
            style={s.input}
            value={toDate}
            onChangeText={setToDate}
            placeholder="YYYY-MM-DD"
          />

          <Text style={s.label}>Reason</Text>
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: "top" }]}
            value={reason}
            onChangeText={setReason}
            placeholder="Reason for leave..."
            multiline
          />

          <TouchableOpacity style={s.submitBtn} onPress={submitLeave} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitBtnText}>Submit Request</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  list: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  balanceCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 },
  balanceRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  balanceItem: { alignItems: "center", minWidth: 70 },
  balanceValue: { fontSize: 22, fontWeight: "800", color: "#1a56db" },
  balanceLabel: { fontSize: 11, color: "#6b7280", marginTop: 2, textAlign: "center" },
  row: {
    backgroundColor: "#fff", borderRadius: 10, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  rowLeft: { gap: 4, flex: 1 },
  rowType: { fontSize: 14, fontWeight: "700", color: "#111827" },
  rowDates: { fontSize: 12, color: "#6b7280" },
  badge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
  fab: {
    position: "absolute", right: 16,
    backgroundColor: "#1a56db", borderRadius: 28,
    paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    padding: 12, fontSize: 14, marginBottom: 16, color: "#111",
  },
  pickerWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeBtn: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  typeBtnActive: { borderColor: "#1a56db", backgroundColor: "#eff6ff" },
  typeBtnText: { fontSize: 13, color: "#374151" },
  typeBtnTextActive: { color: "#1a56db", fontWeight: "700" },
  submitBtn: {
    backgroundColor: "#1a56db", borderRadius: 8,
    padding: 14, alignItems: "center", marginTop: 8,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn: { padding: 14, alignItems: "center", marginTop: 8 },
  cancelBtnText: { color: "#6b7280", fontSize: 14 },
});
