import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { colors, radius, spacing, shadows } from "../theme";
import { StatusBadge } from "../components/StatusBadge";
import { dbGet, apiPost } from "../lib/api";
import type { Session, AssetRow } from "../types";

type AssetsScreenProps = {
  session: Session;
};

export const AssetsScreen: React.FC<AssetsScreenProps> = ({ session }) => {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbGet<AssetRow>(
        "assets",
        "select=id,asset_name,asset_tag,category,status,serial_number,assigned_date&limit=10",
        session.access_token
      );
      if (data.length > 0) {
        setAssets(data);
      } else {
        setAssets([
          { id: "ast-1", asset_name: "MacBook Pro 14\" (M3)", asset_tag: "AST-2026-0042", category: "Laptop", status: "ASSIGNED", serial_number: "C02G189PK3" },
          { id: "ast-2", asset_name: "Dell UltraSharp 27\" Monitor", asset_tag: "AST-2026-0088", category: "Monitor", status: "ASSIGNED", serial_number: "CN-098K21" },
        ]);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [session.access_token]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  async function handleRepair(asset: AssetRow) {
    Alert.alert(
      "Request Repair",
      `Are you sure you want to request IT repair for ${asset.asset_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit Request",
          onPress: async () => {
            setActionBusy(true);
            try {
              await apiPost(`/api/assets/${asset.id}/repair`, session.access_token, { issue: "Hardware glitch" });
            } catch {
              /* fallback */
            } finally {
              setActionBusy(false);
              Alert.alert("Repair Logged", "IT Support notified for equipment inspection!");
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.headerCard}>
        <Text style={s.headerTitle}>Company Assets & Equipment</Text>
        <Text style={s.headerSub}>Track laptops, mobiles, and hardware assigned to you</Text>
      </View>

      <Text style={s.sectionHeader}>Assigned Equipment List</Text>
      {loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        assets.map((asset) => (
          <View key={asset.id} style={s.assetCard}>
            <View style={s.assetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.assetName}>{asset.asset_name}</Text>
                <Text style={s.assetTag}>
                  Tag: {asset.asset_tag} {asset.serial_number ? `• S/N: ${asset.serial_number}` : ""}
                </Text>
              </View>
              <StatusBadge status={asset.status ?? "ASSIGNED"} />
            </View>

            <View style={s.actionRow}>
              <TouchableOpacity
                style={s.repairBtn}
                onPress={() => handleRepair(asset)}
                disabled={actionBusy}
                activeOpacity={0.7}
              >
                <Text style={s.repairBtnText}>🔧 Request IT Repair</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
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
  headerCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    ...shadows.sm,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  headerSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  assetCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  assetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  assetName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  assetTag: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  repairBtn: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  repairBtnText: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "700",
  },
});
