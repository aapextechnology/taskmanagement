// Tolerant readers for Tessera's undocumented responses (Owner 2026-08-12).
//
// The integration targets the endpoints Tessera's own dashboard uses — there
// is no public API and no documented shape. So extraction is deliberately
// paranoid: it looks for the fields under the names such dashboards commonly
// use, and when nothing matches it says so instead of writing a zero into
// the sales history. A wrong number in the snapshots would poison event
// health, the dashboard and the AI's verdicts, all of which read this table.

export interface TesseraEventRow {
  id: string;
  name: string;
  ticketsSold: number | null;
  revenue: number | null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function firstNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const found = num(obj[key]);
    if (found !== null) return found;
  }
  return null;
}

const SOLD_KEYS = ["ticketsSold", "tickets_sold", "sold", "admission", "totalSold", "soldCount"];
const REVENUE_KEYS = ["revenue", "gmv", "totalRevenue", "grossRevenue", "totalGmv"];

/** The list payload may sit at the root, under `data`, or under `items`. */
export function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const box = payload as Record<string, unknown>;
    for (const key of ["data", "items", "events", "results"]) {
      if (Array.isArray(box[key])) return box[key] as unknown[];
    }
    // one level deeper: { data: { items: [...] } }
    if (box.data && typeof box.data === "object") {
      const inner = box.data as Record<string, unknown>;
      for (const key of ["items", "events", "results"]) {
        if (Array.isArray(inner[key])) return inner[key] as unknown[];
      }
    }
  }
  return [];
}

/** Rows we could not read are dropped, never invented. */
export function extractEvents(payload: unknown): TesseraEventRow[] {
  return unwrapList(payload).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const id = row.id ?? row.eventId ?? row._id;
    const name = row.name ?? row.title ?? row.eventName;
    if (typeof id !== "string" && typeof id !== "number") return [];
    if (typeof name !== "string" || !name.trim()) return [];
    return [
      {
        id: String(id),
        name: name.trim(),
        ticketsSold: firstNum(row, SOLD_KEYS),
        revenue: firstNum(row, REVENUE_KEYS),
      },
    ];
  });
}

export interface TesseraKpis {
  ticketsSold: number;
  revenue: number | null;
}

/**
 * KPI shapes seen in the wild: flat, under `data`, or a list of named
 * metrics. Sold is required — without it there is nothing worth writing;
 * revenue may honestly be absent.
 */
export function extractKpis(payload: unknown): TesseraKpis | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;

  for (const candidate of [root, root.data, root.kpis]) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const obj = candidate as Record<string, unknown>;
    const sold = firstNum(obj, SOLD_KEYS);
    if (sold !== null) {
      return { ticketsSold: sold, revenue: firstNum(obj, REVENUE_KEYS) };
    }
  }

  // metric-list form: [{ name: "ticketsSold", value: 123 }, …]
  const list = unwrapList(payload);
  if (list.length > 0) {
    const byName = new Map<string, number>();
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const metric = raw as Record<string, unknown>;
      const key = metric.name ?? metric.key ?? metric.label;
      const value = num(metric.value ?? metric.total ?? metric.count);
      if (typeof key === "string" && value !== null) byName.set(key, value);
    }
    for (const key of SOLD_KEYS) {
      const sold = byName.get(key);
      if (sold !== undefined) {
        const revenue = REVENUE_KEYS.map((k) => byName.get(k)).find((v) => v !== undefined);
        return { ticketsSold: sold, revenue: revenue ?? null };
      }
    }
  }
  return null;
}
