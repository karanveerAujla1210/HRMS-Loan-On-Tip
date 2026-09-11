import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { colors, spacing, radius, shadows } from "../theme";
import type { TabType } from "../types";

type BottomNavProps = {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isManager?: boolean;
};

interface NavTabItem {
  id: TabType;
  label: string;
  icon: string;
  managerOnly?: boolean;
}

const TABS: NavTabItem[] = [
  { id: "dashboard", label: "Home", icon: "🏠" },
  { id: "attendance", label: "Clock", icon: "⏱️" },
  { id: "leave", label: "Leaves", icon: "📅" },
  { id: "payroll", label: "Pay", icon: "💵" },
  { id: "expenses", label: "Claims", icon: "🧾" },
  { id: "assets", label: "Assets", icon: "💻" },
  { id: "directory", label: "People", icon: "👥" },
  { id: "id-card", label: "ID Card", icon: "🪪" },
  { id: "approvals", label: "Approve", icon: "✍️", managerOnly: true },
  { id: "profile", label: "Profile", icon: "👤" },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab, isManager }) => {
  const visibleTabs = TABS.filter((t) => !t.managerOnly || isManager);

  return (
    <View style={s.navContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.7}
              style={[s.tabItem, isActive && s.tabItemActive]}
            >
              <Text style={s.iconText}>{tab.icon}</Text>
              <Text style={[s.labelText, isActive && s.labelTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  navContainer: {
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs + 2,
    ...shadows.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    minWidth: 58,
  },
  tabItemActive: {
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  iconText: {
    fontSize: 16,
    marginBottom: 2,
  },
  labelText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
  labelTextActive: {
    color: colors.brand,
    fontWeight: "700",
  },
});
