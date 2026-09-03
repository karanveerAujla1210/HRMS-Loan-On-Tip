"use client";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View, RefreshControl, Alert,
} from "react-native";
import { supabasePost, apiPost, dbGet, type Session } from "./lib/supabase";

const SESSION_KEY = "lot_session_v2";

type Screen = "login" | "home" | "checkin" | "leave" | "payslips" | "profile";

type AttendanceRow = { attendance_date: string; status: string; check_in_at: string | null; check_out_at: string | null; worked_minutes: number | null };
type PayslipRow = { id: string; payslip_number: string; gross_salary: number; net_salary: number; generated_at: string };
type LeaveRow = { id: string; from_date: string; to_date: string; total_days: number; status: string };
type ProfileRow = { display_name: string; employee_code: string; official_email: string; department: string; designation: string; location: string; joining_date: string };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY).then((v) => {
      if (v) { setSession(JSON.parse(v) as Session); setScreen("home"); }
    });
  }, []);

  async function signIn() {
    if (!email.trim() || !password) { setMsg("Enter email and password."); return; }
    setBusy(true); setMsg("");
    try {
      const s = await supabasePost("/auth/v1/token?grant_type=password", { email: email.trim(), password }) as Session;
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s));
      setSession(s); setScreen("home");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null); setScreen("login"); setEmail(""); setPassword("");
  }

  if (!session || screen === "login") {
    return (
      <SafeAreaView style={s.screen}>
        <StatusBar style="light" />
        <View style={s.header}>
          <Text style={s.brand}>Loan On Tip</Text>
          <Text style={s.caption}>HRMS · Employee App</Text>
        </View>
        <View style={s.card}>
          <Text style={s.title}>Sign in</Text>
          <Text style={s.sub}>Use your work email and password</Text>
          <TextInput style={s.input} placeholder="Work email" placeholderTextColor="#91a4b7"
            autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={s.input} placeholder="Password" placeholderTextColor="#91a4b7"
            secureTextEntry value={password} onChangeText={setPassword} />
          {!!msg && <Text style={s.err}>{msg}</Text>}
          <Pressable style={s.btn} onPress={signIn} disabled={busy}>
            <Text style={s.btnTxt}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="light" />
      {screen === "home"     && <HomeScreen     session={session} onNav={setScreen} onSignOut={signOut} />}
      {screen === "checkin"  && <CheckInScreen  session={session} onBack={() => setScreen("home")} />}
      {screen === "leave"    && <LeaveScreen    session={session} onBack={() => setScreen("home")} />}
      {screen === "payslips" && <PayslipsScreen session={session} onBack={() => setScreen("home")} />}
      {screen === "profile"  && <ProfileScreen  session={session} onBack={() => setScreen("home")} onSignOut={signOut} />}
    </SafeAreaView>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
function HomeScreen({ session, onNav, onSignOut }: { session: Session; onNav: (s: Screen) => void; onSignOut: () => void }) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      const data = await dbGet(
        "v_attendance",
        `select=attendance_date,status,check_in_at,check_out_at,worked_minutes&attendance_date=gte.${from}&attendance_date=lte.${today}&order=attendance_date.desc&limit=7`,
        session.access_token
      ) as AttendanceRow[];
      setRows(data);
    } catch { /* silent */ }
    setRefreshing(false);
  }, [session.access_token]);

  useEffect(() => { void load(); }, [load]);

  const todayRow = rows[0];
  const checkedIn = !!todayRow?.check_in_at;
  const checkedOut = !!todayRow?.check_out_at;

  return (
    <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#2d8cff" />}>
      <View style={s.header}>
        <Text style={s.brand}>Loan On Tip HRMS</Text>
        <Text style={s.caption}>{session.user?.email ?? ""}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.title}>Today</Text>
        <View style={s.statusRow}>
          <View style={[s.dot, checkedIn && !checkedOut && s.dotOn, checkedOut && s.dotDone]} />
          <Text style={s.statusTxt}>
            {checkedOut ? "Checked out" : checkedIn ? "Checked in" : "Not checked in"}
          </Text>
        </View>
        {todayRow?.check_in_at && <Text style={s.meta}>In: {new Date(todayRow.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>}
        {todayRow?.check_out_at && <Text style={s.meta}>Out: {new Date(todayRow.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {Math.round((todayRow.worked_minutes ?? 0) / 60 * 10) / 10}h worked</Text>}
        <Pressable style={s.btn} onPress={() => onNav("checkin")}>
          <Text style={s.btnTxt}>📍 Attendance</Text>
        </Pressable>
      </View>

      <View style={s.grid}>
        {([
          { label: "Apply Leave", icon: "🗓", screen: "leave" },
          { label: "Payslips", icon: "💰", screen: "payslips" },
          { label: "Profile", icon: "👤", screen: "profile" },
        ] as { label: string; icon: string; screen: Screen }[]).map((item) => (
          <Pressable key={item.screen} style={s.tile} onPress={() => onNav(item.screen)}>
            <Text style={s.tileIcon}>{item.icon}</Text>
            <Text style={s.tileLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.sectionTitle}>Last 7 days</Text>
      {rows.map((r) => (
        <View key={r.attendance_date} style={s.row}>
          <Text style={s.rowDate}>{r.attendance_date}</Text>
          <View style={[s.badge, { backgroundColor: statusColor(r.status) }]}>
            <Text style={s.badgeTxt}>{r.status.replace(/_/g, " ")}</Text>
          </View>
        </View>
      ))}
      {rows.length === 0 && <Text style={s.empty}>No attendance records yet.</Text>}
    </ScrollView>
  );
}

// ── Check In/Out ──────────────────────────────────────────────────────────────
function CheckInScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState("");

  async function punch(type: "check-in" | "check-out") {
    setBusy(true); setMsg(""); setSuccess("");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") throw new Error("Location permission required.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await apiPost(`/api/attendance/${type}`, session.access_token, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? null,
        source: "MOBILE",
        is_mock_location: false,
      });
      setSuccess(type === "check-in" ? "Checked in successfully!" : "Checked out successfully!");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView style={s.scroll}>
      <View style={s.navBar}>
        <Pressable onPress={onBack}><Text style={s.back}>← Back</Text></Pressable>
        <Text style={s.navTitle}>Attendance</Text>
      </View>
      <View style={s.card}>
        <Text style={s.title}>Mark Attendance</Text>
        <Text style={s.sub}>Your location will be captured for verification.</Text>
        {!!success && <Text style={s.ok}>{success}</Text>}
        {!!msg && <Text style={s.err}>{msg}</Text>}
        {busy && <ActivityIndicator color="#2d8cff" style={{ marginVertical: 12 }} />}
        <Pressable style={s.btn} onPress={() => void punch("check-in")} disabled={busy}>
          <Text style={s.btnTxt}>📍 Check In</Text>
        </Pressable>
        <Pressable style={[s.btn, s.btnSecondary]} onPress={() => void punch("check-out")} disabled={busy}>
          <Text style={s.btnSecTxt}>🏁 Check Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Leave ─────────────────────────────────────────────────────────────────────
function LeaveScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; name: string }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeId, setTypeId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    try {
      const [lv, lt] = await Promise.all([
        dbGet("leave_requests", "select=id,from_date,to_date,total_days,status&order=submitted_at.desc&limit=10", session.access_token),
        dbGet("leave_types", "select=id,name&is_active=eq.true&order=name", session.access_token),
      ]);
      setLeaves(lv as LeaveRow[]);
      setLeaveTypes(lt as { id: string; name: string }[]);
      if ((lt as { id: string }[]).length > 0) setTypeId((lt as { id: string }[])[0].id);
    } catch { /* silent */ }
  }, [session.access_token]);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!from || !to || !typeId) { setMsg("Fill all fields."); return; }
    setBusy(true); setMsg(""); setOk("");
    try {
      await apiPost("/api/leaves", session.access_token, { leave_type_id: typeId, from_date: from, to_date: to, reason });
      setOk("Leave request submitted!"); setFrom(""); setTo(""); setReason("");
      void load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView style={s.scroll}>
      <View style={s.navBar}>
        <Pressable onPress={onBack}><Text style={s.back}>← Back</Text></Pressable>
        <Text style={s.navTitle}>Leave</Text>
      </View>
      <View style={s.card}>
        <Text style={s.title}>Apply for Leave</Text>
        {!!ok && <Text style={s.ok}>{ok}</Text>}
        {!!msg && <Text style={s.err}>{msg}</Text>}
        <Text style={s.label}>Leave Type</Text>
        <View style={s.picker}>
          {leaveTypes.map((lt) => (
            <Pressable key={lt.id} style={[s.chip, typeId === lt.id && s.chipActive]} onPress={() => setTypeId(lt.id)}>
              <Text style={[s.chipTxt, typeId === lt.id && s.chipActiveTxt]}>{lt.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>From Date (YYYY-MM-DD)</Text>
        <TextInput style={s.input} placeholder="2025-01-15" placeholderTextColor="#91a4b7" value={from} onChangeText={setFrom} />
        <Text style={s.label}>To Date (YYYY-MM-DD)</Text>
        <TextInput style={s.input} placeholder="2025-01-15" placeholderTextColor="#91a4b7" value={to} onChangeText={setTo} />
        <Text style={s.label}>Reason (optional)</Text>
        <TextInput style={[s.input, { height: 80 }]} placeholder="Reason for leave…" placeholderTextColor="#91a4b7" multiline value={reason} onChangeText={setReason} />
        <Pressable style={s.btn} onPress={submit} disabled={busy}>
          <Text style={s.btnTxt}>{busy ? "Submitting…" : "Submit Request"}</Text>
        </Pressable>
      </View>
      <Text style={s.sectionTitle}>My Leave History</Text>
      {leaves.map((l) => (
        <View key={l.id} style={s.row}>
          <Text style={s.rowDate}>{l.from_date} → {l.to_date} ({l.total_days}d)</Text>
          <View style={[s.badge, { backgroundColor: statusColor(l.status) }]}>
            <Text style={s.badgeTxt}>{l.status}</Text>
          </View>
        </View>
      ))}
      {leaves.length === 0 && <Text style={s.empty}>No leave requests yet.</Text>}
    </ScrollView>
  );
}

// ── Payslips ──────────────────────────────────────────────────────────────────
function PayslipsScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [slips, setSlips] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGet("payslips", "select=id,payslip_number,gross_salary,net_salary,generated_at&order=generated_at.desc&limit=12", session.access_token)
      .then((d) => setSlips(d as PayslipRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session.access_token]);

  return (
    <ScrollView style={s.scroll}>
      <View style={s.navBar}>
        <Pressable onPress={onBack}><Text style={s.back}>← Back</Text></Pressable>
        <Text style={s.navTitle}>Payslips</Text>
      </View>
      {loading && <ActivityIndicator color="#2d8cff" style={{ marginTop: 40 }} />}
      {!loading && slips.length === 0 && <Text style={s.empty}>No payslips available yet.</Text>}
      {slips.map((p) => (
        <View key={p.id} style={s.card}>
          <Text style={s.title}>{p.payslip_number}</Text>
          <Text style={s.meta}>Generated: {new Date(p.generated_at).toLocaleDateString("en-IN")}</Text>
          <View style={s.payRow}>
            <View>
              <Text style={s.payLabel}>Gross</Text>
              <Text style={s.payAmt}>₹{Number(p.gross_salary).toLocaleString("en-IN")}</Text>
            </View>
            <View>
              <Text style={s.payLabel}>Net Take-Home</Text>
              <Text style={[s.payAmt, { color: "#37d58a" }]}>₹{Number(p.net_salary).toLocaleString("en-IN")}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function ProfileScreen({ session, onBack, onSignOut }: { session: Session; onBack: () => void; onSignOut: () => void }) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    dbGet("v_employee_directory", "select=display_name,employee_code,official_email,department,designation,location,joining_date&limit=1", session.access_token)
      .then((d) => { if ((d as ProfileRow[]).length > 0) setProfile((d as ProfileRow[])[0]); })
      .catch(() => {});
  }, [session.access_token]);

  const fields: [string, string][] = profile ? [
    ["Name", profile.display_name],
    ["Employee Code", profile.employee_code],
    ["Email", profile.official_email],
    ["Department", profile.department],
    ["Designation", profile.designation],
    ["Location", profile.location],
    ["Joining Date", profile.joining_date],
  ] : [];

  return (
    <ScrollView style={s.scroll}>
      <View style={s.navBar}>
        <Pressable onPress={onBack}><Text style={s.back}>← Back</Text></Pressable>
        <Text style={s.navTitle}>Profile</Text>
      </View>
      <View style={s.card}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{(profile?.display_name ?? session.user?.email ?? "?").slice(0, 2).toUpperCase()}</Text>
        </View>
        {!profile && <ActivityIndicator color="#2d8cff" style={{ marginTop: 20 }} />}
        {fields.map(([label, value]) => (
          <View key={label} style={s.fieldRow}>
            <Text style={s.fieldLabel}>{label}</Text>
            <Text style={s.fieldValue}>{value ?? "—"}</Text>
          </View>
        ))}
      </View>
      <Pressable style={[s.btn, s.btnDanger, { margin: 20 }]} onPress={onSignOut}>
        <Text style={s.btnTxt}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "PRESENT": return "#1a4731";
    case "ABSENT": return "#4a1a1a";
    case "LATE": return "#4a3a1a";
    case "HALF_DAY": return "#2a1a4a";
    case "ON_LEAVE": return "#1a2a4a";
    case "APPROVED": return "#1a4731";
    case "PENDING": return "#4a3a1a";
    case "REJECTED": return "#4a1a1a";
    default: return "#1e3a4a";
  }
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#071521" },
  scroll:       { flex: 1, backgroundColor: "#071521" },
  header:       { padding: 24, paddingTop: 36 },
  brand:        { color: "#fff", fontSize: 26, fontWeight: "800" },
  caption:      { color: "#8fa7bb", fontSize: 13, marginTop: 4 },
  card:         { backgroundColor: "#102536", borderRadius: 16, padding: 20, margin: 16, marginTop: 8 },
  title:        { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 6 },
  sub:          { color: "#9db1c2", fontSize: 13, marginBottom: 16 },
  input:        { backgroundColor: "#193449", color: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 15 },
  label:        { color: "#8fa7bb", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  btn:          { backgroundColor: "#2d8cff", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 10 },
  btnTxt:       { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#49677e" },
  btnSecTxt:    { color: "#b7cad8", fontSize: 15, fontWeight: "600" },
  btnDanger:    { backgroundColor: "#c0392b" },
  err:          { color: "#ff6b6b", fontSize: 13, marginBottom: 10, textAlign: "center" },
  ok:           { color: "#37d58a", fontSize: 13, marginBottom: 10, textAlign: "center" },
  statusRow:    { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  dot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: "#f2a93b", marginRight: 10 },
  dotOn:        { backgroundColor: "#2d8cff" },
  dotDone:      { backgroundColor: "#37d58a" },
  statusTxt:    { color: "#fff", fontSize: 15 },
  meta:         { color: "#8fa7bb", fontSize: 12, marginBottom: 4 },
  grid:         { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  tile:         { flex: 1, minWidth: "30%", backgroundColor: "#102536", borderRadius: 14, padding: 16, alignItems: "center" },
  tileIcon:     { fontSize: 28, marginBottom: 6 },
  tileLabel:    { color: "#b7cad8", fontSize: 12, fontWeight: "600", textAlign: "center" },
  sectionTitle: { color: "#8fa7bb", fontSize: 12, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, textTransform: "uppercase" },
  row:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#102536" },
  rowDate:      { color: "#b7cad8", fontSize: 13, flex: 1 },
  badge:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt:     { color: "#fff", fontSize: 11, fontWeight: "700" },
  empty:        { color: "#49677e", textAlign: "center", padding: 30, fontSize: 14 },
  navBar:       { flexDirection: "row", alignItems: "center", padding: 16, paddingTop: 20, gap: 12 },
  back:         { color: "#2d8cff", fontSize: 15, fontWeight: "600" },
  navTitle:     { color: "#fff", fontSize: 17, fontWeight: "700" },
  picker:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip:         { borderWidth: 1, borderColor: "#49677e", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive:   { backgroundColor: "#2d8cff", borderColor: "#2d8cff" },
  chipTxt:      { color: "#8fa7bb", fontSize: 13 },
  chipActiveTxt:{ color: "#fff" },
  payRow:       { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  payLabel:     { color: "#8fa7bb", fontSize: 11, fontWeight: "600" },
  payAmt:       { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: "#2d8cff", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 },
  avatarTxt:    { color: "#fff", fontSize: 26, fontWeight: "800" },
  fieldRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#193449" },
  fieldLabel:   { color: "#8fa7bb", fontSize: 13 },
  fieldValue:   { color: "#fff", fontSize: 13, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
});
