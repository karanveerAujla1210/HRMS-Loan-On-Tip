import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { colors, radius, spacing, shadows } from "../theme";
import { supabasePost } from "../lib/api";
import type { Session } from "../types";

type LoginScreenProps = {
  onLoginSuccess: (session: Session) => void;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleLogin() {
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setErrorMsg("");

    try {
      const data = await supabasePost("/auth/v1/token?grant_type=password", {
        email: email.trim(),
        password,
      });

      if (data?.access_token) {
        onLoginSuccess({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user,
        });
      } else {
        throw new Error("Invalid credentials or access token missing.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemoUser(roleEmail: string) {
    setEmail(roleEmail);
    setPassword("Password123!");
    // Auto login demo for quick developer testing
    onLoginSuccess({
      access_token: "demo_access_token_token_123",
      user: { email: roleEmail },
    });
  }

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <View style={s.brandHeader}>
          <View style={s.brandMark}>
            <Text style={s.brandMarkText}>LT</Text>
          </View>
          <Text style={s.brandTitle}>Loan On Tip HRMS</Text>
          <Text style={s.brandSubtitle}>Employee Mobile Portal</Text>
        </View>

        {errorMsg ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={s.formGroup}>
          <Text style={s.label}>Official Email</Text>
          <TextInput
            style={s.input}
            placeholder="admin@loanontip.com"
            placeholderTextColor={colors.textDisabled}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={s.formGroup}>
          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••••••"
            placeholderTextColor={colors.textDisabled}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitBtnText}>Sign In to Mobile HRMS</Text>
          )}
        </TouchableOpacity>

        <View style={s.demoSection}>
          <Text style={s.demoTitle}>Quick Demo Sign-In (Click to Test):</Text>
          <View style={s.demoChips}>
            <TouchableOpacity style={s.chip} onPress={() => fillDemoUser("admin@loanontip.com")} activeOpacity={0.7}>
              <Text style={s.chipText}>Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.chip} onPress={() => fillDemoUser("hr@loanontip.com")} activeOpacity={0.7}>
              <Text style={s.chipText}>HR Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.chip} onPress={() => fillDemoUser("employee@loanontip.com")} activeOpacity={0.7}>
              <Text style={s.chipText}>Employee</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
    ...shadows.sm,
  },
  brandMarkText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  brandTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.rose,
    fontSize: 12,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.cardBgHover,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: spacing.xs,
    ...shadows.sm,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  demoSection: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  demoTitle: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    fontWeight: "700",
  },
  demoChips: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  chipText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: "700",
  },
});
