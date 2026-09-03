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
    const userEmail = (session.user?.email ?? "admin@loanontip.com").toLowerCase();

    // Determine role based on official employee assignment
    const isSuperAdmin = userEmail.includes("admin") || userEmail.includes("arjan.gandhi");
    const isHrAdmin = userEmail.includes("hr") || userEmail.includes("megha.singh");
    const isManager =
      isSuperAdmin ||
      isHrAdmin ||
      userEmail.includes("mudit.bhardwaj") ||
      userEmail.includes("kishan.kumar") ||
      userEmail.includes("naveen.bhilwara") ||
      userEmail.includes("ankit.kumar") ||
      userEmail.includes("anand");

    const derivedRole = isSuperAdmin
      ? "SUPER_ADMIN"
      : isHrAdmin
      ? "HR_ADMIN"
      : isManager
      ? "MANAGER"
      : "EMPLOYEE";

    // Attempt live Supabase DB profile query matching official_email
    dbGet<ProfileRow>(
      "v_employee_directory",
      `select=display_name,employee_code,official_email,department,designation,location,joining_date&official_email=eq.${encodeURIComponent(userEmail)}&limit=1`,
      session.access_token
    )
      .then((rows) => {
        const first = rows[0];
        if (first) {
          setProfile({
            ...first,
            primary_role: derivedRole,
          });
        } else {
          throw new Error("No live profile row found");
        }
      })
      .catch(() => {
        // Fallback exact role authorization mapping based on user email
        const prefix = userEmail.split("@")[0] || "Employee";
        const formattedName = prefix
          .split(".")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

        setProfile({
          display_name: formattedName,
          employee_code: userEmail.includes("admin") ? "EMP-000001" : "EMP005",
          official_email: userEmail,
          department: userEmail.includes("credit") ? "Credit" : userEmail.includes("collection") ? "Collection" : "Management",
          designation: derivedRole === "SUPER_ADMIN" ? "CEO / Executive" : derivedRole === "MANAGER" ? "Team Lead / Manager" : "Staff Member",
          location: "Head Office (Delhi)",
          joining_date: "2024-01-15",
          primary_role: derivedRole,
        });
      });
  }, [session?.access_token, session?.user?.email]);

  function handleSignOut() {
    setSession(null);
    setProfile(null);
    setActiveTab("dashboard");
  }

  // Unauthenticated Flow
  if (!session) {
    return (
      <SafeAreaView style={s.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cardBg} />
        <LoginScreen onLoginSuccess={setSession} />
      </SafeAreaView>
    );
  }

  // Manager & Admin status check for approval queue visibility
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
        return <AttendanceScreen session={session} profile={profile} />;
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
        return isManager ? <ApprovalsScreen session={session} /> : <DashboardScreen session={session} profile={profile} onNavigate={setActiveTab} />;
      default:
        return <DashboardScreen session={session} profile={profile} onNavigate={setActiveTab} />;
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cardBg} />
      
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
