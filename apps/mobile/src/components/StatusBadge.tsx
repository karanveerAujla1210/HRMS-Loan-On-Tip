import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";

type StatusBadgeProps = {
  status: string;
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const upper = (status ?? "PENDING").toUpperCase();
  const cfg = colors.status[upper as keyof typeof colors.status] ?? {
    bg: colors.cardBg,
    text: colors.textSecondary,
    border: colors.border,
  };

  return (
    <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[s.text, { color: cfg.text }]}>{upper.replace(/_/g, " ")}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
