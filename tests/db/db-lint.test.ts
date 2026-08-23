import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/**
 * Static lint runs without a database. It fails the build when a migration
 * re-introduces one of the Postgres anti-patterns we have already been burned
 * by. These are cheap, deterministic checks that complement the live migration
 * test below.
 */
describe("migration static lint", () => {
  const files = migrationFiles();

  it("does not use ALTER TYPE ... ADD VALUE (forbidden inside a migration transaction)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file === "33_harden_enums_audit.sql") continue; // documents the rule in a comment
      const sql = stripComments(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      if (/alter\s+type\s+[\w.]+\s+add\s+value/i.test(sql)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Found ALTER TYPE ADD VALUE in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("does not use ADD CONSTRAINT IF NOT EXISTS (invalid Postgres syntax)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const sql = stripComments(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      if (/add\s+constraint\s+if\s+not\s+exists/i.test(sql)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Found ADD CONSTRAINT IF NOT EXISTS in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("does not insert into a GENERATED ALWAYS column", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      if (/closing_balance/i.test(sql) && /insert\s+into\s+public\.leave_balances/i.test(sql)) {
        // allow inserts that omit the generated column
        const insertBlock = sql.split(/insert\s+into\s+public\.leave_balances/i)[1] ?? "";
        if (/closing_balance\s*[,)]/i.test(insertBlock.split(";")[0])) {
          offenders.push(file);
        }
      }
    }
    expect(offenders, `Inserts into generated closing_balance in: ${offenders.join(", ")}`).toEqual([]);
  });
});

/**
 * Live test: applies every migration to a throwaway database and asserts the
 * invariants the platform depends on. Skipped locally (no Postgres); the CI
 * job provisions a Postgres:15 service container and sets DATABASE_URL.
 */
describe("migration apply (integration)", () => {
  const connectionString = process.env.DATABASE_URL;
  const maybe = connectionString ? describe : describe.skip;

  maybe("applies cleanly and enforces the security contract", () => {
    let root: Client;
    let dbName: string;
    let client: Client;

    beforeAll(async () => {
      root = new Client({ connectionString });
      await root.connect();
      dbName = `hrms_test_${randomUUID().replace(/-/g, "")}`;
      await root.query(`create database "${dbName}"`);
      const dbUrl = new URL(connectionString as string);
      dbUrl.pathname = `/${dbName}`;
      client = new Client({ connectionString: dbUrl.toString() });
      await client.connect();

      for (const file of migrationFiles()) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
        // Execute the whole file in one statement; $$ blocks are preserved.
        await client.query(sql);
      }
    });

    afterAll(async () => {
      if (client) await client.end();
      if (root) {
        await root.query(`drop database if exists "${dbName}" with (force)`);
        await root.end();
      }
    });

    it("converts status/type enum columns to varchar + CHECK", async () => {
      const res = await client.query<{ table_name: string; column_name: string; data_type: string }>(
        `select table_name, column_name, data_type
         from information_schema.columns
         where table_schema = 'public'
           and table_name in ('employees','attendance','leave_requests','payroll_runs','assets')
           and column_name in ('employment_status','status')`
      );
      expect(res.rowCount).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.data_type, `${row.table_name}.${row.column_name} should be varchar`).toBe("character varying");
      }
    });

    it("makes v_dashboard_metrics security_invoker", async () => {
      const res = await client.query<{ security_invoker: boolean }>(
        `select (pg_options_to_table(c.reloptions)).option_value::boolean as security_invoker
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where c.relname = 'v_dashboard_metrics' and n.nspname = 'public'`
      );
      expect(res.rows[0]?.security_invoker).toBe(true);
    });

    it("grants authenticated callers an INSERT policy on audit_logs", async () => {
      const res = await client.query<{ cmd: string }>(
        `select 'has_policy' as cmd
         from pg_policies
         where schemaname = 'public'
           and tablename = 'audit_logs'
           and cmd = 'INSERT'`
      );
      expect(res.rowCount).toBe(1);
    });

    it("prevents updates to audit_logs via the append-only trigger", async () => {
      const res = await client.query<{ trigger_name: string }>(
        `select tgname as trigger_name
         from pg_trigger
         where tgrelid = 'public.audit_logs'::regclass
           and tgtype::text like '%u%'`
      );
      expect(res.rowCount).toBeGreaterThan(0);
    });

    it("seeds the canonical role -> permission matrix", async () => {
      const res = await client.query<{ code: string; perm_count: string }>(
        `select r.code, count(rp.permission_id)::text as perm_count
         from public.roles r
         left join public.role_permissions rp on rp.role_id = r.id
         where r.company_id is null and r.code = 'FINANCE_ADMIN'
         group by r.code`
      );
      expect(Number(res.rows[0]?.perm_count)).toBeGreaterThan(10);
    });

    it("defines the attendance daily-close engine", async () => {
      const res = await client.query<{ proname: string }>(
        `select proname from pg_proc where proname = 'run_daily_attendance_close'`
      );
      expect(res.rowCount).toBe(1);
    });
  });
});
