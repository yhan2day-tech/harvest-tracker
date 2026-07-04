import {
  GREENHOUSES,
  computeDaysLeft,
  computeHarvestDate,
  formatDisplayDate,
  formatLocalDate,
  getHarvestStatus,
  normalizeEntries,
  sortEntries
} from "./core.js";

const STORAGE_KEY = "harvest-tracker-entries-v2";
const LEGACY_STORAGE_KEY = "harvestEntries";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const form = document.querySelector("#entry-form");
const greenhouseSelect = document.querySelector("#greenhouse-select");
const rowSelect = document.querySelector("#row-select");
const plantingDateInput = document.querySelector("#planting-date");
const harvestPreview = document.querySelector("#harvest-preview");
const scheduleBody = document.querySelector("#schedule-body");
const emptyState = document.querySelector("#empty-state");
const duePanel = document.querySelector("#due-panel");
const dueMessage = document.querySelector("#due-message");
const alertsButton = document.querySelector("#alerts-button");
const installButton = document.querySelector("#install-button");
const toastElement = document.querySelector("#toast");

let entries = loadEntries();
let deferredInstallPrompt = null;

boot();

function boot() {
  populateGreenhouses();
  plantingDateInput.value = formatLocalDate(new Date());
  updateHarvestPreview();
  updateRowOptions();
  render();
  bindEvents();
  registerServiceWorker();
  checkDueAlerts();
  window.setInterval(checkDueAlerts, CHECK_INTERVAL_MS);
}

function bindEvents() {
  greenhouseSelect.addEventListener("change", updateRowOptions);
  plantingDateInput.addEventListener("change", updateHarvestPreview);
  form.addEventListener("submit", addEntry);
  scheduleBody.addEventListener("click", handleScheduleClick);
  alertsButton.addEventListener("click", enableAlerts);
  installButton.addEventListener("click", installApp);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      render();
      checkDueAlerts();
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
    showToast("Harvest Tracker installed");
  });
}

function populateGreenhouses() {
  for (const [key, greenhouse] of Object.entries(GREENHOUSES)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = greenhouse.name;
    greenhouseSelect.append(option);
  }
}

function updateRowOptions() {
  rowSelect.innerHTML = '<option value="">Select row or tower</option>';
  const greenhouse = GREENHOUSES[greenhouseSelect.value];
  rowSelect.disabled = !greenhouse;
  if (!greenhouse) return;

  for (const row of greenhouse.rows) {
    const option = document.createElement("option");
    option.value = row;
    option.textContent = row;
    rowSelect.append(option);
  }
}

function updateHarvestPreview() {
  const harvestDate = computeHarvestDate(plantingDateInput.value);
  harvestPreview.textContent = harvestDate ? formatDisplayDate(harvestDate) : "-";
}

function addEntry(event) {
  event.preventDefault();
  const greenhouseKey = greenhouseSelect.value;
  const greenhouse = GREENHOUSES[greenhouseKey];
  const row = rowSelect.value;
  const plantingDate = plantingDateInput.value;

  if (!greenhouse || !row || !plantingDate) {
    showToast("Complete all transplanting fields");
    return;
  }

  const duplicate = entries.some(
    (entry) =>
      entry.greenhouseKey === greenhouseKey &&
      entry.row === row &&
      entry.plantingDate === plantingDate
  );
  if (duplicate) {
    showToast("That transplant is already recorded");
    return;
  }

  entries.push({
    id: createId(),
    greenhouseKey,
    greenhouseName: greenhouse.name,
    row,
    plantingDate,
    harvestDate: computeHarvestDate(plantingDate),
    notifiedOn: "",
    createdAt: new Date().toISOString()
  });
  saveEntries();
  render();
  form.reset();
  plantingDateInput.value = formatLocalDate(new Date());
  updateRowOptions();
  updateHarvestPreview();
  showToast("Transplant added");
  checkDueAlerts();
}

function handleScheduleClick(event) {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  const entry = entries.find((item) => item.id === button.dataset.deleteId);
  if (!entry) return;
  if (!window.confirm(`Delete ${entry.greenhouseName} ${entry.row}?`)) return;

  entries = entries.filter((item) => item.id !== entry.id);
  saveEntries();
  render();
  showToast("Transplant deleted");
}

function render() {
  const sorted = sortEntries(entries);
  scheduleBody.innerHTML = "";
  emptyState.hidden = sorted.length > 0;

  let dueCount = 0;
  let soonCount = 0;
  const dueEntries = [];

  for (const entry of sorted) {
    const daysLeft = computeDaysLeft(entry.harvestDate);
    const status = getHarvestStatus(daysLeft);
    if (daysLeft <= 0) {
      dueCount += 1;
      dueEntries.push(entry);
    } else if (daysLeft <= 7) {
      soonCount += 1;
    }

    const row = document.createElement("tr");
    row.className = `status-${status.kind}`;
    row.innerHTML = `
      <td data-label="Greenhouse">${escapeHtml(entry.greenhouseName)}</td>
      <td data-label="Location"><strong>${escapeHtml(entry.row)}</strong></td>
      <td data-label="Transplanted">${formatDisplayDate(entry.plantingDate)}</td>
      <td data-label="Expected harvest">${formatDisplayDate(entry.harvestDate)}</td>
      <td data-label="Status"><span class="status-badge ${status.kind}">${escapeHtml(status.label)}</span></td>
      <td class="row-actions"><button class="delete-button" data-delete-id="${escapeHtml(entry.id)}" type="button" title="Delete transplant">Delete</button></td>
    `;
    scheduleBody.append(row);
  }

  const nextEntry = sorted.find((entry) => computeDaysLeft(entry.harvestDate) >= 0);
  document.querySelector("#total-count").textContent = String(sorted.length);
  document.querySelector("#due-count").textContent = String(dueCount);
  document.querySelector("#soon-count").textContent = String(soonCount);
  document.querySelector("#next-harvest").textContent = nextEntry
    ? formatDisplayDate(nextEntry.harvestDate, { month: "short", day: "numeric" })
    : "-";

  duePanel.hidden = dueEntries.length === 0;
  dueMessage.textContent = dueEntries.length
    ? dueEntries.map((entry) => `${entry.greenhouseName} ${entry.row}`).join(", ")
    : "";
  updateAlertButton();
}

async function enableAlerts() {
  if (!("Notification" in window)) {
    showToast("Notifications are not supported here");
    return;
  }
  const permission = await Notification.requestPermission();
  updateAlertButton();
  showToast(permission === "granted" ? "Harvest alerts enabled" : "Notification permission not granted");
  if (permission === "granted") checkDueAlerts();
}

async function checkDueAlerts() {
  render();
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const today = formatLocalDate(new Date());
  const pending = entries.filter(
    (entry) => computeDaysLeft(entry.harvestDate) <= 0 && entry.notifiedOn !== today
  );
  if (!pending.length) return;

  const body =
    pending.length === 1
      ? `${pending[0].greenhouseName} ${pending[0].row} is ready for harvest.`
      : `${pending.length} transplant locations are due for harvest.`;

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification("Harvest due", {
        body,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: `harvest-due-${today}`
      });
    } else {
      new Notification("Harvest due", { body, icon: "./icon-192.png" });
    }
  } catch {
    new Notification("Harvest due", { body, icon: "./icon-192.png" });
  }

  const pendingIds = new Set(pending.map((entry) => entry.id));
  entries = entries.map((entry) =>
    pendingIds.has(entry.id) ? { ...entry, notifiedOn: today } : entry
  );
  saveEntries();
}

function updateAlertButton() {
  if (!("Notification" in window)) {
    alertsButton.textContent = "Alerts unavailable";
    alertsButton.disabled = true;
    return;
  }
  if (Notification.permission === "granted") {
    alertsButton.textContent = "Alerts enabled";
    alertsButton.disabled = true;
    return;
  }
  alertsButton.textContent = Notification.permission === "denied" ? "Alerts blocked" : "Enable alerts";
  alertsButton.disabled = Notification.permission === "denied";
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
}

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const normalized = normalizeEntries(JSON.parse(raw), createId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `planting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastElement.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}
