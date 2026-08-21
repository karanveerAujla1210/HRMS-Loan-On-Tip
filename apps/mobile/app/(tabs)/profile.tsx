import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";

type Profile = { display_name: string; official_email: string; employee_code: string; department: string };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("employee_id, company_id")
        .eq("auth_user_id", user.id)
        .single();
      if (!data?.employee_id) { setLoading(false); return; }
      const { data: emp } = await supabase
        .from("employees")
        .select("display_name, official_email, employee_code, departments(name)")
        .eq("id", data.employee_id)
        .single();
      if (emp) {
        setProfile({
          display_name: emp.display_name,
          official_email: emp.official_email,
          employee_code: emp.employee_code,
          department: (emp.departments as { name: string } | null)?.name ?? "—",
        });
      }
      setLoading(false);
    })();
  }, []);

  async function signOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#1a56db" />;

  return (
    <View style={[s.container, { paddingBottom: insets.bottom + 24 }]}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{profile?.display_name?.charAt(0).toUpperCase() ?? "?"}</Text>
      </View>
      <Text style={s.name}>{profile?.display_name ?? "—"}</Text>
      <Text style={s.email}>{profile?.official_email ?? "—"}</Text>

      <View style={s.card}>
        <Row label="Employee Code" value={profile?.employee_code ?? "—"} />
        <Row label="Department" value={profile?.department ?? "—"} />
      </View>

      <TouchableOpacity style={s.signOut} onPress={signOut}>
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6", alignItems: "center", padding: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#1a56db",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  email: { fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 12, width: "100%", overflow: "hidden", marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  rowLabel: { fontSize: 13, color: "#6b7280" },
  rowValue: { fontSize: 13, fontWeight: "600", color: "#111827" },
  signOut: { backgroundColor: "#dc2626", borderRadius: 8, paddingVertical: 14, paddingHorizontal: 40 },
  signOutText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
