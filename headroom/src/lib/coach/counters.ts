// Number-check counters for /api/health and /behind ("numbers checked: 14, rejected: 0").
// Stored on globalThis so they survive Next.js dev module reloads.

interface Counters { numbersChecked: number; numbersRejected: number; }

const g = globalThis as typeof globalThis & { __headroomCounters?: Counters };

function state(): Counters {
  if (!g.__headroomCounters) g.__headroomCounters = { numbersChecked: 0, numbersRejected: 0 };
  return g.__headroomCounters;
}

/** Record one check: how many number/date tokens were checked and how many were rejected. */
export function recordNumberCheck(checked: number, rejected: number): void {
  const s = state();
  s.numbersChecked += Math.max(0, checked);
  s.numbersRejected += Math.max(0, rejected);
}

export function getCounters(): Counters {
  return { ...state() };
}

export function resetCounters(): void {
  const s = state();
  s.numbersChecked = 0;
  s.numbersRejected = 0;
}
