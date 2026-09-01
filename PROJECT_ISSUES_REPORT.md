# Loan On Tip HRMS - Project Issues & Analysis Report

**Date**: 2026-09-01  
**Project**: Next.js + Supabase HRMS  
**Status**: 🔴 **21 Major Issues Identified**

---

## Executive Summary

The project has **7 CRITICAL/HIGH severity issues** affecting:
- **16 API routes** using inconsistent handler patterns
- **6 API endpoints** exposing raw database errors
- **~100+ files** in app/api and app/(app) not being linted
- **Security regressions** from early migration attempts (RLS policies)
- **Type safety gaps** in TypeScript configuration

**Recommendation**: Address issues in this priority order before next production deployment.

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. **API Handler Pattern Inconsistency** ⚠️ HIGH IMPACT
**Status**: Affecting 16 endpoints  
**Risk**: Inconsistent behavior, missing validation, security gaps

**Three incompatible patterns found:**

| Pattern | Used By | Features | Files |
|---------|---------|----------|-------|
| **A (Old)** | 14 routes | No validation, no rate limiting, manual errors | assets/*, attendance/correction, expenses, organisation/*, payroll/*, people/* |
| **B (New)** | 2 routes | ✅ Zod validation, rate limiting, idempotency | attendance/check-in, check-out, leaves/*, employees |
| **C (Broken)** | 1 route | Direct export, bypasses all wrappers | auth/callback |

**Files Using Old Pattern A (Need Migration):**
- [app/api/assets/route.ts](app/api/assets/route.ts#L4)
- [app/api/assets/[id]/assign/route.ts](app/api/assets/%5Bid%5D/assign/route.ts#L4)
- [app/api/assets/[id]/repair/route.ts](app/api/assets/%5Bid%5D/repair/route.ts#L4)
- [app/api/assets/[id]/return/route.ts](app/api/assets/%5Bid%5D/return/route.ts#L4)
- [app/api/attendance/correction/route.ts](app/api/attendance/correction/route.ts#L4)
- [app/api/attendance/exceptions/[id]/route.ts](app/api/attendance/exceptions/%5Bid%5D/route.ts#L4)
- [app/api/employees/[id]/route.ts](app/api/employees/%5Bid%5D/route.ts#L4-L16)
- [app/api/expenses/route.ts](app/api/expenses/route.ts#L4)
- [app/api/organisation/route.ts](app/api/organisation/route.ts#L5)
- [app/api/organisation/[tab]/[id]/route.ts](app/api/organisation/%5Btab%5D/%5Bid%5D/route.ts#L5)
- [app/api/payroll/calculate/route.ts](app/api/payroll/calculate/route.ts#L42)
- [app/api/payroll/runs/route.ts](app/api/payroll/runs/route.ts#L12-L46)
- [app/api/payroll/runs/[id]/route.ts](app/api/payroll/runs/%5Bid%5D/route.ts#L4-L30)
- [app/api/people/[id]/documents/route.ts](app/api/people/%5Bid%5D/documents/route.ts#L15)
- [app/api/people/[id]/documents/[docId]/route.ts](app/api/people/%5Bid%5D/documents/%5BdocId%5D/route.ts#L4)
- [app/api/people/[id]/exit/route.ts](app/api/people/%5Bid%5D/exit/route.ts#L4-L55)
- [app/api/people/[id]/salary/route.ts](app/api/people/%5Bid%5D/salary/route.ts#L4)

**Action Required**: Migrate all to `withApi()` from [lib/server/http.ts](lib/server/http.ts)

---

### 2. **Raw Database Errors Leaked to Client** 🔐 SECURITY
**Status**: 6 endpoints affected  
**Risk**: Schema information disclosure, security vulnerability

**Example Problem**:
```typescript
const { data, error } = await db.from("employees").select("*");
if (error) throw error;  // ❌ Leaks raw Supabase error to client
```

**Affected Endpoints:**
- [app/api/employees/route.ts](app/api/employees/route.ts#L37) - GET list
- [app/api/employees/route.ts](app/api/employees/route.ts#L108) - POST create
- [app/api/attendance/bulk-mark/route.ts](app/api/attendance/bulk-mark/route.ts#L83)
- [app/api/attendance/check-in/route.ts](app/api/attendance/check-in/route.ts#L206-L227)
- [app/api/attendance/check-out/route.ts](app/api/attendance/check-out/route.ts#L77)
- [app/api/leaves/route.ts](app/api/leaves/route.ts#L68-L183)

**Fix**: Use `mapDatabaseError()` from [lib/server/errors.ts](lib/server/errors.ts#L1)

---

### 3. **Duplicate Migration File Numbers** 🗄️ DATABASE SCHEMA
**Status**: Blocking deployments  
**Risk**: Migration ordering conflicts

**Problem:**
- [supabase/migrations/36_rls_gaps.sql](supabase/migrations/36_rls_gaps.sql)
- [supabase/migrations/36_harden_rls_sensitive.sql](supabase/migrations/36_harden_rls_sensitive.sql)

Both numbered `36` — migration tools will fail to apply correctly.

**Fix**: Rename `36_harden_rls_sensitive.sql` → `37_harden_rls_sensitive.sql`

---

### 4. **Three Incompatible Error Handling Systems** ⚙️ MAINTENANCE
**Status**: Code duplication across 3 files  
**Risk**: Inconsistent error codes, no unified error mapping

**System A** - [lib/server.ts](lib/server.ts#L15-L42)
- Basic codes: "INVALID_INPUT", "UNAUTHENTICATED", "FORBIDDEN"
- No database error mapping
- Used by: old Pattern A endpoints

**System B** - [lib/server/errors.ts](lib/server/errors.ts#L1-L70)
- Comprehensive error codes from `@hrms/api-contract`
- Includes `mapDatabaseError()`, error status mapping
- Designed to handle security issues

**System C** - [lib/server/http.ts](lib/server/http.ts#L1-L50)
- Uses System B
- Adds envelope, jsonOk, jsonError helpers
- Used by: new Pattern B endpoints

**Fix**: Consolidate into one system, migrate all routes to use System B/C

---

## 🟠 HIGH PRIORITY ISSUES

### 5. **ESLint Config Ignoring Critical Paths** 🚨 CODE QUALITY
**File**: [eslint.config.mjs](eslint.config.mjs#L18-L30)

```javascript
ignores: [
  "app/(app)/**",        // ❌ ~80 app page files ignored
  "app/api/**",          // ❌ ~16 API route files ignored
],
```

**Impact**:
- No type checking enforcement
- Unused imports not detected
- No naming convention validation
- Potential dead code hidden

**Files Ignored**: ~100+ files with zero linting

**Fix**: Remove ignores or use specific patterns only for legacy code

---

### 6. **TypeScript: Unsafe Array/Object Access Not Enforced** 🔒 TYPE SAFETY
**File**: [tsconfig.json](tsconfig.json#L4)

```json
"noUncheckedIndexedAccess": false  // ❌ Should be true
```

**Example Problem**:
```typescript
const arr = [1, 2, 3];
const val = arr[5];  // ✅ Compiles fine, but undefined at runtime
console.log(val.toString());  // ❌ Runtime error
```

**Fix**: Set to `true` and fix resulting type errors

---

### 7. **Inconsistent Authentication Context Types** 🔐 AUTH/PERMISSIONS
**Status**: Two incompatible `Actor` types in codebase

**Old System** - [lib/server.ts](lib/server.ts#L54-L62)
```typescript
type Actor = {
  permissions: Set<string>;  // ❌ Untyped
  role: string | null;
};
```

**New System** - [lib/server/auth.ts](lib/server/auth.ts#L6-L30)
```typescript
type AuthContext = {
  permissions: Permission[];  // ✅ Typed from @hrms/api-contract
  primaryRole: Role | null;
};
```

**Problem**: Old endpoints use untyped permissions, no IDE autocomplete, no validation

**Fix**: Migrate all auth context to new system from @hrms/api-contract

---

## 🟡 MEDIUM PRIORITY ISSUES

### 8. **Multiple RLS Policy Refinements in Migration History** 🔐 SECURITY PATTERN
**Status**: Historical security issues now fixed

**Migration files showing security gaps that were later fixed:**
- [supabase/migrations/21_fix_rls_policies.sql](supabase/migrations/21_fix_rls_policies.sql)
- [supabase/migrations/22_fix_rls_bank_statutory.sql](supabase/migrations/22_fix_rls_bank_statutory.sql)
- [supabase/migrations/31_fix_schema_rls_and_data.sql](supabase/migrations/31_fix_schema_rls_and_data.sql)
- [supabase/migrations/32_fix_schema_conflicts_and_rls.sql](supabase/migrations/32_fix_schema_conflicts_and_rls.sql)
- [supabase/migrations/36_rls_gaps.sql](supabase/migrations/36_rls_gaps.sql)
- [supabase/migrations/36_harden_rls_sensitive.sql](supabase/migrations/36_harden_rls_sensitive.sql)

**What was wrong:**
- Early migrations had: `USING (true)` / `FOR ALL USING (true)`
- Allowed ANY authenticated user to read/mutate ALL company data
- Affected: asset_*, salary, holiday, dynamic_field tables

**Impact**: Security regression in early deployment — data was exposed before being fixed

**Lesson**: RLS policies should be thoroughly reviewed before initial deployment

---

### 9. **Inconsistent Request ID Generation** 📊 API RELIABILITY
**Status**: Two different implementations

**Old** - [lib/server.ts](lib/server.ts#L140-L145)
```typescript
function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? 
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
```

**New** - [lib/server/http.ts](lib/server/http.ts#L109)
```typescript
const requestId = req.headers.get(REQUEST_ID_HEADER) ?? randomUUID();
```

**Improvements in new system:**
- ✅ Supports client-provided request IDs (for distributed tracing)
- ✅ Uses crypto.randomUUID() (more reliable)
- ✅ Has REQUEST_ID_HEADER constant

**Fix**: Use new implementation everywhere

---

### 10. **Manual vs Zod Validation Inconsistency** ✔️ DATA VALIDATION
**Status**: Old routes lack proper validation

**Old Pattern** - Manual validation:
```typescript
const body = await readJson(req);
const reason = body.reason ? String(body.reason) : null;
if (!reason) throw badRequest("INVALID_INPUT", "required");
```

**New Pattern** - Zod schemas:
```typescript
body: CheckInRequestSchema,  // ✅ Auto-validates
```

**Old Routes Affected:**
- [app/api/assets/route.ts](app/api/assets/route.ts#L9-L14) - manual String() casts
- [app/api/payroll/calculate/route.ts](app/api/payroll/calculate/route.ts#L42-L49) - manual Number() casts  
- [app/api/attendance/correction/route.ts](app/api/attendance/correction/route.ts#L13-L19) - manual String() casts

**Missing Benefits:**
- Schema validation
- Type safety on parsed data
- Consistent error messages
- API documentation

---

### 11. **Missing Rate Limiting & Idempotency on Sensitive Operations** ⚡ RELIABILITY
**Status**: Old endpoints lack critical features

**What New Endpoints Have:**
```typescript
{
  rateLimit: { limit: 60, windowMs: 60_000 },
  idempotencyKey: (body) => body.idempotency_key,
  idempotencyEndpoint: "attendance/check-in"
}
```

**What Old Endpoints are Missing:**
- ❌ No rate limiting → vulnerable to brute force
- ❌ No idempotency → duplicate submissions on retry

**High-Risk Endpoints Without These:**
- [app/api/payroll/calculate/route.ts](app/api/payroll/calculate/route.ts) - Sensitive calculation
- [app/api/payroll/runs/route.ts](app/api/payroll/runs/route.ts) - Critical business operation
- [app/api/people/[id]/salary/route.ts](app/api/people/%5Bid%5D/salary/route.ts) - Salary modification
- [app/api/attendance/correction/route.ts](app/api/attendance/correction/route.ts) - Bulk corrections

---

### 12. **Environment Variables Not Validated at Build Time** ⚙️ CONFIGURATION
**File**: [lib/server/env.ts](lib/server/env.ts)

**Problem**:
```typescript
export function supabaseUrl(): string {
  const value = read("NEXT_PUBLIC_SUPABASE_URL");
  if (!value) throw new Error("...not configured");  // ❌ Runtime error
  return value;
}
```

**Issues:**
- Production build succeeds even with missing config
- Errors only appear on first request
- No early warning

**Also Found**: [app/api/auth/callback/route.ts](app/api/auth/callback/route.ts#L5-L6)
```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL!  // May be undefined
```

**Fix**: Use t3-env or similar for build-time validation

---

### 13. **Inconsistent Permission Check Patterns** 🔐 AUTHORIZATION
**Status**: Old vs new systems incompatible

**Old System:**
```typescript
requirePermission(actor, "asset.create");  // String, no IDE support
```

**New System:**
```typescript
permission: "attendance.mark_self",  // Typed, from @hrms/api-contract
```

**Gap**: Old routes don't validate against typed Permission enum

---

## 🟢 MODERATE PRIORITY ISSUES

### 14. **Missing Frontend Form Validation** ✔️ DATA QUALITY
**Status**: 4 form pages lack client-side validation

**Pages Missing Validation:**
- [app/(app)/assets/page.tsx](app/%28app%29/assets/page.tsx#L469-L485) - Asset handover form
- [app/(app)/assets/maintenance/page.tsx](app/%28app%29/assets/maintenance/page.tsx#L286-L310) - Maintenance form
- [app/(app)/people/[id]/exit/page.tsx](app/%28app%29/people/%5Bid%5D/exit/page.tsx#L149-L161) - Exit form
- [app/(app)/self-service/page.tsx](app/%28app%29/self-service/page.tsx#L552-L565) - Expense claims

**Impact**: Poor UX, relies entirely on server validation, no instant feedback

---

### 15. **Component Uses `any` Type** 🔒 TYPE SAFETY
**File**: [components/Form.tsx](components/Form.tsx#L103-L116)

```typescript
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validate?: (values: T) => Partial<Record<keyof T, string>>
): UseFormReturn<T> {
  const newErrors: Record<keyof T, FieldError | null> = {} as any;  // ❌
  const resetForm = useCallback(() => {
    setErrorsState({} as any);  // ❌
  }, [values, validate]);
}
```

**Issues:**
- Multiple `as any` assertions
- Violates strict TypeScript mode
- Hides type errors

---

### 16. **CSV Import Validation Incomplete** 📥 DATA QUALITY
**Files:**
- [app/(app)/people/import/page.tsx](app/%28app%29/people/import/page.tsx#L108-L124)
- [app/(app)/assets/import/page.tsx](app/%28app%29/assets/import/page.tsx#L77-L90)

**Problem**: Some required schema fields not validated in CSV

---

### 17. **Missing Null Checks in API Responses** 🛡️ RUNTIME SAFETY
**Examples:**
- [app/api/assets/route.ts](app/api/assets/route.ts#L21) - `codeRes as string` (may be null)
- [app/api/payroll/calculate/route.ts](app/api/payroll/calculate/route.ts#L85) - `salaryData as SalaryStructureRow[]` (cast without check)

---

### 18. **Missing Numeric Field Validation** 📊 DATA INTEGRITY
**Issues:**
- Recovery amount input has no max value
- Expense amount uses `step="any"` (allows extreme precision)
- Account field shown but not validated

**Files:**
- [app/(app)/payroll/payslip/[id]/page.tsx](app/%28app%29/payroll/payslip/%5Bid%5D/page.tsx#L230-L231)
- [app/(app)/assets/page.tsx](app/%28app%29/assets/page.tsx#L527-L533)
- [app/(app)/self-service/page.tsx](app/%28app%29/self-service/page.tsx#L558)

---

## 🟡 LOW PRIORITY ISSUES

### 19. **Schema Refactoring History** 🗄️ HISTORICAL NOTE
**File**: [supabase/migrations/25_fixes_and_schema.sql](supabase/migrations/25_fixes_and_schema.sql#L1-L20)

```sql
-- NOTE: attendance_status_enum / employment_status_enum extensions were removed.
-- Migration 33 converts these native enums to varchar + CHECK constraints...
```

**Lesson**: Native enum types were replaced with VARCHAR + CHECK after initial design

---

### 20. **Minimal Next.js Configuration** ⚙️ DEPLOYMENT
**File**: [next.config.ts](next.config.ts)

Missing:
- Security headers
- CORS configuration
- Compression settings
- Image optimization
- Build output analysis

---

### 21. **Vercel Deployment Configuration Sparse** 🚀 DEPLOYMENT
**File**: [vercel.json](vercel.json)

Missing:
- Environment variable requirements
- Preview/production environment config
- Build optimization settings
- Preview deployment rules

---

## 📊 ISSUES BY CATEGORY

| Category | Count | Severity | Files |
|----------|-------|----------|-------|
| API Consistency | 3 | CRITICAL | 16 routes |
| Security | 2 | CRITICAL | 6 routes |
| Database | 1 | CRITICAL | 2 migration files |
| Type Safety | 3 | HIGH | 4 files |
| Code Quality | 1 | HIGH | ~100 files |
| Validation | 5 | MEDIUM-LOW | 8 files |
| Configuration | 2 | LOW | 2 files |
| **TOTAL** | **21** | | **~150+ files** |

---

## 🎯 RECOMMENDED ACTION PLAN

### Phase 1: Critical (This Week)
1. ✅ Migrate old Pattern A endpoints to `withApi()` 
2. ✅ Replace raw `throw error` with `mapDatabaseError()`
3. ✅ Rename migration `36_harden_rls_sensitive.sql` → `37_*`
4. ✅ Remove duplicate error handling systems

### Phase 2: High Priority (Next Week)
5. ✅ Fix ESLint config to lint app/api and app/(app)
6. ✅ Enable `noUncheckedIndexedAccess: true` in TypeScript
7. ✅ Migrate auth context to new typed system

### Phase 3: Medium Priority (Sprint)
8. ✅ Add rate limiting to sensitive endpoints
9. ✅ Add idempotency support to mutations
10. ✅ Add build-time environment validation

### Phase 4: Quality (Polish)
11. ✅ Add frontend form validation (Zod)
12. ✅ Fix `any` types in Form component
13. ✅ Add numeric field validation
14. ✅ Complete null checks on API responses

---

## 📝 NOTES

- **RLS Security**: Early migrations show security was improved over time. Future updates should have security reviews before deployment.
- **Pattern Migration**: All old Pattern A endpoints should follow new Pattern B to ensure consistency.
- **Type Safety**: Several opportunities to improve TypeScript strictness.
- **Testing**: Consider adding integration tests for critical paths (payroll, attendance, leave).

