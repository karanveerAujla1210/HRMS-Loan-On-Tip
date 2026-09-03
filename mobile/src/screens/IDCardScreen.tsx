import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors, radius, spacing, shadows } from "../theme";
import type { ProfileRow } from "../types";

type IDCardScreenProps = {
  profile: ProfileRow | null;
};

export const IDCardScreen: React.FC<IDCardScreenProps> = ({ profile }) => {
  const getInitials = (name?: string) => {
    if (!name) return "LT";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    return (name.slice(0, 2) ?? "LT").toUpperCase();
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.headerTitle}>Digital Employee ID Card</Text>

      <View style={s.idCardContainer}>
        {/* Top Branding */}
        <View style={s.cardHeader}>
          <View style={s.brandMark}>
            <Text style={s.brandMarkText}>LT</Text>
          </View>
          <View>
            <Text style={s.companyName}>LOAN ON TIP</Text>
            <Text style={s.companyTagline}>Official Employee Identity</Text>
          </View>
        </View>

        {/* Photo Avatar */}
        <View style={s.photoSection}>
          <View style={s.photoRing}>
            <Text style={s.photoText}>{getInitials(profile?.display_name)}</Text>
          </View>
          <Text style={s.empName}>{profile?.display_name ?? "Karanveer Aujla"}</Text>
          <Text style={s.empDesignation}>{profile?.designation ?? "Lead Architect"}</Text>
        </View>

        {/* Employee Details Grid */}
        <View style={s.detailsGrid}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Employee ID</Text>
            <Text style={s.detailVal}>{profile?.employee_code ?? "EMP-000042"}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Department</Text>
            <Text style={s.detailVal}>{profile?.department ?? "Operations"}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Official Email</Text>
            <Text style={s.detailVal}>{profile?.official_email ?? "karanveer@loanontip.com"}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Work Location</Text>
            <Text style={s.detailVal}>{profile?.location ?? "Headquarters"}</Text>
          </View>
        </View>

        {/* QR Code Clearance */}
        <View style={s.qrSection}>
          <View style={s.qrBox}>
            <Text style={s.qrText}>[ QR VERIFICATION ]</Text>
            <Text style={s.qrSub}>{profile?.employee_code ?? "EMP-000042"}</Text>
          </View>
          <Text style={s.verifyNote}>Scan QR code for instant office building access</Text>
        </View>
      </View>
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
    alignItems: "center",
    gap: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    alignSelf: "flex-start",
  },
  idCardContainer: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.cardBg,
    borderColor: colors.brand,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  brandMarkText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
  },
  companyName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  companyTagline: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "600",
  },
  photoSection: {
    alignItems: "center",
    marginVertical: spacing.xs,
  },
  photoRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  photoText: {
    color: colors.brandDark,
    fontSize: 30,
    fontWeight: "900",
  },
  empName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  empDesignation: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  detailsGrid: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
    borderColor: colors.border,
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  detailVal: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  qrSection: {
    alignItems: "center",
    gap: spacing.xs,
  },
  qrBox: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  qrText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  qrSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  verifyNote: {
    color: colors.textMuted,
    fontSize: 10,
    fontStyle: "italic",
  },
});
