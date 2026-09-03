import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { colors, radius, spacing, shadows } from "../theme";
import type { ProfileRow } from "../types";

type ProfileScreenProps = {
  profile: ProfileRow | null;
  onSignOut: () => void;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ profile, onSignOut }) => {
  const getInitials = (name?: string) => {
    if (!name) return "LT";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    return (name.slice(0, 2) ?? "LT").toUpperCase();
  };

  const fields: [string, string][] = profile
    ? [
        ["Full Display Name", profile.display_name],
        ["Employee Code", profile.employee_code],
        ["Official Email", profile.official_email],
        ["Department", profile.department],
        ["Designation", profile.designation],
        ["Work Location", profile.location],
        ["Joining Date", profile.joining_date],
      ]
    : [
        ["Full Display Name", "Karanveer Aujla"],
        ["Employee Code", "EMP-000042"],
        ["Official Email", "karanveer@loanontip.com"],
        ["Department", "Operations"],
        ["Designation", "Lead Architect"],
        ["Work Location", "Headquarters"],
        ["Joining Date", "2024-01-15"],
      ];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Profile Avatar Card */}
      <View style={s.profileCard}>
        <View style={s.avatarBig}>
          <Text style={s.avatarBigText}>{getInitials(profile?.display_name)}</Text>
        </View>
        <Text style={s.nameText}>{profile?.display_name ?? "Karanveer Aujla"}</Text>
        <Text style={s.designationText}>{profile?.designation ?? "Lead Architect"}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>{profile?.primary_role ?? "EMPLOYEE"}</Text>
        </View>
      </View>

      {/* Official Info List */}
      <Text style={s.sectionHeader}>Employment Information</Text>
      <View style={s.infoCard}>
        {fields.map(([label, val], idx) => (
          <View key={label} style={[s.infoRow, idx > 0 && s.borderTop]}>
            <Text style={s.infoLabel}>{label}</Text>
            <Text style={s.infoVal}>{val ?? "--"}</Text>
          </View>
        ))}
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={s.signOutBtn} onPress={onSignOut} activeOpacity={0.8}>
        <Text style={s.signOutBtnText}>🚪 Sign Out of Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  profileCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderColor: colors.border,
    borderWidth: 1,
    ...shadows.sm,
  },
  avatarBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  avatarBigText: {
    color: colors.brandDark,
    fontSize: 26,
    fontWeight: "900",
  },
  nameText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  designationText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  roleText: {
    color: colors.brandDark,
    fontSize: 11,
    fontWeight: "700",
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    ...shadows.sm,
  },
  infoRow: {
    paddingVertical: spacing.sm,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  infoVal: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  signOutBtn: {
    backgroundColor: "#fff0f0",
    borderColor: "#fecaca",
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  signOutBtnText: {
    color: colors.rose,
    fontSize: 14,
    fontWeight: "700",
  },
});
