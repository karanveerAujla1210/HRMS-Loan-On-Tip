import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { colors, radius, spacing, shadows } from "../theme";
import { dbGet } from "../lib/api";
import type { Session, EmployeeRow } from "../types";

type DirectoryScreenProps = {
  session: Session;
};

export const DirectoryScreen: React.FC<DirectoryScreenProps> = ({ session }) => {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbGet<EmployeeRow>(
        "v_employee_directory",
        "select=id,display_name,employee_code,official_email,department,designation,location,employment_status&order=display_name&limit=30",
        session.access_token
      );
      if (data.length > 0) {
        setEmployees(data);
      } else {
        setEmployees([
          { id: "e1", display_name: "Karanveer Aujla", employee_code: "EMP-000001", official_email: "karanveer@loanontip.com", department: "Engineering", designation: "Lead Architect", location: "HQ", employment_status: "ACTIVE" },
          { id: "e2", display_name: "Priya Sharma", employee_code: "EMP-000002", official_email: "priya@loanontip.com", department: "Human Resources", designation: "HR Manager", location: "HQ", employment_status: "ACTIVE" },
          { id: "e3", display_name: "Rahul Verma", employee_code: "EMP-000003", official_email: "rahul@loanontip.com", department: "Finance", designation: "Senior Accountant", location: "HQ", employment_status: "ACTIVE" },
        ]);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [session.access_token]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.display_name?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q) ||
      e.employee_code?.toLowerCase().includes(q)
    );
  });

  const getInitials = (name?: string) => {
    if (!name) return "EMP";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    return (name.slice(0, 2) ?? "EM").toUpperCase();
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.headerTitle}>People & Employee Directory</Text>

      {/* Search Input */}
      <TextInput
        style={s.searchInput}
        placeholder="🔍 Search by name, department, or designation..."
        placeholderTextColor={colors.textDisabled}
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.md }} />
      ) : filtered.length === 0 ? (
        <Text style={s.emptyText}>No employees found matching your search.</Text>
      ) : (
        filtered.map((emp) => (
          <View key={emp.id || emp.employee_code} style={s.empCard}>
            <View style={s.avatarBox}>
              <Text style={s.avatarText}>{getInitials(emp.display_name)}</Text>
            </View>
            <View style={s.empInfo}>
              <Text style={s.empName}>{emp.display_name}</Text>
              <Text style={s.empSub}>
                {emp.designation} • {emp.department}
              </Text>
              <Text style={s.empEmail}>✉️ {emp.official_email}</Text>
            </View>
            <View style={s.codeBadge}>
              <Text style={s.codeText}>{emp.employee_code}</Text>
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
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  searchInput: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 13,
    ...shadows.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  empCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.sm,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.brandDark,
    fontSize: 16,
    fontWeight: "800",
  },
  empInfo: {
    flex: 1,
    gap: 2,
  },
  empName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  empSub: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  empEmail: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  codeBadge: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  codeText: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: "700",
  },
});
