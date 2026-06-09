export const HARVEST_DAYS = 45;

export const GREENHOUSES = {
  GH1: {
    name: "Greenhouse 1",
    rows: [
      ...Array.from({ length: 10 }, (_, index) => `NFT ${index + 1}`),
      "PVC Wall 1",
      "PVC Wall 2",
      "PVC Wall 3"
    ]
  },
  GH2: {
    name: "Greenhouse 2",
    rows: Array.from({ length: 20 }, (_, index) => `Tower ${index + 1}`)
  },
  GH3: {
    name: "Greenhouse 3",
    rows: Array.from({ length: 20 }, (_, index) => `Channel ${index + 1}`)
  }
};

export function parseDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeHarvestDate(plantingDate, days = HARVEST_DAYS) {
  const parts = parseDateParts(plantingDate);
  if (!parts) return "";
  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function computeDaysLeft(harvestDate, today = new Date()) {
  const harvest = parseDateParts(harvestDate);
  if (!harvest) return Number.NaN;
  const todayParts = parseDateParts(formatLocalDate(today));
  const harvestDay = Date.UTC(harvest.year, harvest.month - 1, harvest.day);
  const currentDay = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);
  return Math.round((harvestDay - currentDay) / 86400000);
}

export function getHarvestStatus(daysLeft) {
  if (!Number.isFinite(daysLeft)) return { kind: "unknown", label: "Date unavailable" };
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return { kind: "overdue", label: `${days} day${days === 1 ? "" : "s"} overdue` };
  }
  if (daysLeft === 0) return { kind: "due", label: "Due today" };
  if (daysLeft <= 7) return { kind: "soon", label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` };
  return { kind: "scheduled", label: `${daysLeft} days left` };
}

export function formatDisplayDate(value, options = {}) {
  const parts = parseDateParts(value);
  if (!parts) return "-";
  return new Intl.DateTimeFormat("en-PH", {
    year: options.year ?? "numeric",
    month: options.month ?? "short",
    day: options.day ?? "numeric"
  }).format(new Date(parts.year, parts.month - 1, parts.day));
}

export function normalizeEntries(value, idFactory = () => `entry_${Date.now()}`) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && entry.greenhouseKey && entry.row && entry.plantingDate)
    .map((entry) => ({
      ...entry,
      id: entry.id || idFactory(),
      greenhouseName: entry.greenhouseName || GREENHOUSES[entry.greenhouseKey]?.name || entry.greenhouseKey,
      harvestDate: entry.harvestDate || computeHarvestDate(entry.plantingDate),
      notifiedOn: entry.notifiedOn || ""
    }));
}

export function sortEntries(entries) {
  return [...(entries || [])].sort(
    (a, b) =>
      String(a.harvestDate).localeCompare(String(b.harvestDate)) ||
      String(a.greenhouseName).localeCompare(String(b.greenhouseName)) ||
      String(a.row).localeCompare(String(b.row))
  );
}
