/* ============================================
   EXPENSES TRACKER - App Logic
   ============================================ */

// ===== STORAGE =====
const STORAGE_KEY = "expenses-tracker-data";

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { expenses: [], income: [] };
  } catch {
    return { expenses: [], income: [] };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let db = loadData();

// ===== STATE =====
let viewDate = new Date();
let chartMode = "monthly";
let expenseChartMode = "monthly";
let incomeChartMode = "monthly";
let currentPage = "expenses";
let allTimeMode = false;
let mainChart = null;
let expenseChart = null;
let incomeChart = null;

// ===== CATEGORIES =====
const CATEGORIES = [
  { value: "Food", label: "🍔 Food", color: "#f97316" },
  { value: "GYM", label: "🏋️ GYM", color: "#8b5cf6" },
  { value: "Gas", label: "⛽ Gas", color: "#eab308" },
  { value: "P.N", label: "📌 P.N (Personal Needs)", color: "#ec4899" },
  { value: "Transport", label: "🚌 Transport", color: "#06b6d4" },
  { value: "Bills", label: "🧾 Bills", color: "#3b82f6" },
  { value: "Shopping", label: "🛍️ Shopping", color: "#f43f5e" },
  { value: "Health", label: "💊 Health", color: "#22c55e" },
  { value: "Entertainment", label: "🎮 Entertainment", color: "#a855f7" },
  { value: "Education", label: "📚 Education", color: "#14b8a6" },
];

// ===== DOM ELEMENTS =====
const el = {
  monthLabel: document.getElementById("currentMonthLabel"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  totalExpenses: document.getElementById("totalExpenses"),
  totalIncome: document.getElementById("totalIncome"),
  balance: document.getElementById("balance"),
  expenseForm: document.getElementById("expenseForm"),
  incomeForm: document.getElementById("incomeForm"),
  categoryGrid: document.getElementById("categoryGrid"),
  expenseHistoryList: document.getElementById("expenseHistoryList"),
  incomeHistoryList: document.getElementById("incomeHistoryList"),
  expenseCount: document.getElementById("expenseCount"),
  incomeCount: document.getElementById("incomeCount"),
  categoryBreakdown: document.getElementById("categoryBreakdown"),
  categoryMonthLabel: document.getElementById("categoryMonthLabel"),
  clearMonth: document.getElementById("clearMonth"),
  yearSelect: document.getElementById("yearSelect"),
  allTimeToggle: document.getElementById("allTimeToggle"),
  allTimeValue: document.getElementById("allTimeValue"),
  navTabs: document.querySelectorAll(".nav-tab"),
  navIndicator: document.getElementById("navIndicator"),
};

// ===== HELPERS =====
function fmt(amount) {
  return "₱" + Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getMonthKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function getMonthName(date) {
  return date.toLocaleString("en-PH", { month: "long", year: "numeric" });
}

function getItemsForMonth(type) {
  const key = getMonthKey(viewDate);
  return db[type].filter((item) => item.date.startsWith(key));
}

// Returns items for the current view: all-time or the selected month
function getItems(type) {
  return allTimeMode ? db[type] : getItemsForMonth(type);
}

function showToast(msg, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function getCategoryColor(name) {
  const c = CATEGORIES.find((x) => x.value === name);
  return c ? c.color : "#ef4444";
}

// ===== CATEGORY CHIPS =====
function buildCategoryGrid() {
  el.categoryGrid.innerHTML =
    CATEGORIES.map(
      (cat) => `
      <label class="category-chip">
        <input type="checkbox" name="category" value="${cat.value}" />
        <span>${cat.label}</span>
      </label>`
    ).join("") +
    `
    <label class="category-chip category-all">
      <input type="checkbox" id="selectAllCategories" />
      <span>✅ Select All</span>
    </label>`;

  document.getElementById("selectAllCategories").addEventListener("change", (e) => {
    el.categoryGrid.querySelectorAll('input[name="category"]').forEach((cb) => {
      cb.checked = e.target.checked;
    });
  });

  el.categoryGrid.addEventListener("change", (e) => {
    if (e.target.name === "category") {
      const boxes = el.categoryGrid.querySelectorAll('input[name="category"]');
      document.getElementById("selectAllCategories").checked = [...boxes].every((b) => b.checked);
    }
  });
}

// ===== NAVIGATION =====
function switchPage(page) {
  currentPage = page;

  el.navTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.page === page);
  });

  document.querySelectorAll(".page").forEach((p) => {
    p.classList.toggle("active", p.id === `page-${page}`);
  });

  // Re-render active page content
  if (page === "graph") {
    renderChart();
    renderCategoryBreakdown();
  } else if (page === "expenses") {
    renderExpenseHistory();
  } else if (page === "income") {
    renderIncomeHistory();
  }

  moveNavIndicator();
}

function moveNavIndicator() {
  const active = document.querySelector(".nav-tab.active");
  if (!active || !el.navIndicator) return;
  el.navIndicator.style.width = active.offsetWidth + "px";
  el.navIndicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

// ===== CHART HELPERS =====
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Build labels + series for a given mode
function buildChartData(mode) {
  let labels, expSeries, incSeries;

  if (mode === "monthly") {
    const year = viewDate.getFullYear();
    labels = MONTH_SHORT;
    expSeries = new Array(12).fill(0);
    incSeries = new Array(12).fill(0);

    db.expenses.forEach((e) => {
      const d = new Date(e.date + "T00:00:00");
      if (d.getFullYear() === year) expSeries[d.getMonth()] += e.amount;
    });
    db.income.forEach((i) => {
      const d = new Date(i.date + "T00:00:00");
      if (d.getFullYear() === year) incSeries[d.getMonth()] += i.amount;
    });
  } else {
    const yearsSet = new Set();
    yearsSet.add(viewDate.getFullYear());
    db.expenses.forEach((e) => yearsSet.add(new Date(e.date + "T00:00:00").getFullYear()));
    db.income.forEach((i) => yearsSet.add(new Date(i.date + "T00:00:00").getFullYear()));

    const years = [...yearsSet].sort((a, b) => a - b);
    labels = years.map(String);
    expSeries = years.map(() => 0);
    incSeries = years.map(() => 0);

    db.expenses.forEach((e) => {
      const y = new Date(e.date + "T00:00:00").getFullYear();
      const idx = years.indexOf(y);
      if (idx !== -1) expSeries[idx] += e.amount;
    });
    db.income.forEach((i) => {
      const y = new Date(i.date + "T00:00:00").getFullYear();
      const idx = years.indexOf(y);
      if (idx !== -1) incSeries[idx] += i.amount;
    });
  }

  return { labels, expSeries, incSeries };
}

function barDataset(label, data, color, rgba) {
  return {
    label,
    data,
    backgroundColor: rgba,
    borderColor: color,
    borderWidth: 2,
    borderRadius: 6,
    borderSkipped: false,
  };
}

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1e293b",
      titleColor: "#f1f5f9",
      bodyColor: "#cbd5e1",
      borderColor: "#475569",
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)}` },
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(71, 85, 105, 0.3)" },
      ticks: { color: "#94a3b8", font: { size: 12 } },
    },
    y: {
      grid: { color: "rgba(71, 85, 105, 0.3)" },
      ticks: {
        color: "#94a3b8",
        font: { size: 12 },
        callback: (v) => (v >= 1000 ? "₱" + (v / 1000).toFixed(0) + "k" : "₱" + v),
      },
    },
  },
};

// ===== CHARTS =====
function drawChart(canvasId, instance, datasets, labels) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return instance;

  if (instance) instance.destroy();
  return new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: CHART_OPTIONS,
  });
}

function renderChart() {
  if (currentPage !== "graph") return;
  const { labels, expSeries, incSeries } = buildChartData(chartMode);

  mainChart = drawChart("mainChart", mainChart, [
    barDataset("Expenses", expSeries, "#ef4444", "rgba(239, 68, 68, 0.7)"),
    barDataset("Income", incSeries, "#22c55e", "rgba(34, 197, 94, 0.7)"),
  ], labels);

  // Expenses-only graph
  const expData = buildChartData(expenseChartMode);
  expenseChart = drawChart("expenseChart", expenseChart, [
    barDataset("Expenses", expData.expSeries, "#ef4444", "rgba(239, 68, 68, 0.75)"),
  ], expData.labels);

  // Income-only graph
  const incData = buildChartData(incomeChartMode);
  incomeChart = drawChart("incomeChart", incomeChart, [
    barDataset("Income", incData.incSeries, "#22c55e", "rgba(34, 197, 94, 0.75)"),
  ], incData.labels);
}

// ===== CATEGORY BREAKDOWN (Graph page) =====
function renderCategoryBreakdown() {
  if (currentPage !== "graph") return;
  const expenses = getItems("expenses");
  el.categoryMonthLabel.textContent = allTimeMode ? "All Time ⏳" : getMonthName(viewDate);

  if (expenses.length === 0) {
    el.categoryBreakdown.innerHTML = `<p class="empty-msg">No expenses yet ${allTimeMode ? "at all" : "this month"}.</p>`;
    return;
  }

  const totals = {};
  expenses.forEach((exp) => {
    exp.categories.forEach((cat) => {
      totals[cat] = (totals[cat] || 0) + exp.amount;
    });
  });

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const maxAmount = Math.max(...Object.values(totals));

  el.categoryBreakdown.innerHTML = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => {
      const pct = grandTotal ? ((amount / grandTotal) * 100).toFixed(1) : 0;
      const barWidth = maxAmount ? (amount / maxAmount) * 100 : 0;
      const color = getCategoryColor(cat);
      return `
        <div class="breakdown-item">
          <div class="breakdown-row">
            <span class="breakdown-name">${esc(cat)}</span>
            <span class="breakdown-amount" style="color:${color}">${fmt(amount)}</span>
          </div>
          <div class="breakdown-bar-bg">
            <div class="breakdown-bar" style="width:${barWidth}%;background:${color}"></div>
          </div>
          <div class="breakdown-row">
            <span style="color:var(--text-dim);font-size:0.8rem">${pct}% of total</span>
          </div>
        </div>`;
    })
    .join("");
}

// ===== HISTORIES =====
function historyItemHTML(item, type) {
  const desc =
    item.description && item.description.trim()
      ? esc(item.description)
      : type === "expense"
        ? esc((item.categories || []).join(", ") || "Expense")
        : "Income";
  return `
    <div class="history-item" data-id="${item.id}" data-type="${type}">
      <div class="history-icon ${type}">
        ${type === "expense" ? "💸" : "💰"}
      </div>
      <div class="history-details">
        <div class="history-desc ${item.description && item.description.trim() ? "" : "desc-empty"}">${desc}</div>
        <div class="history-meta">
          <span>📅 ${formatDate(item.date)}</span>
          ${type === "expense" && item.categories?.length
            ? `<span class="history-tags">${item.categories
                .map((c) => `<span class="history-tag" style="color:${getCategoryColor(c)}">${esc(c)}</span>`)
                .join("")}</span>`
            : ""}
        </div>
      </div>
      <div class="history-amount ${type}">
        ${type === "expense" ? "-" : "+"}${fmt(item.amount)}
      </div>
      <button class="history-delete" title="Delete">✕</button>
    </div>`;
}

function renderExpenseHistory() {
  const items = getItems("expenses").sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id
  );
  el.expenseCount.textContent = items.length;
  el.expenseHistoryList.innerHTML =
    items.length === 0
      ? `<p class="empty-msg">No expenses yet this month.</p>`
      : items.map((i) => historyItemHTML(i, "expense")).join("");
}

function renderIncomeHistory() {
  const items = getItems("income").sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id
  );
  el.incomeCount.textContent = items.length;
  el.incomeHistoryList.innerHTML =
    items.length === 0
      ? `<p class="empty-msg">No income yet this month.</p>`
      : items.map((i) => historyItemHTML(i, "income")).join("");
}

// ===== RENDER ALL =====
function render() {
  const expenses = getItems("expenses");
  const income = getItems("income");

  el.monthLabel.textContent = allTimeMode ? "All Time ⏳" : getMonthName(viewDate);
  populateYearSelect();

  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInc = income.reduce((s, i) => s + i.amount, 0);
  const bal = totalInc - totalExp;

  el.totalExpenses.textContent = fmt(totalExp);
  el.totalIncome.textContent = fmt(totalInc);
  el.balance.textContent = fmt(bal);
  el.balance.style.color = bal < 0 ? "var(--expense)" : "var(--balance)";

  renderExpenseHistory();
  renderIncomeHistory();

  if (currentPage === "graph") {
    renderChart();
    renderCategoryBreakdown();
  }
}

// ===== EVENTS: Navigation =====
el.navTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchPage(tab.dataset.page));
});

// Totals bar segments also navigate to their page
document.querySelectorAll(".total-seg").forEach((seg) => {
  seg.addEventListener("click", () => {
    if (seg.id === "allTimeToggle") return; // handled separately
    switchPage(seg.dataset.page);
  });
});

// ===== EVENTS: All-Time Toggle =====
el.allTimeToggle.addEventListener("click", () => {
  allTimeMode = !allTimeMode;
  el.allTimeToggle.classList.toggle("active", allTimeMode);
  el.allTimeValue.textContent = allTimeMode ? "ON" : "Off";
  el.yearSelect.disabled = allTimeMode;
  el.yearSelect.style.opacity = allTimeMode ? "0.4" : "1";
  render();
  showToast(allTimeMode ? "⏳ Showing ALL TIME totals" : "📅 Back to monthly view");
});

// ===== EVENTS: Chart Toggle =====
// Main combined chart (top)
document.getElementById("btnMonthly").addEventListener("click", () => {
  chartMode = "monthly";
  document.getElementById("btnMonthly").classList.add("active");
  document.getElementById("btnYearly").classList.remove("active");
  renderChart();
});

document.getElementById("btnYearly").addEventListener("click", () => {
  chartMode = "yearly";
  document.getElementById("btnYearly").classList.add("active");
  document.getElementById("btnMonthly").classList.remove("active");
  renderChart();
});

// Separate Expenses / Income charts — each toggles independently
document.querySelectorAll(".chart-btn[data-chart]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const which = btn.dataset.chart;
    const mode = btn.dataset.mode;

    document
      .querySelectorAll(`.chart-btn[data-chart="${which}"]`)
      .forEach((b) => b.classList.toggle("active", b === btn));

    if (which === "expense") {
      expenseChartMode = mode;
      const { labels, expSeries } = buildChartData(mode);
      expenseChart = drawChart("expenseChart", expenseChart, [
        barDataset("Expenses", expSeries, "#ef4444", "rgba(239, 68, 68, 0.75)"),
      ], labels);
    } else {
      incomeChartMode = mode;
      const { labels, incSeries } = buildChartData(mode);
      incomeChart = drawChart("incomeChart", incomeChart, [
        barDataset("Income", incSeries, "#22c55e", "rgba(34, 197, 94, 0.75)"),
      ], labels);
    }
  });
});

// ===== EVENTS: Month Navigation =====
el.prevMonth.addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  render();
});

el.nextMonth.addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  render();
});

// ===== YEAR SELECTOR =====
function populateYearSelect() {
  const yearsSet = new Set();
  yearsSet.add(viewDate.getFullYear());
  db.expenses.forEach((e) => yearsSet.add(new Date(e.date + "T00:00:00").getFullYear()));
  db.income.forEach((i) => yearsSet.add(new Date(i.date + "T00:00:00").getFullYear()));

  // Add a few years around the current one so there's always a range
  const cur = viewDate.getFullYear();
  for (let y = cur - 5; y <= cur + 2; y++) yearsSet.add(y);

  const years = [...yearsSet].sort((a, b) => b - a); // newest first

  el.yearSelect.innerHTML = years
    .map((y) => `<option value="${y}" ${y === viewDate.getFullYear() ? "selected" : ""}>📅 ${y}</option>`)
    .join("");
}

el.yearSelect.addEventListener("change", (e) => {
  viewDate.setFullYear(Number(e.target.value));
  render();
});

// ===== EVENTS: Forms =====
el.expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const date = document.getElementById("expenseDate").value;
  const amount = parseFloat(document.getElementById("expenseAmount").value);
  const description = document.getElementById("expenseDescription").value.trim();
  const categories = [
    ...el.categoryGrid.querySelectorAll('input[name="category"]:checked'),
  ].map((cb) => cb.value);

  if (categories.length === 0) {
    showToast("Please select at least one category!", "error");
    return;
  }

  db.expenses.push({ id: Date.now(), date, amount, description, categories });
  saveData(db);

  el.expenseForm.reset();
  document.getElementById("expenseDate").value = date;
  const selAll = document.getElementById("selectAllCategories");
  if (selAll) selAll.checked = false;

  viewDate = new Date(date + "T00:00:00");
  render();
  showToast("✅ Expense added!");
});

el.incomeForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const date = document.getElementById("incomeDate").value;
  const amount = parseFloat(document.getElementById("incomeAmount").value);
  const description = document.getElementById("incomeDescription").value.trim();

  db.income.push({ id: Date.now(), date, amount, description });
  saveData(db);

  el.incomeForm.reset();
  document.getElementById("incomeDate").value = date;

  viewDate = new Date(date + "T00:00:00");
  render();
  showToast("💰 Income added!");
});

// ===== EVENTS: Delete =====
function attachDeleteHandler(listEl) {
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".history-delete");
    if (!btn) return;

    const item = btn.closest(".history-item");
    const id = Number(item.dataset.id);
    const type = item.dataset.type;

    db[type] = db[type].filter((x) => x.id !== id);
    saveData(db);
    render();
    showToast("🗑️ Deleted!", "error");
  });
}
attachDeleteHandler(el.expenseHistoryList);
attachDeleteHandler(el.incomeHistoryList);

// ===== EVENTS: Clear Month =====
el.clearMonth.addEventListener("click", () => {
  const key = getMonthKey(viewDate);
  const label = getMonthName(viewDate);

  if (!confirm(`Delete ALL transactions for ${label}?`)) return;

  db.expenses = db.expenses.filter((e) => !e.date.startsWith(key));
  db.income = db.income.filter((i) => !i.date.startsWith(key));
  saveData(db);
  render();
  showToast("🗑️ Month cleared!", "error");
});

// ===== INIT =====
function init() {
  buildCategoryGrid();

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("expenseDate").value = today;
  document.getElementById("incomeDate").value = today;

  render();
  requestAnimationFrame(moveNavIndicator);
}

window.addEventListener("resize", moveNavIndicator);
init();
