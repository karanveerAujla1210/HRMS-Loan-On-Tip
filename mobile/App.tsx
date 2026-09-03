import React, { useState, useEffect } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import { colors } from "./src/theme";
import type { Session, ProfileRow, TabType } from "./src/types";
import { dbGet } from "./src/lib/api";

// Components & Screens
import { Header } from "./src/components/Header";
import { BottomNav } from "./src/components/BottomNav";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { AttendanceScreen } from "./src/screens/AttendanceScreen";
import { LeaveScreen } from "./src/screens/LeaveScreen";
import { PayrollScreen } from "./src/screens/PayrollScreen";
import { ExpensesScreen } from "./src/screens/ExpensesScreen";
import { AssetsScreen } from "./src/screens/AssetsScreen";
import { DirectoryScreen } from "./src/screens/DirectoryScreen";
import { IDCardScreen } from "./src/screens/IDCardScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ApprovalsScreen } from "./src/screens/ApprovalsScreen";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  useEffect(() => {
    if (!session?.access_token) return;

    dbGet<ProfileRow>(
      "v_employee_directory",
      "select=display_name,employee_code,official_email,department,designation,location,joining_date&limit=1",
      session.access_token
    )
      .then((rows) => {
        const first = rows[0];
        if (first) setProfile(first);
      })
      .catch(() => {});
  }, [session?.access_token]);

  function handleSignOut() {
    setSession(null);
    setProfile(null);
    setActiveTab("dashboard");
  }

  // Unauthenticated Flow
  if (!session) {
    return (
      <SafeAreaView style={s.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.brand} />
        <LoginScreen onLoginSuccess={setSession} />
      </SafeAreaView>
    );
  }

  // Manager status check
  const isManager =
    profile?.primary_role === "SUPER_ADMIN" ||
    profile?.primary_role === "HR_ADMIN" ||
    profile?.primary_role === "MANAGER";

  // Screen Router
  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardScreen session={session} profile={profile} onNavigate={setActiveTab} />;
      case "attendance":
        return <AttendanceScreen session={session} />;
      case "leave":
        return <LeaveScreen session={session} />;
      case "payroll":
        return <PayrollScreen session={session} />;
      case "expenses":
        return <ExpensesScreen session={session} />;
      case "assets":
        return <AssetsScreen session={session} />;
      case "directory":
        return <DirectoryScreen session={session} />;
      case "id-card":
        return <IDCardScreen profile={profile} />;
      case "profile":
        return <ProfileScreen profile={profile} onSignOut={handleSignOut} />;
      case "approvals":
        return <ApprovalsScreen session={session} />;
      default:
        return <DashboardScreen session={session} profile={profile} onNavigate={setActiveTab} />;
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand} />
      
      {/* Top Header */}
      <Header
        profile={profile}
        onSignOut={handleSignOut}
        onProfilePress={() => setActiveTab("profile")}
      />

      {/* Main Screen Content */}
      <View style={s.screenContainer}>{renderScreen()}</View>

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isManager={isManager}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
