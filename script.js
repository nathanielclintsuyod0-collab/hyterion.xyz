
(() => {
  "use strict";

  // Demo-only credentials. These are visible to anyone who can view this source.
  const ADMIN_USERNAME = "KnownAsNeo";
  const ADMIN_PASSWORD = "natnat131309";

  const STORAGE_KEY = "seraphyx.finance.records.v1";
  const SETTINGS_KEY = "seraphyx.finance.settings.v1";

  const $ = id => document.getElementById(id);

  const TYPES = {
    income: "Income",
    purchase: "Purchase",
    expense: "Expense",
    refund: "Refund issued",
    refund_received: "Refund received"
  };

  const CATEGORIES = {
    income: ["Store sales", "Rank sales", "Donations", "Services", "Other income"],
    purchase: ["Plugins", "Goods", "Hosting", "Advertising", "Development", "Equipment", "Other purchase"],
    expense: ["Server hosting", "Domain", "Advertising", "Development", "Staff", "Software", "Other expense"],
    refund: ["Store refund", "Purchase refund", "Service refund", "Other refund"],
    refund_received: ["Supplier refund", "Payment reversal", "Other refund received"]
  };

  let isAdmin = false;
  let records = loadRecords();
  let settings = loadSettings();
  let reportRecords = [];
  let toastTimer;

  function loadRecords() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data.filter(validRecord) : [];
    } catch {
      return [];
    }
  }

  function validRecord(r) {
    return !!r && typeof r.id === "string" && !!TYPES[r.type] &&
      typeof r.date === "string" && typeof r.description === "string" &&
      Number.isFinite(r.amount) && r.amount > 0;
  }

  function loadSettings() {
    try {
      const data = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return {
        webhook: typeof data.webhook === "string" ? data.webhook : "",
        enabled: data.enabled === true
      };
    } catch {
      return { webhook: "", enabled: false };
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch {
      toast("Could not save data. Browser storage may be full or disabled.");
      return false;
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch {
      toast("Could not save settings.");
      return false;
    }
  }

  function money(value) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP"
    }).format(value || 0);
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function toast(message) {
    const node = $("toast");
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.hidden = true, 3200);
  }

  function sum(types, list = records) {
    return list.reduce((total, r) => total + (types.includes(r.type) ? r.amount : 0), 0);
  }

  function totals(list = records) {
    const income = sum(["income", "refund_received"], list);
    const costs = sum(["purchase", "expense"], list);
    const refunds = sum(["refund"], list);
    return { income, costs, refunds, net: income - costs - refunds };
  }

  function signedAmount(r) {
    const positive = ["income", "refund_received"].includes(r.type);
    return `${positive ? "+" : "−"}${money(r.amount)}`;
  }

  function render() {
    renderDashboard();
    renderLedger();
    renderReport();
  }

  function renderDashboard() {
    const t = totals();

    $("dashIncome").textContent = money(t.income);
    $("dashExpenses").textContent = money(t.costs);
    $("dashNet").textContent = money(t.net);
    $("dashNet").className = `stat-value ${t.net < 0 ? "amount-negative" : "amount-positive"}`;
    $("dashCount").textContent = records.length;
    $("dashRefundCount").textContent =
      `${records.filter(r => r.type === "refund").length} refunds issued`;

    $("barIncomeLabel").textContent = money(t.income);
    $("barExpensesLabel").textContent = money(t.costs);
    $("barRefundsLabel").textContent = money(t.refunds);
    $("overviewNet").textContent = money(t.net);
    $("overviewNet").style.color = t.net < 0 ? "var(--red)" : "var(--green)";

    const max = Math.max(t.income, t.costs, t.refunds, 1);
    $("barIncome").style.width = `${t.income / max * 100}%`;
    $("barExpenses").style.width = `${t.costs / max * 100}%`;
    $("barRefunds").style.width = `${t.refunds / max * 100}%`;

    $("incomeCount").textContent =
      records.filter(r => ["income", "refund_received"].includes(r.type)).length;
    $("expenseCount").textContent =
      records.filter(r => ["purchase", "expense"].includes(r.type)).length;
    $("refundAmount").textContent = money(t.refunds);

    const sorted = [...records].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)
    );

    $("lastActivity").textContent = sorted[0]?.date || "None";

    $("recentRows").innerHTML = sorted.slice(0, 6).map(r => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.description)}</td>
        <td><span class="type-pill">${TYPES[r.type]}</span></td>
        <td class="${["income", "refund_received"].includes(r.type) ? "amount-positive" : "amount-negative"}">${signedAmount(r)}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="empty-cell">No transactions recorded yet.</td></tr>`;
  }

  function filteredRecords() {
    const query = $("searchLedger").value.trim().toLowerCase();
    const type = $("filterType").value;
    const from = $("filterFrom").value;
    const to = $("filterTo").value;

    return [...records].filter(r =>
      (!query || [r.description, r.vendor, r.reference, r.category, r.notes]
        .some(v => String(v || "").toLowerCase().includes(query))) &&
      (!type || r.type === type) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to)
    ).sort((a, b) => b.date.localeCompare(a.date) ||
      (b.createdAt || 0) - (a.createdAt || 0));
  }

  function renderLedger() {
    const target = $("ledgerRows");
    if (!target) return;

    target.innerHTML = filteredRecords().map(r => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.description)}</td>
        <td><span class="type-pill">${TYPES[r.type]}</span></td>
        <td>${escapeHtml(r.category)}</td>
        <td class="${["income", "refund_received"].includes(r.type) ? "amount-positive" : "amount-negative"}">${signedAmount(r)}</td>
        <td><div class="row-actions">
          <button class="mini-button" data-edit="${escapeHtml(r.id)}">Edit</button>
          <button class="mini-button delete" data-delete="${escapeHtml(r.id)}">Delete</button>
        </div></td>
      </tr>
    `).join("") || `<tr><td colspan="6" class="empty-cell">No matching transactions.</td></tr>`;
  }

  function renderReport() {
    const from = $("reportFrom").value;
    const to = $("reportTo").value;
    const type = $("reportType").value;

    reportRecords = records.filter(r =>
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      (!type || r.type === type)
    );

    const t = totals(reportRecords);
    $("reportIncome").textContent = money(sum(["income", "refund_received"], reportRecords));
    $("reportExpenses").textContent = money(t.costs);
    $("reportRefunds").textContent = money(t.refunds);
    $("reportNet").textContent = money(t.net);
    $("reportNet").className = t.net < 0 ? "amount-negative" : "amount-positive";

    const months = {};
    reportRecords.forEach(r => {
      if (!months[r.date.slice(0, 7)]) months[r.date.slice(0, 7)] = [];
      months[r.date.slice(0, 7)].push(r);
    });

    $("reportRows").innerHTML = Object.keys(months).sort().reverse().map(month => {
      const m = totals(months[month]);
      return `<tr>
        <td>${escapeHtml(month)}</td>
        <td class="amount-positive">${money(m.income)}</td>
        <td class="amount-negative">${money(m.costs)}</td>
        <td>${money(m.refunds)}</td>
        <td class="${m.net < 0 ? "amount-negative" : "amount-positive"}">${money(m.net)}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="5" class="empty-cell">No entries in this date range.</td></tr>`;
  }

  function fillCategories(selected) {
    const options = CATEGORIES[$("type").value] || CATEGORIES.income;
    $("category").innerHTML = options.map(c =>
      `<option ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`
    ).join("");
  }

  function clearForm() {
    $("transactionForm").reset();
    $("recordId").value = "";
    $("date").value = today();
    $("quantity").value = "1";
    $("formHeading").textContent = "Add transaction";
    fillCategories();
  }

  function showPage(pageId) {
    if (pageId !== "dashboard" && !isAdmin) {
      toast("Admin login required.");
      pageId = "dashboard";
    }

    document.querySelectorAll(".page").forEach(p =>
      p.classList.toggle("active", p.id === pageId)
    );
    document.querySelectorAll(".nav-link").forEach(b =>
      b.classList.toggle("active", b.dataset.page === pageId)
    );

    const titles = {
      dashboard: ["Public Dashboard", "A clear overview of server finances."],
      transactions: ["Transactions", "Manage the finance ledger."],
      reports: ["Financial Reports", "Review totals by date range."],
      settings: ["Admin Settings", "Manage backups and notifications."]
    };

    $("pageTitle").textContent = titles[pageId][0];
    $("pageSubtitle").textContent = titles[pageId][1];
    if (pageId === "transactions") renderLedger();
    if (pageId === "reports") renderReport();
  }

  function updateAccess() {
    document.querySelectorAll(".admin-only").forEach(el => el.hidden = !isAdmin);
    $("loginOpen").hidden = isAdmin;
    $("logoutButton").hidden = !isAdmin;
    $("sessionBadge").textContent = isAdmin ? "ADMIN SESSION" : "PUBLIC VIEW";
    showPage("dashboard");
  }

  function openLogin() {
    $("username").value = "";
    $("password").value = "";
    $("loginError").hidden = true;
    $("loginModal").hidden = false;
    setTimeout(() => $("username").focus(), 50);
  }

  function closeLogin() {
    $("loginModal").hidden = true;
  }

  function editRecord(id) {
    if (!isAdmin) return;
    const r = records.find(item => item.id === id);
    if (!r) return;

    showPage("transactions");
    $("recordId").value = r.id;
    $("type").value = r.type;
    fillCategories(r.category);

    ["date", "description", "amount", "vendor", "reference", "payment", "quantity", "notes"]
      .forEach(key => $(key).value = r[key] ?? "");

    $("formHeading").textContent = "Edit transaction";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function downloadFile(filename, contents, mime) {
    const url = URL.createObjectURL(new Blob([contents], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv(list) {
    const columns = ["date", "type", "description", "category", "amount",
      "quantity", "vendor", "reference", "payment", "notes"];
    const rows = [
      columns.join(","),
      ...list.map(r => columns.map(key =>
        `"${String(r[key] ?? "").replace(/"/g, '""')}"`
      ).join(","))
    ];
    downloadFile(`seraphyx-finance-${today()}.csv`, "\uFEFF" + rows.join("\r\n"), "text/csv;charset=utf-8");
  }

  async function sendDiscord(record) {
    if (!settings.enabled || !settings.webhook) return;

    if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w.-]+/.test(settings.webhook)) {
      toast("Saved, but the Discord webhook URL is invalid.");
      return;
    }

    const embed = {
      title: "Seraphyx Finance · Transaction recorded",
      color: record.type === "income" ? 0x79dfae : 0xbd91dc,
      fields: [
        { name: "Type", value: TYPES[record.type], inline: true },
        { name: "Amount", value: money(record.amount), inline: true },
        { name: "Date", value: record.date, inline: true },
        { name: "Description", value: record.description.slice(0, 900) },
        { name: "Category", value: record.category, inline: true }
      ],
      footer: { text: "Seraphyx Finance" }
    };

    try {
      const response = await fetch(settings.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] })
      });
      if (!response.ok) throw new Error("Request failed");
      toast("Transaction saved and Discord notified.");
    } catch {
      toast("Saved, but Discord notification failed. Check the webhook.");
    }
  }

  // Navigation and login
  document.querySelectorAll(".nav-link").forEach(button =>
    button.addEventListener("click", () => showPage(button.dataset.page))
  );
  $("loginOpen").addEventListener("click", openLogin);
  $("closeLogin").addEventListener("click", closeLogin);
  $("loginModal").addEventListener("click", e => {
    if (e.target === $("loginModal")) closeLogin();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("loginModal").hidden) closeLogin();
  });

  $("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    if ($("username").value.trim() !== ADMIN_USERNAME ||
        $("password").value !== ADMIN_PASSWORD) {
      $("loginError").hidden = false;
      $("password").select();
      return;
    }
    isAdmin = true;
    closeLogin();
    updateAccess();
    toast("Welcome, KnownAsNeo. Admin panel unlocked.");
  });

  $("logoutButton").addEventListener("click", () => {
    isAdmin = false;
    updateAccess();
    toast("You have been logged out.");
  });

  // Transaction form
  $("type").addEventListener("change", () => fillCategories());
  $("cancelForm").addEventListener("click", clearForm);
  $("newTransaction").addEventListener("click", () => {
    clearForm();
    $("description").focus();
  });

  $("transactionForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!isAdmin) return toast("Admin login required.");

    const amount = Number($("amount").value);
    const quantity = Number($("quantity").value || 1);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9 ||
        !Number.isInteger(quantity) || quantity < 1) {
      return toast("Enter a valid amount and quantity.");
    }

    const oldId = $("recordId").value;
    const old = records.find(r => r.id === oldId);
    const record = {
      id: oldId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      type: $("type").value,
      date: $("date").value,
      description: $("description").value.trim(),
      category: $("category").value,
      amount: Math.round(amount * 100) / 100,
      quantity,
      vendor: $("vendor").value.trim(),
      reference: $("reference").value.trim(),
      payment: $("payment").value,
      notes: $("notes").value.trim(),
      createdAt: old?.createdAt || Date.now()
    };

    if (!record.date || !record.description) return toast("Complete all required fields.");

    if (old) records = records.map(r => r.id === oldId ? record : r);
    else records.push(record);

    if (!saveRecords()) return;
    clearForm();
    render();
    toast(old ? "Transaction updated." : "Transaction saved.");
    if (!old) await sendDiscord(record);
  });

  ["searchLedger", "filterType", "filterFrom", "filterTo"].forEach(id =>
    $(id).addEventListener("input", renderLedger)
  );

  document.addEventListener("click", e => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");

    if (edit && isAdmin) editRecord(edit.dataset.edit);

    if (del && isAdmin) {
      const record = records.find(r => r.id === del.dataset.delete);
      if (record && confirm(`Delete "${record.description}" (${money(record.amount)})?`)) {
        records = records.filter(r => r.id !== record.id);
        if (saveRecords()) {
          render();
          toast("Transaction deleted.");
        }
      }
    }
  });

  $("exportCsv").addEventListener("click", () => {
    if (isAdmin) exportCsv(filteredRecords());
  });
  $("reportCsv").addEventListener("click", () => {
    if (isAdmin) exportCsv(reportRecords);
  });
  $("generateReport").addEventListener("click", renderReport);
  ["reportFrom", "reportTo", "reportType"].forEach(id =>
    $(id).addEventListener("change", renderReport)
  );

  // Settings and backups
  $("webhook").value = settings.webhook;
  $("discordEnabled").checked = settings.enabled;

  $("discordForm").addEventListener("submit", e => {
    e.preventDefault();
    if (!isAdmin) return;
    settings = {
      webhook: $("webhook").value.trim(),
      enabled: $("discordEnabled").checked
    };
    if (settings.enabled && !settings.webhook) {
      return toast("Enter a webhook URL or disable notifications.");
    }
    if (saveSettings()) toast("Discord settings saved.");
  });

  $("testWebhook").addEventListener("click", async () => {
    if (!isAdmin) return;
    const webhook = $("webhook").value.trim();
    if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w.-]+/.test(webhook)) {
      return toast("Enter a valid Discord webhook URL.");
    }
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "✦ Seraphyx Finance test notification." })
      });
      if (!response.ok) throw new Error();
      toast("Test notification sent.");
    } catch {
      toast("Test failed. Check the webhook URL and browser restrictions.");
    }
  });

  $("backupJson").addEventListener("click", () => {
    if (!isAdmin) return;
    downloadFile("seraphyx-finance-backup.json", JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      records,
      settings
    }, null, 2), "application/json");
  });

  $("restoreJson").addEventListener("click", () => {
    if (isAdmin) $("restoreFile").click();
  });

  $("restoreFile").addEventListener("change", async e => {
    if (!isAdmin) return;
    const file = e.target.files[0];
    if (!file) return;

    try {
      const backup = JSON.parse(await file.text());
      if (!backup || !Array.isArray(backup.records) ||
          !backup.records.every(validRecord)) {
        throw new Error("Invalid backup format.");
      }
      if (!confirm(`Replace current records with ${backup.records.length} imported records?`)) return;

      records = backup.records;
      if (backup.settings && typeof backup.settings === "object") {
        settings = {
          webhook: typeof backup.settings.webhook === "string" ? backup.settings.webhook : "",
          enabled: backup.settings.enabled === true
        };
      }

      if (saveRecords() && saveSettings()) {
        $("webhook").value = settings.webhook;
        $("discordEnabled").checked = settings.enabled;
        render();
        toast("Backup imported successfully.");
      }
    } catch (error) {
      toast(`Import failed: ${error.message}`);
    } finally {
      e.target.value = "";
    }
  });

  $("deleteAll").addEventListener("click", () => {
    if (!isAdmin) return;
    if (confirm("Delete every transaction in this browser? Export a backup first if needed.")) {
      records = [];
      if (saveRecords()) {
        render();
        toast("All transaction records deleted.");
      }
    }
  });

  // Initial setup
  $("currentDate").textContent = new Date().toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric"
  });
  $("date").value = today();
  $("reportFrom").value = `${today().slice(0, 7)}-01`;
  $("reportTo").value = today();
  fillCategories();
  render();
  updateAccess();
})();

