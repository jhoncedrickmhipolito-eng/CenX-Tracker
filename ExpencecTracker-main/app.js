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
let currentFilter = "all";
let chartMode = "monthly"; // "monthly" or "yearly"
let mainChart = null;

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
  selectAll: document.getElementById("selectAllCategories"),
  categoryBreakdown: document.getElementById("categoryBreakdown"),
  historyList: document.getElementById("historyList"),
  clearMonth: document.getElementById("clearMonth"),
  tabs: document.querySelectorAll(".tab"),
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

function showToast(msg, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== CHART =====
function renderChart() {
  const ctx = document.getElementById("mainChart");
  if (!ctx) return;

  let labels = [];
  let expenseData = [];
  let incomeData = [];

  if (chartMode === "monthly") {
    // Show 12 months of the current viewing year
    const year = viewDate.getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    labels = monthNames;
    expenseData = new Array(12).fill(0);
    incomeData = new Array(12).fill(0);

    db.expenses.forEach((e) => {
      const d = new Date(e.date + "T00:00:00");
      if (d.getFullYear() === year) {
        expenseData[d.getMonth()] += e.amount;
      }
    });
    db.income.forEach((i) => {
      const d = new Date(i.date + "T00:00:00");
      if (d.getFullYear() === year) {
        incomeData[d.getMonth()] += i.amount;
      }
    });
  } else {
    // Yearly: find all years that have data + current year
    const yearsSet = new Set();
    yearsSet.add(viewDate.getFullYear());
    db.expenses.forEach((e) => yearsSet.add(new Date(e.date + "T00:00:00").getFullYear()));
    db.income.forEach((i) => yearsSet.add(new Date(i.date + "T00:00:00").getFullYear()));

    const years = [...yearsSet].sort((a, b) => a - b);
    labels = years.map(String);
    expenseData = years.map(() => 0);
    incomeData = years.map(() => 0);

    db.expenses.forEach((e) => {
      const y = new Date(e.date + "T00:00:00").getFullYear();
      const idx = years.indexOf(y);
      if (idx !== -1) expenseData[idx] += e.amount;
    });
    db.income.forEach((i) => {
      const y = new Date(i.date + "T00:00:00").getFullYear();
      const idx = years.indexOf(y);
      if (idx !== -1) incomeData[idx] += i.amount;
    });
  }

  const chartConfig = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data: expenseData,
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "#ef4444",
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Income",
          data: incomeData,
          backgroundColor: "rgba(34, 197, 94, 0.7)",
          borderColor: "#22c55e",
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
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
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
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
            callback: (v) => {
              if (v >= 1000) return "₱" + (v / 1000).toFixed(0) + "k";
              return "₱" + v;
            },
          },
        },
      },
    },
  };

  if (mainChart) {
    mainChart.destroy();
  }
  mainChart = new Chart(ctx, chartConfig);
}

// ===== RENDER =====
function render() {
  const expenses = getItemsForMonth("expenses");
  const income = getItemsForMonth("income");

  // Month label
  el.monthLabel.textContent = getMonthName(viewDate);

  // Summary
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInc = income.reduce((s, e) => s + e.amount, 0);
  const bal = totalInc - totalExp;

  el.totalExpenses.textContent = fmt(totalExp);
  el.totalIncome.textContent = fmt(totalInc);
  el.balance.textContent = fmt(bal);
  el.balance.style.color = bal < 0 ? "var(--expense)" : "var(--balance)";

  renderCategoryBreakdown(expenses);
  renderHistory();
  renderChart();
}

function renderCategoryBreakdown(expenses) {
  if (expenses.length === 0) {
    el.categoryBreakdown.innerHTML = `<p class="empty-msg">No expenses yet this month.</p>`;
    return;
  }

  // Sum per category
  const totals = {};
  const colors = {
    Food: "#f97316",
    GYM: "#8b5cf6",
    Gas: "#eab308",
    "P.N": "#ec4899",
  };

  expenses.forEach((exp) => {
    exp.categories.forEach((cat) => {
      totals[cat] = (totals[cat] || 0) + exp.amount;
    });
  });

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const maxAmount = Math.max(...Object.values(totals));

  let html = "";
  Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amount]) => {
      const pct = grandTotal ? ((amount / grandTotal) * 100).toFixed(1) : 0;
      const barWidth = maxAmount ? (amount / maxAmount) * 100 : 0;
      const color = colors[cat] || "var(--expense)";
      html += `
        <div class="breakdown-item">
          <div class="breakdown-row">
            <span class="breakdown-name">${cat}</span>
            <span class="breakdown-amount" style="color:${color}">${fmt(amount)}</span>
          </div>
          <div class="breakdown-bar-bg">
            <div class="breakdown-bar" style="width:${barWidth}%;background:${color}"></div>
          </div>
          <div class="breakdown-row">
            <span style="color:var(--text-dim);font-size:0.8rem">${pct}% of total</span>
          </div>
        </div>
      `;
    });

  el.categoryBreakdown.innerHTML = html;
}

function renderHistory() {
  const expenses = getItemsForMonth("expenses").map((e) => ({ ...e, type: "expense" }));
  const income = getItemsForMonth("income").map((i) => ({ ...i, type: "income" }));

  let all = [...expenses, ...income];
  if (currentFilter !== "all") {
    all = all.filter((item) => item.type === currentFilter);
  }

  // Sort by date, newest first
  all.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  if (all.length === 0) {
    el.historyList.innerHTML = `<p class="empty-msg">No transactions this month.</p>`;
    return;
  }

  el.historyList.innerHTML = all
    .map(
      (item) => `
    <div class="history-item" data-id="${item.id}" data-type="${item.type}">
      <div class="history-icon ${item.type}">
        ${item.type === "expense" ? "💸" : "💰"}
      </div>
      <div class="history-details">
        <div class="history-desc">${esc(item.description)}</div>
        <div class="history-meta">
          <span>📅 ${formatDate(item.date)}</span>
          ${item.type === "expense" && item.categories?.length ? `
            <span class="history-tags">
              ${item.categories.map((c) => `<span class="history-tag">${c}</span>`).join("")}
            </span>
          ` : ""}
        </div>
      </div>
      <div class="history-amount ${item.type}">
        ${item.type === "expense" ? "-" : "+"}${fmt(item.amount)}
      </div>
      <button class="history-delete" title="Delete">✕</button>
    </div>
  `
    )
    .join("");
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

// ===== EVENT: Chart Toggle (Monthly / Yearly) =====
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

// ===== EVENT: Month Navigation =====
el.prevMonth.addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  render();
});

el.nextMonth.addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  render();
});

// ===== EVENT: Select All Categories =====
el.selectAll.addEventListener("change", () => {
  const checkboxes = el.categoryGrid.querySelectorAll('input[name="category"]');
  checkboxes.forEach((cb) => {
    cb.checked = el.selectAll.checked;
  });
});

// Keep "Select All" in sync when individual chips change
el.categoryGrid.addEventListener("change", (e) => {
  if (e.target.name === "category") {
    const checkboxes = el.categoryGrid.querySelectorAll('input[name="category"]');
    const allChecked = [...checkboxes].every((cb) => cb.checked);
    el.selectAll.checked = allChecked;
  }
});

// ===== EVENT: Expense Form =====
el.expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const date = document.getElementById("expenseDate").value;
  const amount = parseFloat(document.getElementById("expenseAmount").value);
  const description = document.getElementById("expenseDescription").value.trim();
  const categories = [...el.categoryGrid.querySelectorAll('input[name="category"]:checked')].map(
    (cb) => cb.value
  );

  if (categories.length === 0) {
    showToast("Please select at least one category!", "error");
    return;
  }

  db.expenses.push({
    id: Date.now(),
    date,
    amount,
    description,
    categories,
  });

  saveData(db);
  el.expenseForm.reset();
  el.selectAll.checked = false;

  // Jump to expense's month
  viewDate = new Date(date + "T00:00:00");
  render();
  showToast("✅ Expense added!");
});

// ===== EVENT: Income Form =====
el.incomeForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const date = document.getElementById("incomeDate").value;
  const amount = parseFloat(document.getElementById("incomeAmount").value);
  const description = document.getElementById("incomeDescription").value.trim();

  db.income.push({
    id: Date.now(),
    date,
    amount,
    description,
  });

  saveData(db);
  el.incomeForm.reset();

  viewDate = new Date(date + "T00:00:00");
  render();
  showToast("💰 Income added!");
});

// ===== EVENT: Filter Tabs =====
el.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    el.tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    renderHistory();
  });
});

// ===== EVENT: Delete Transaction =====
el.historyList.addEventListener("click", (e) => {
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

// ===== EVENT: Clear Month =====
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
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("expenseDate").value = today;
  document.getElementById("incomeDate").value = today;
  render();
}

init();
