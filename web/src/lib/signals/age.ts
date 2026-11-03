// Live age: recomputed in the browser from the measurement timestamp, so a stale build can never
// pass itself off as fresh. Pure functions, tested with node --test.

export interface Age {
  hours: number;
  label: string;
  stale: boolean;
  /** Sample runs never age: the clock is fixed and age is not applicable. */
  notApplicable: boolean;
}

/**
 * Age of a measurement at a given instant. Callers pass `generatedAt` from meta.json rather than
 * `new Date()`, so the server-rendered page and the hydrated one agree (no hydration mismatch).
 */
export function ageOf(measurementIso: string, now: Date, staleHours: number, sampleData = false): Age {
  if (sampleData) {
    return { hours: 0, label: "Age not applicable (sample data)", stale: false, notApplicable: true };
  }
  const measured = new Date(measurementIso).getTime();
  if (!Number.isFinite(measured)) {
    return { hours: Number.POSITIVE_INFINITY, label: "Measurement time unknown", stale: true, notApplicable: false };
  }
  const hours = Math.max(0, (now.getTime() - measured) / 3_600_000);
  return { hours, label: humanAge(hours), stale: hours > staleHours, notApplicable: false };
}

export function humanAge(hours: number): string {
  if (!Number.isFinite(hours)) return "unknown";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} minutes old`;
  if (hours < 48) return `${Math.round(hours)} hours old`;
  return `${Math.round(hours / 24)} days old`;
}

/** A stale real reading is shown as Grey "Data too old", never with numbers. */
export function statusAfterAge<T extends string>(status: T, age: Age): T | "grey" {
  return age.stale ? "grey" : status;
}
