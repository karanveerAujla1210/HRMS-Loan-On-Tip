import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, radius, shadows } from "../theme";
import type { ProfileRow } from "../types";

type HeaderProps = {
  profile: ProfileRow | null;
  onSignOut: () => void;
  onProfilePress: () => void;
};

export const Header: React.FC<HeaderProps> = ({ profile, onSignOut, onProfilePress }) => {
  const getInitials = (name?: string) => {
    if (!name) return "LT";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    return (name.slice(0, 2) ?? "LT").toUpperCase();
  };

  return (
    <View style={s.container}>
      {/* Web-aligned Brand Logo Mark */}
      <View style={s.brandRow}>
        <View style={s.brandMark}>
          <Text style={s.brandMarkText}>LT</Text>
        </View>
        <View>
          <Text style={s.brandTitle}>Loan On Tip</Text>
          <Text style={s.brandSub}>HRMS Mobile</Text>
        </View>
      </View>

      <View style={s.actions}>
        <TouchableOpacity 
          onPress={onProfilePress} 
          style={s.profileBtn}
          activeOpacity={0.7}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{getInitials(profile?.display_name)}</Text>
          </View>
          <Text style={s.nameText} numberOfLines={1}>
            {profile?.display_name ? profile.display_name.split(" ")[0] : "Account"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={onSignOut} 
          style={s.signOutBtn}
          activeOpacity={0.7}
        >
          <Text style={s.signOutText}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    paddingTop: 44,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  brandMarkText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  brandTitle: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 15,
  },
  brandSub: {
    color: colors.textMuted,
    fontSize: 11,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: "800",
  },
  nameText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 75,
  },
  signOutBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: "#fff0f0",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  signOutText: {
    color: colors.rose,
    fontSize: 11,
    fontWeight: "700",
  },
});
