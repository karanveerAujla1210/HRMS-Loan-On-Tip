import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { colors, radius, spacing, shadows } from "../theme";
import { MetricCard } from "../components/MetricCard";
import { dbGet } from "../lib/api";
import type { Session, ProfileRow, AttendanceRow, LeaveBalanceRow, TabType } from "../types";

type DashboardScreenProps = {
  session: Session;
  profile: ProfileRow | null;
  onNavigate: (tab: TabType) => void;
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ session, profile, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const loadDashboardData = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const [att, bal, appr] = await Promise.all([
        dbGet<AttendanceRow>(
          "attendance",
          `select=id,attendance_date,check_in_time,check_out_time,status&attendance_date=eq.${todayStr}&limit=1`,
          session.access_token
        ),
        dbGet<LeaveBalanceRow>(
          "v_leave_balances",
          "select=id,leave_type_name,opening_balance,accrued,used,closing_balance&limit=3",
          session.access_token
        ),
        dbGet<Record<string, unknown>>(
          "leave_requests",
          "select=id&status=eq.PENDING&limit=10",
          session.access_token
        ),
      ]);

      setTodayAttendance(att[0] ?? null);
      setLeaveBalances(bal);
      setPendingApprovalsCount(appr.length);
    } catch {
      /* silent catch */
    }
  }, [session.access_token]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good Morning";
    if (hrs < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Welcome Banner */}
      <View style={s.welcomeCard}>
        <View>
          <Text style={s.greetingText}>{getGreeting()},</Text>
          <Text style={s.nameText}>{profile?.display_name ?? "Team Member"}</Text>
          <Text style={s.roleText}>
            {profile?.designation ?? "Software Engineer"} • {profile?.department ?? "Operations"}
          </Text>
        </View>
        <TouchableOpacity style={s.idCardBadge} onPress={() => onNavigate("id-card")} activeOpacity={0.7}>
          <Text style={s.idCardBadgeText}>🪪 Digital ID</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <Text style={s.sectionHeader}>Overview Metrics</Text>
      <View style={s.metricsGrid}>
        <MetricCard
          title="Today Status"
          value={todayAttendance?.status ?? "NOT PUNCHED"}
          subtitle={todayAttendance?.check_in_time ? `In: ${todayAttendance.check_in_time.slice(0, 5)}` : "Tap to Check-in"}
          icon="⏱️"
          color={todayAttendance?.check_in_time ? colors.mint : colors.amber}
          onPress={() => onNavigate("attendance")}
        />
        <MetricCard
          title="Leave Balance"
          value={leaveBalances.reduce((sum, b) => sum + (b.closing_balance ?? 0), 12)}
          subtitle="Days Remaining"
          icon="📅"
          color={colors.blue}
          onPress={() => onNavigate("leave")}
        />
      </View>

      {/* Quick Punch Action Card */}
      <View style={s.punchCard}>
        <View style={s.punchLeft}>
          <Text style={s.punchTitle}>Geo Clock-In / Out</Text>
          <Text style={s.punchSub}>
            {todayAttendance?.check_in_time
              ? `Punched in at ${todayAttendance.check_in_time.slice(0, 5)}`
              : "Capture your location and clock in today"}
          </Text>
        </View>
        <TouchableOpacity style={s.punchBtn} onPress={() => onNavigate("attendance")} activeOpacity={0.8}>
          <Text style={s.punchBtnText}>
            {todayAttendance?.check_in_time && !todayAttendance.check_out_time ? "Check Out" : "Clock In"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Shortcuts */}
      <Text style={s.sectionHeader}>Quick Actions</Text>
      <View style={s.actionsGrid}>
        <TouchableOpacity style={s.actionItem} onPress={() => onNavigate("leave")} activeOpacity={0.7}>
          <View style={[s.actionIcon, { backgroundColor: colors.blue + "18" }]}>
            <Text style={s.actionIconText}>📝</Text>
          </View>
          <Text style={s.actionLabel}>Apply Leave</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionItem} onPress={() => onNavigate("expenses")} activeOpacity={0.7}>
          <View style={[s.actionIcon, { backgroundColor: colors.amber + "18" }]}>
            <Text style={s.actionIconText}>🧾</Text>
          </View>
          <Text style={s.actionLabel}>Claim Expense</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionItem} onPress={() => onNavigate("payroll")} activeOpacity={0.7}>
          <View style={[s.actionIcon, { backgroundColor: colors.mint + "18" }]}>
            <Text style={s.actionIconText}>💵</Text>
          </View>
          <Text style={s.actionLabel}>Payslips</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionItem} onPress={() => onNavigate("directory")} activeOpacity={0.7}>
          <View style={[s.actionIcon, { backgroundColor: colors.purple + "18" }]}>
            <Text style={s.actionIconText}>👥</Text>
          </View>
          <Text style={s.actionLabel}>Directory</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Approvals Summary */}
      {pendingApprovalsCount > 0 ? (
        <View style={s.approvalAlertCard}>
          <View style={s.approvalLeft}>
            <Text style={s.approvalTitle}>Manager Approvals</Text>
            <Text style={s.approvalSub}>{pendingApprovalsCount} pending requests require review</Text>
          </View>
          <TouchableOpacity style={s.approvalBtn} onPress={() => onNavigate("approvals")} activeOpacity={0.8}>
            <Text style={s.approvalBtnText}>Review</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
  welcomeCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...shadows.sm,
  },
  greetingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  nameText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  roleText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  idCardBadge: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  idCardBadgeText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  punchCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...shadows.sm,
  },
  punchLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  punchTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  punchSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  punchBtn: {
    backgroundColor: colors.mint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  punchBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  actionItem: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    flex: 1,
    ...shadows.sm,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  actionIconText: {
    fontSize: 18,
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  approvalAlertCard: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  approvalLeft: {
    flex: 1,
  },
  approvalTitle: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "700",
  },
  approvalSub: {
    color: "#78350f",
    fontSize: 11,
    marginTop: 2,
  },
  approvalBtn: {
    backgroundColor: colors.amber,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  approvalBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
