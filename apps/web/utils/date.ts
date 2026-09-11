/** Shared date helpers used across features. All dates are ISO `YYYY-MM-DD`. */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartISO(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export function currentYear(): number {
  return new Date().getFullYear();
}
