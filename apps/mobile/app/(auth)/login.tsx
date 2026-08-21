import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { supabase } from "../../services/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  async function sendOtp() {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setStep("otp");
  }

  async function verifyOtp() {
    if (!otp.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) Alert.alert("Invalid code", error.message);
    // on success, root layout redirects to tabs automatically
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.card}>
        <Text style={s.brand}>ACG Leasing</Text>
        <Text style={s.title}>Employee Login</Text>

        {step === "email" ? (
          <>
            <Text style={s.label}>Work email</Text>
            <TextInput
              style={s.input}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={sendOtp}
            />
            <TouchableOpacity style={s.btn} onPress={sendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.label}>Enter the 6-digit code sent to {email}</Text>
            <TextInput
              style={s.input}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              onSubmitEditing={verifyOtp}
              autoFocus
            />
            <TouchableOpacity style={s.btn} onPress={verifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify & Sign in</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep("email")} style={s.back}>
              <Text style={s.backText}>← Change email</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a56db", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28 },
  brand: { fontSize: 13, fontWeight: "600", color: "#1a56db", letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 24 },
  label: { fontSize: 13, color: "#555", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    padding: 12, fontSize: 15, marginBottom: 16, color: "#111",
  },
  btn: { backgroundColor: "#1a56db", borderRadius: 8, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  back: { marginTop: 14, alignItems: "center" },
  backText: { color: "#1a56db", fontSize: 13 },
});
