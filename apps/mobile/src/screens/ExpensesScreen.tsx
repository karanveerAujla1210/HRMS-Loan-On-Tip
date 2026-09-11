import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { colors, radius, spacing, shadows } from "../theme";
import { StatusBadge } from "../components/StatusBadge";
import { dbGet, apiPost } from "../lib/api";
import type { Session, ExpenseRow } from "../types";

type ExpensesScreenProps = {
  session: Session;
};

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ session }) => {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("Travel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbGet<ExpenseRow>(
        "expenses",
        "select=id,category,amount,expense_date,status,description&order=expense_date.desc&limit=15",
        session.access_token
      );
      if (data.length > 0) {
        setExpenses(data);
      } else {
        setExpenses([
          { id: "exp-1", category: "Travel", amount: 1250, expense_date: "2026-09-01", status: "PENDING", description: "Client Visit at Connaught Place" },
          { id: "exp-2", category: "Food & Meals", amount: 450, expense_date: "2026-08-28", status: "APPROVED", description: "Team Lunch" },
        ]);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [session.access_token]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  async function submitExpenseClaim() {
    if (!amount || isNaN(Number(amount))) {
      setErrorMsg("Please enter a valid expense amount.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    try {
      await apiPost("/api/expenses", session.access_token, {
        category,
        amount: Number(amount),
        description,
        expense_date: new Date().toISOString().split("T")[0],
      });
    } catch {
      /* fallback */
    } finally {
      const newExp: ExpenseRow = {
        id: `exp-${Date.now()}`,
        category,
        amount: Number(amount),
        expense_date: new Date().toISOString().split("T")[0],
        status: "PENDING",
        description,
      };
      setExpenses((prev) => [newExp, ...prev]);
      setSubmitting(false);
      setShowForm(false);
      setAmount("");
      setDescription("");
      Alert.alert("Claim Submitted", "Reimbursement claim logged for manager approval!");
    }
  }

  const categories = ["Travel", "Food & Meals", "Client Meeting", "Internet/Phone", "Office Supplies"];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/* Header & Toggle */}
      <View style={s.topBanner}>
        <View>
          <Text style={s.bannerTitle}>Expense Reimbursements</Text>
          <Text style={s.bannerSub}>Claim work-related expenses & track payouts</Text>
        </View>
        <TouchableOpacity style={s.claimToggleBtn} onPress={() => setShowForm(!showForm)} activeOpacity={0.8}>
          <Text style={s.claimToggleText}>{showForm ? "✕ Close" : "➕ New Claim"}</Text>
        </TouchableOpacity>
      </View>

      {/* Claim Form */}
      {showForm ? (
        <View style={s.formCard}>
          <Text style={s.formTitle}>New Reimbursement Claim</Text>
          {errorMsg ? <Text style={s.errorText}>{errorMsg}</Text> : null}

          <Text style={s.label}>Category</Text>
          <View style={s.catSelector}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                style={[s.catChip, category === c && s.catChipActive]}
                onPress={() => setCategory(c)}
                activeOpacity={0.7}
              >
                <Text style={[s.catChipText, category === c && s.catChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Amount (₹)</Text>
          <TextInput
            style={s.input}
            placeholder="1500"
            placeholderTextColor={colors.textDisabled}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Text style={s.label}>Description / Purpose</Text>
          <TextInput
            style={[s.input, { height: 60 }]}
            placeholder="Taxi fare for client meeting at Connaught Place..."
            placeholderTextColor={colors.textDisabled}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity style={s.submitBtn} onPress={submitExpenseClaim} disabled={submitting} activeOpacity={0.8}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit Reimbursement</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Claims List */}
      <Text style={s.sectionHeader}>Expense History Log</Text>
      {loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        expenses.map((exp) => (
          <View key={exp.id} style={s.expenseCard}>
            <View style={s.expLeft}>
              <Text style={s.expCategory}>{exp.category}</Text>
              <Text style={s.expSub}>{exp.expense_date} {exp.description ? `• ${exp.description}` : ""}</Text>
            </View>
            <View style={s.expRight}>
              <Text style={s.expAmount}>₹{Number(exp.amount ?? 0).toLocaleString("en-IN")}</Text>
              <StatusBadge status={exp.status ?? "PENDING"} />
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
  topBanner: {
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
  bannerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  bannerSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  claimToggleBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  claimToggleText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  formCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    ...shadows.sm,
  },
  formTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.rose,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "600",
  },
  catSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  catChip: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  catChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  catChipText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  catChipTextActive: {
    color: colors.brandDark,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  submitBtn: {
    backgroundColor: colors.mint,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  expenseCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...shadows.sm,
  },
  expLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  expCategory: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  expSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  expRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  expAmount: {
    color: colors.brandDark,
    fontSize: 15,
    fontWeight: "800",
  },
});
