import test from "node:test";
import assert from "node:assert/strict";
import {
  GREENHOUSES,
  computeDaysLeft,
  computeHarvestDate,
  getHarvestStatus,
  normalizeEntries,
  sortEntries
} from "../core.js";

test("includes all configured NFT, PVC wall, tower, and channel locations", () => {
  assert.equal(GREENHOUSES.GH1.rows.filter((row) => row.startsWith("NFT ")).length, 10);
  assert.equal(GREENHOUSES.GH1.rows.filter((row) => row.startsWith("PVC Wall ")).length, 3);
  assert.equal(GREENHOUSES.GH2.rows.length, 20);
  assert.equal(GREENHOUSES.GH3.rows.length, 20);
});

test("calculates harvest exactly 45 calendar days after planting", () => {
  assert.equal(computeHarvestDate("2026-06-09"), "2026-07-24");
  assert.equal(computeHarvestDate("2026-01-20"), "2026-03-06");
});

test("calculates day differences from local calendar dates", () => {
  assert.equal(computeDaysLeft("2026-06-09", new Date(2026, 5, 9, 23, 45)), 0);
  assert.equal(computeDaysLeft("2026-06-16", new Date(2026, 5, 9, 23, 45)), 7);
  assert.equal(computeDaysLeft("2026-06-08", new Date(2026, 5, 9, 0, 5)), -1);
});

test("formats due and overdue statuses", () => {
  assert.deepEqual(getHarvestStatus(0), { kind: "due", label: "Due today" });
  assert.deepEqual(getHarvestStatus(-2), { kind: "overdue", label: "2 days overdue" });
  assert.deepEqual(getHarvestStatus(5), { kind: "soon", label: "5 days left" });
});

test("migrates legacy entries with stable ids and harvest dates", () => {
  const entries = normalizeEntries(
    [{ greenhouseKey: "GH1", greenhouseName: "Greenhouse 1", row: "NFT 1", plantingDate: "2026-06-09" }],
    () => "new-id"
  );
  assert.equal(entries[0].id, "new-id");
  assert.equal(entries[0].harvestDate, "2026-07-24");
});

test("sorts a copy without changing deletion identities", () => {
  const entries = [
    { id: "later", greenhouseName: "Greenhouse 1", row: "NFT 2", harvestDate: "2026-08-01" },
    { id: "earlier", greenhouseName: "Greenhouse 1", row: "NFT 1", harvestDate: "2026-07-20" }
  ];
  const sorted = sortEntries(entries);
  assert.deepEqual(sorted.map((entry) => entry.id), ["earlier", "later"]);
  assert.deepEqual(entries.map((entry) => entry.id), ["later", "earlier"]);
});
