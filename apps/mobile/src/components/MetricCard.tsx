import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, radius, spacing, shadows } from "../theme";

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: string;
  onPress?: () => void;
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = colors.brand,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={s.topRow}>
        <Text style={s.title}>{title}</Text>
        <View style={[s.iconBox, { backgroundColor: color + "18" }]}>
          <Text style={s.iconText}>{icon}</Text>
        </View>
      </View>
      <Text style={[s.value, { color }]}>{value}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    minWidth: 140,
    ...shadows.sm,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 16,
  },
  value: {
    fontSize: 24,
    fontWeight: "800",
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
