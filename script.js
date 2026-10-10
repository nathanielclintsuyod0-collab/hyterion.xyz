
"use strict";

/*
 * SERAPHYX FINANCE
 * Demo-only browser application.
 *
 * IMPORTANT:
 * This demo uses browser localStorage and client-side credentials.
 * Do not deploy it publicly with real financial or confidential data.
 * Production authentication and storage should run on a secure server.
 */

// Change these demo credentials before testing.
const ADMIN_USERNAME = "KnownAsNeo";
const ADMIN_PASSWORD = "natnat123213123";

const RECORDS_KEY = "seraphyx.finance.records.v2";
const SETTINGS_KEY = "seraphyx.finance.settings.v2";

const $ = (id) => document.getElementById(id);

const TYPE_LABELS = {
  income: "💰 Income",
  purchase: "🛍️ Purchase",
  expense: "💸 Expense",
  refund: "↩️ Refund paid",
  refund_received: "✨ Refund received"
};

const TYPE_OPTIONS = {
  income: "Income",
  purchase: "Purchase",
  expense: "Expense",
  refund: "Refund paid",
  refund_received: "Refund received"
};

let isAdmin = false;
let currentPage = "dashboard";
let noticeTimer = null;

let records = loadRecords();
let settings = loadSettings();

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) =>
      r && typeof r.id === "string" &&
      typeof r.amount === "number" && Number.isFinite(r.amount) &&
      Object.hasOwn(TYPE_LABELS, r.type)
    );
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const allowedCurrencies = ["PHP", "USD", "EUR", "SGD"];

    return {
      currency: allowedCurrencies.includes(parsed.currency)
        ? parsed.currency : "PHP",
      webhookUrl: typeof parsed.webhookUrl === "string"
        ? parsed.webhookUrl : ""
    };
  } catch {
    return { currency: "PHP", webhookUrl: "" };
  }
}

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch {
    showNotice("Unable to save data. Browser storage may be full or disabled.", true);
    return false;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    showNotice("Unable to save settings in this browser.", true);
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function money(amount) {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: settings.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${settings.currency} ${Number(amount).toFixed(2)}`;
  }
}

function dateToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000)
    .toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function isIncoming(record) {
  return record.type === "income" || record.type === "refund_received";
}

function isOutgoing(record) {
  return !isIncoming(record);
}

function sum(recordsToSum, predicate) {
  return recordsToSum
    .filter(predicate)
    .reduce((total, record) => total + record.amount, 0);
}

function totalsFor(source) {
  const income = sum(source, isIncoming);
  const outgoing = sum(source, isOutgoing);

  return {
    income,
    outgoing,
    net: income - outgoing,
    count: source.length,
    purchases: sum(source, (r) => r.type === "purchase"),
    expenses: sum(source, (r) =>
      ["expense", "refund"].includes(r.type)
    )
  };
}

function showNotice(message, isError = false) {
  const notice = $("notice");
  if (!notice) return;

  notice.textContent = message;
  notice.classList.toggle("error", isError);
  notice.hidden = false;

  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 4500);
}

// -------------------------
// Access and navigation
// -------------------------

function updateAccess() {
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.hidden = !isAdmin;
  });

  $("adminBtn").hidden = isAdmin;
  $("logoutBtn").hidden = !isAdmin;

  $("accessStatus").textContent = isAdmin ? "Admin Access" : "Public View";
  $("accessDescription").textContent = isAdmin
    ? "Transaction management enabled"
    : "Read-only dashboard";

  const dot = document.querySelector(".status-card .status-dot");
  if (dot) {
    dot.style.background = isAdmin ? "#c9a0ff" : "";
    dot.style.boxShadow = isAdmin
      ? "0 0 11px rgba(201,160,255,.6)" : "";
  }

  if (!isAdmin && currentPage !== "dashboard") {
    navigateTo("dashboard");
  }
}

function navigateTo(page) {
  const allowedPages = ["dashboard", "transactions", "reports", "settings"];

  if (!allowedPages.includes(page)) return;

  if (page !== "dashboard" && !isAdmin) {
    openLogin();
    showNotice("🔐 Sign in as an administrator to access that page.", true);
    return;
  }

  currentPage = page;

  document.querySelectorAll(".page").forEach((section) => {
    section.classList.toggle("active", section.id === page);
  });

  document.querySelectorAll("[data-page]").forEach((button) => {
    if (button.classList.contains("nav-link")) {
      button.classList.toggle("active", button.dataset.page === page);
    }
  });

  const titles = {
    dashboard: ["Dashboard ✨", "Your server finances, beautifully organized."],
    transactions: ["Transactions 🧾", "Manage the Seraphyx financial ledger."],
    reports: ["Reports 📈", "Review totals and category breakdowns."],
    settings: ["Settings ⚙️", "Manage your preferences and data backups."]
  };

  $("pageTitle").textContent = titles[page][0];
  $("pageSubtitle").textContent = titles[page][1];

  if (page === "dashboard") renderDashboard();
  if (page === "transactions") renderLedger();
  if (page === "reports") renderReport();
  if (page === "settings") renderSettings();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openLogin() {
  $("loginError").hidden = true;
  $("loginForm").reset();
  $("loginModal").hidden = false;

  setTimeout(() => $("username").focus(), 50);
}

function closeLogin() {
  $("loginModal").hidden = true;
}

function logout() {
  isAdmin = false;
  closeLogin();
  $("transactionEditor").hidden = true;
  $("transactionForm").reset();
  $("recordId").value = "";
  updateAccess();
  navigateTo("dashboard");
  showNotice("🚪 You have been logged out.");
}

$("adminBtn").addEventListener("click", openLogin);
$("closeLoginBtn").addEventListener("click", closeLogin);
$("logoutBtn").addEventListener("click", logout);

$("loginModal").addEventListener("click", (event) => {
  if (event.target === $("loginModal")) closeLogin();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("loginModal").hidden) {
    closeLogin();
  }
});

$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    isAdmin = true;
    closeLogin();
    updateAccess();
    navigateTo("transactions");
    showNotice("✨ Welcome, administrator! You now have admin access.");
  } else {
    $("loginError").hidden = false;
    $("password").value = "";
    $("password").focus();
  }
});

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo(button.dataset.page);
  });
});

// -------------------------
// Dashboard
// -------------------------

function setText(id, value) {
  $(id).textContent = value;
}

function setAmountClass(element, value) {
  element.classList.toggle("amount-positive", value > 0);
  element.classList.toggle("amount-negative", value < 0);
}

function renderDashboard() {
  const t = totalsFor(records);

  setText("dashIncome", money(t.income));
  setText("dashOutgoing", money(t.outgoing));
  setText("dashNet", money(t.net));
  setText("dashCount", String(t.count));

  setText("snapshotIncome", money(t.income));
  setText("snapshotPurchases", money(t.purchases));
  setText("snapshotExpenses", money(t.expenses));
  setText("snapshotNet", money(t.net));
  setAmountClass($("dashNet"), t.net);
  setAmountClass($("snapshotNet"), t.net);

  const recent = [...records]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 6);

  $("recentRows").innerHTML = recent.map((r) => `
    <tr>
      <td>${escapeHTML(r.description)}</td>
      <td>${escapeHTML(r.category)}</td>
      <td>${escapeHTML(formatDate(r.date))}</td>
      <td class="align-right ${isIncoming(r) ? "amount-positive" : "amount-negative"}">
        ${isIncoming(r) ? "+" : "−"}${escapeHTML(money(r.amount))}
      </td>
    </tr>
  `).join("");

  $("recentEmpty").hidden = recent.length > 0;
}

// -------------------------
// Transaction management
// -------------------------

function openTransactionEditor(record = null) {
  if (!isAdmin) {
    openLogin();
    return;
  }

  $("transactionForm").reset();
  $("recordId").value = record?.id || "";
  $("type").value = record?.type || "income";
  $("date").value = record?.date || dateToday();
  $("description").value = record?.description || "";
  $("category").value = record?.category || "";
  $("amount").value = record?.amount ?? "";
  $("vendor").value = record?.vendor || "";
  $("reference").value = record?.reference || "";
  $("payment").value = record?.payment || "Not specified";
  $("quantity").value = record?.quantity ?? "";
  $("notes").value = record?.notes || "";

  $("formTitle").textContent = record ? "✏️ Edit transaction" : "✨ Add transaction";
  $("transactionEditor").hidden = false;
  $("transactionEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  $("description").focus();
}

function closeTransactionEditor() {
  $("transactionEditor").hidden = true;
  $("transactionForm").reset();
  $("recordId").value = "";
}

$("newTransactionBtn").addEventListener("click", () => openTransactionEditor());
$("cancelTransactionBtn").addEventListener("click", closeTransactionEditor);
$("discardBtn").addEventListener("click", closeTransactionEditor);

$("transactionForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAdmin) {
    showNotice("Admin access is required to save transactions.", true);
    return;
  }

  const amount = Number($("amount").value);
  const quantity = $("quantity").value
    ? Number($("quantity").value) : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    showNotice("Enter an amount greater than zero.", true);
    return;
  }

  if (quantity !== null &&
      (!Number.isInteger(quantity) || quantity < 1)) {
    showNotice("Quantity must be a positive whole number.", true);
    return;
  }

  const existingId = $("recordId").value;
  const existing = records.find((r) => r.id === existingId);

  const record = {
    id: existingId || (
      window.crypto?.randomUUID?.() ||
      `record-${Date.now()}-${Math.random().toString(36).slice(2)}`
    ),
    type: $("type").value,
    date: $("date").value,
    description: $("description").value.trim(),
    category: $("category").value.trim(),
    amount: Math.round(amount * 100) / 100,
    vendor: $("vendor").value.trim(),
    reference: $("reference").value.trim(),
    payment: $("payment").value,
    quantity,
    notes: $("notes").value.trim(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!record.description || !record.category || !record.date) {
    showNotice("Please complete the required fields.", true);
    return;
  }

  if (existing) {
    records = records.map((r) => r.id === existingId ? record : r);
  } else {
    records.push(record);
  }

  if (!saveRecords()) return;

  closeTransactionEditor();
  renderAll();
  showNotice(existing ? "✏️ Transaction updated." : "💜 Transaction saved.");

  sendWebhookNotification(record).catch(() => {
    // Notification failure should not undo a successfully saved transaction.
  });
});

function renderLedger() {
  const search = $("ledgerSearch").value.trim().toLowerCase();
  const type = $("ledgerType").value;

  const filtered = [...records]
    .filter((r) => type === "all" || r.type === type)
    .filter((r) => [
      r.description, r.category, r.vendor, r.reference, r.notes, r.payment
    ].some((value) => String(value || "").toLowerCase().includes(search)))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  $("ledgerRows").innerHTML = filtered.map((r) => `
    <tr>
      <td>${escapeHTML(formatDate(r.date))}</td>
      <td>
        <strong>${escapeHTML(r.description)}</strong>
        ${r.vendor ? `<div class="muted-cell">${escapeHTML(r.vendor)}</div>` : ""}
      </td>
      <td><span class="type-badge">${escapeHTML(TYPE_LABELS[r.type])}</span></td>
      <td>${escapeHTML(r.category)}</td>
      <td class="align-right ${isIncoming(r) ? "amount-positive" : "amount-negative"}">
        ${isIncoming(r) ? "+" : "−"}${escapeHTML(money(r.amount))}
      </td>
      <td>
        <div class="row-actions">
          <button type="button" data-edit="${escapeHTML(r.id)}">✏️ Edit</button>
          <button type="button" class="delete-row" data-delete="${escapeHTML(r.id)}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");

  $("ledgerEmpty").hidden = filtered.length > 0;
}

$("ledgerSearch").addEventListener("input", renderLedger);
$("ledgerType").addEventListener("change", renderLedger);

$("ledgerRows").addEventListener("click", (event) => {
  if (!isAdmin) return;

  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    const record = records.find((r) => r.id === editButton.dataset.edit);
    if (record) openTransactionEditor(record);
  }

  if (deleteButton) {
    deleteRecord(deleteButton.dataset.delete);
  }
});

function deleteRecord(id) {
  if (!isAdmin) return;

  const record = records.find((r) => r.id === id);
  if (!record) return;

  if (!confirm(`Delete "${record.description}"? This cannot be undone unless backed up.`)) {
    return;
  }

  records = records.filter((r) => r.id !== id);
  if (!saveRecords()) return;

  renderAll();
  showNotice("🗑️ Transaction deleted.");
}

// -------------------------
// Reports
// -------------------------

function getReportRecords() {
  const from = $("reportFrom").value;
  const to = $("reportTo").value;

  if (from && to && from > to) {
    showNotice("The start date must be on or before the end date.", true);
    return null;
  }

  return records.filter((r) =>
    (!from || r.date >= from) &&
    (!to || r.date <= to)
  );
}

function renderReport() {
  const filtered = getReportRecords();
  if (!filtered) return;

  const t = totalsFor(filtered);

  setText("reportIncome", money(t.income));
  setText("reportOutgoing", money(t.outgoing));
  setText("reportNet", money(t.net));
  setText("reportCount", String(t.count));
  setAmountClass($("reportNet"), t.net);

  const categoryTotals = new Map();

  filtered.filter(isOutgoing).forEach((r) => {
    const category = r.category || "Uncategorized";
    categoryTotals.set(
      category,
      (categoryTotals.get(category) || 0) + r.amount
    );
  });

  const sorted = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1]);

  const max = Math.max(...sorted.map((entry) => entry[1]), 1);

  $("categoryBreakdown").innerHTML = sorted.map(([category, amount]) => `
    <div class="breakdown-item">
      <span>${escapeHTML(category)}</span>
      <div class="breakdown-track">
        <div class="breakdown-fill" style="width:${Math.min(100, amount / max * 100)}%"></div>
      </div>
      <strong>${escapeHTML(money(amount))}</strong>
    </div>
  `).join("");

  $("breakdownEmpty").hidden = sorted.length > 0;
}

$("runReportBtn").addEventListener("click", renderReport);

$("clearReportBtn").addEventListener("click", () => {
  $("reportFrom").value = "";
  $("reportTo").value = "";
  renderReport();
});

// -------------------------
// CSV export
// -------------------------

function csvEscape(value) {
  const string = String(value ?? "");
  return `"${string.replace(/"/g, '""')}"`;
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(source, filename) {
  if (!isAdmin) {
    showNotice("Admin access is required to export records.", true);
    return;
  }

  const header = [
    "Date", "Description", "Type", "Category", "Amount",
    "Vendor", "Reference", "Payment", "Quantity", "Notes"
  ];

  const rows = source.map((r) => [
    r.date,
    r.description,
    TYPE_OPTIONS[r.type] || r.type,
    r.category,
    r.amount.toFixed(2),
    r.vendor,
    r.reference,
    r.payment,
    r.quantity ?? "",
    r.notes
  ]);

  // UTF-8 BOM helps spreadsheet programs open the file correctly.
  const csv = "\uFEFF" + [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  downloadBlob(csv, filename, "text/csv;charset=utf-8");
  showNotice("📥 CSV export downloaded.");
}

$("exportCsvBtn").addEventListener("click", () => {
  exportCsv(records, "seraphyx-transactions.csv");
});

$("reportCsvBtn").addEventListener("click", () => {
  const filtered = getReportRecords();
  if (filtered) exportCsv(filtered, "seraphyx-finance-report.csv");
});

// -------------------------
// Settings and backups
// -------------------------

function renderSettings() {
  $("currency").value = settings.currency;
  $("webhookUrl").value = settings.webhookUrl;
}

$("saveSettingsBtn").addEventListener("click", () => {
  if (!isAdmin) return;

  settings.currency = $("currency").value;

  if (saveSettings()) {
    document.querySelectorAll(".currencyLabel").forEach((el) => {
      el.textContent = settings.currency;
    });

    renderAll();
    showNotice("⚙️ Currency preference saved.");
  }
});

$("saveWebhookBtn").addEventListener("click", () => {
  if (!isAdmin) return;

  const value = $("webhookUrl").value.trim();

  if (value && !/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[^/\s]+\/?$/.test(value)) {
    showNotice("Enter a valid Discord webhook URL, or leave the field empty.", true);
    return;
  }

  settings.webhookUrl = value;

  if (saveSettings()) {
    showNotice("🔔 Webhook setting saved.");
  }
});

function exportBackup() {
  if (!isAdmin) return;

  const backup = {
    application: "Seraphyx Finance",
    version: 2,
    exportedAt: new Date().toISOString(),
    records,
    settings
  };

  downloadBlob(
    JSON.stringify(backup, null, 2),
    `seraphyx-backup-${dateToday()}.json`,
    "application/json"
  );

  showNotice("💾 JSON backup downloaded.");
}

$("backupBtn").addEventListener("click", exportBackup);

$("restoreFile").addEventListener("change", async (event) => {
  if (!isAdmin) return;

  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Backup file is too large (maximum 10 MB).");
    }

    const parsed = JSON.parse(await file.text());
    const incomingRecords = Array.isArray(parsed) ? parsed : parsed.records;

    if (!Array.isArray(incomingRecords)) {
      throw new Error("This file does not contain a valid transaction list.");
    }

    const allowedTypes = Object.keys(TYPE_LABELS);
    const cleanRecords = incomingRecords.map((r) => {
      if (!r || typeof r !== "object") {
        throw new Error("A transaction entry is invalid.");
      }

      const amount = Number(r.amount);
      if (
        !allowedTypes.includes(r.type) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        typeof r.description !== "string" ||
        typeof r.category !== "string" ||
        typeof r.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.date)
      ) {
        throw new Error("A transaction has invalid or missing fields.");
      }

      return {
        id: typeof r.id === "string" && r.id
          ? r.id : `restored-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: r.type,
        date: r.date,
        description: r.description.slice(0, 120),
        category: r.category.slice(0, 60),
        amount: Math.round(amount * 100) / 100,
        vendor: String(r.vendor || "").slice(0, 100),
        reference: String(r.reference || "").slice(0, 100),
        payment: String(r.payment || "Not specified").slice(0, 50),
        quantity: Number.isInteger(Number(r.quantity)) && Number(r.quantity) > 0
          ? Number(r.quantity) : null,
        notes: String(r.notes || "").slice(0, 1000),
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: r.updatedAt || new Date().toISOString()
      };
    });

    if (!confirm(`Restore ${cleanRecords.length} transactions? This replaces the current transaction list.`)) {
      return;
    }

    const previousRecords = records;
    records = cleanRecords;

    if (!saveRecords()) {
      records = previousRecords;
      return;
    }

    if (parsed && !Array.isArray(parsed) && parsed.settings) {
      const currency = parsed.settings.currency;
      if (["PHP", "USD", "EUR", "SGD"].includes(currency)) {
        settings.currency = currency;
        saveSettings();
      }
    }

    renderAll();
    showNotice(`💾 Restored ${records.length} transactions.`);
  } catch (error) {
    showNotice(error.message || "Unable to restore this backup.", true);
  } finally {
    event.target.value = "";
  }
});

$("clearRecordsBtn").addEventListener("click", () => {
  if (!isAdmin) return;

  const confirmation = prompt(
    'This permanently removes all locally saved transactions. Type DELETE to confirm.'
  );

  if (confirmation !== "DELETE") {
    showNotice("Deletion cancelled.");
    return;
  }

  records = [];
  if (!saveRecords()) return;

  renderAll();
  showNotice("🗑️ All transactions have been removed.");
});

// -------------------------
// Optional Discord webhook
// -------------------------

async function sendWebhookNotification(record) {
  const url = settings.webhookUrl;
  if (!url) return;

  // Revalidate the stored value before using it.
  if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[^/\s]+\/?$/.test(url)) {
    return;
  }

  const payload = {
    username: "Seraphyx Finance",
    embeds: [{
      title: "🧾 Transaction recorded",
      color: isIncoming(record) ? 0x80E8BD : 0xB48BCF,
      fields: [
        { name: "Description", value: record.description.slice(0, 200), inline: true },
        { name: "Type", value: TYPE_OPTIONS[record.type], inline: true },
        { name: "Amount", value: money(record.amount), inline: true },
        { name: "Category", value: record.category.slice(0, 100), inline: true },
        { name: "Date", value: record.date, inline: true }
      ],
      footer: { text: "Seraphyx Finance • Private admin notification" },
      timestamp: new Date().toISOString()
    }]
  };

  // Browser requests may be blocked by Discord CORS policy.
  // For production, send notifications through a secure server instead.
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn("Discord notification could not be sent.", error);
  }
}

// -------------------------
// Dynamic animated background
// -------------------------

function createBackground() {
  const particleContainer = $("particles");
  const emojiContainer = $("floatingEmojis");

  if (!particleContainer || !emojiContainer) return;

  particleContainer.replaceChildren();
  emojiContainer.replaceChildren();

  for (let i = 0; i < 65; i++) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.setProperty("--duration", `${3 + Math.random() * 6}s`);
    particle.style.animationDelay = `${Math.random() * -8}s`;
    particleContainer.appendChild(particle);
  }

  const emojis = ["💸", "💎", "💰", "✨", "📈", "🪙", "🌙", "✦", "💜"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) return;

  function spawnEmoji() {
    const emoji = document.createElement("span");
    emoji.className = "floating-emoji";
    emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    emoji.style.left = `${Math.random() * 100}%`;
    emoji.style.setProperty("--size", `${15 + Math.random() * 19}px`);
    emoji.style.setProperty("--duration", `${14 + Math.random() * 15}s`);
    emoji.style.setProperty("--drift", `${Math.round(Math.random() * 140 - 70)}px`);

    emojiContainer.appendChild(emoji);

    setTimeout(() => emoji.remove(), 30000);
  }

  for (let i = 0; i < 10; i++) {
    setTimeout(spawnEmoji, i * 700);
  }

  setInterval(spawnEmoji, 1500);
}

// -------------------------
// Initialize
// -------------------------

function renderAll() {
  renderDashboard();

  if (isAdmin) {
    renderLedger();
    renderReport();
    renderSettings();
  }

  document.querySelectorAll(".currencyLabel").forEach((el) => {
    el.textContent = settings.currency;
  });
}

function initialize() {
  $("date").value = dateToday();

  updateAccess();
  renderAll();
  createBackground();

  // The page always starts in public view.
  // Admin access is granted only after the login form succeeds.
  navigateTo("dashboard");
}

initialize();
