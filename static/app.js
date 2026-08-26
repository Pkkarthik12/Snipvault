/* ----- SnipVault frontend ------------------------------------------- */

const api = {
  async list(params = {}) {
    const q = new URLSearchParams(params).toString();
    const r = await fetch("/api/snips" + (q ? "?" + q : ""));
    return r.json();
  },
  async get(id) { return (await fetch("/api/snips/" + id)).json(); },
  async create(payload) {
    return (await fetch("/api/snips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })).json();
  },
  async update(id, payload) {
    return (await fetch("/api/snips/" + id, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })).json();
  },
  async remove(id) {
    return (await fetch("/api/snips/" + id, { method: "DELETE" })).json();
  },
  async use(id) { return (await fetch("/api/snips/" + id + "/use", { method: "POST" })).json(); },
  async categories() { return (await fetch("/api/categories")).json(); },
  async addCategory(name) {
    return (await fetch("/api/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })).json();
  },
  async stats() { return (await fetch("/api/stats")).json(); },
  async exportAll() { return (await fetch("/api/export")).json(); },
  async importAll(payload) {
    return (await fetch("/api/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })).json();
  },
};

const state = {
  category: "All",
  query: "",
  snips: [],
  activeId: null,
  categories: [],
  editingId: null,
};

/* ----- DOM refs ------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const els = {
  list: $("snipList"),
  empty: $("listEmpty"),
  detail: $("detailPane"),
  catList: $("catList"),
  crumb: $("crumb"),
  stats: $("stats"),
  search: $("searchInput"),
  newBtn: $("newBtn"),
  newCat: $("newCatInput"),
  modal: $("modal"),
  modalTitle: $("modalTitle"),
  modalClose: $("modalClose"),
  modalCancel: $("modalCancel"),
  modalSave: $("modalSave"),
  fTitle: $("fTitle"),
  fContent: $("fContent"),
  fCategory: $("fCategory"),
  fTags: $("fTags"),
  fPinned: $("fPinned"),
  themeBtn: $("themeBtn"),
  exportBtn: $("exportBtn"),
  importBtn: $("importBtn"),
  importFile: $("importFile"),
  toast: $("toast"),
  countAll: $("countAll"),
  countPinned: $("countPinned"),
};

/* ----- Toast --------------------------------------------------------- */
let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 1800);
}

/* ----- Rendering ----------------------------------------------------- */
async function refresh() {
  const params = { q: state.query };
  if (state.category === "Pinned") params.pinned = 1;
  else if (state.category !== "All") params.category = state.category;

  const [{ snips, total }, catRes, stats] = await Promise.all([
    api.list(params),
    api.categories(),
    api.stats(),
  ]);

  state.snips = snips;
  state.categories = catRes.categories;
  renderList();
  renderCategories();
  renderStats(stats, total);
}

function renderList() {
  els.list.innerHTML = "";
  if (state.snips.length === 0) {
    els.empty.hidden = false;
    els.empty.style.display = "flex";
    return;
  }
  els.empty.hidden = true;
  els.empty.style.display = "none";

  for (const s of state.snips) {
    const li = document.createElement("li");
    li.className = "snip-card" + (s.id === state.activeId ? " active" : "");
    li.dataset.id = s.id;
    li.innerHTML = `
      <div class="row1">
        <div class="title">${escapeHTML(s.title || "(untitled)")}</div>
        ${s.pinned ? '<div class="pin">📌</div>' : ""}
      </div>
      <div class="preview">${escapeHTML(s.content)}</div>
      <div class="meta">
        <div>
          <span class="cat-pill">${escapeHTML(s.category || "General")}</span>
          ${(s.tags || []).slice(0, 3).map(t => `<span class="tag-pill">#${escapeHTML(t)}</span>`).join("")}
        </div>
        <div>used ${s.uses || 0}×</div>
      </div>
    `;
    li.addEventListener("click", () => selectSnip(s.id));
    els.list.appendChild(li);
  }
}

function renderCategories() {
  els.catList.innerHTML = "";
  // counts per category from currently fetched list (refreshed)
  const counts = {};
  state.snips.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });

  for (const cat of state.categories) {
    const b = document.createElement("button");
    b.className = "cat" + (cat === state.category ? " active" : "");
    b.innerHTML = `<span>${escapeHTML(cat)}</span><span class="count">${counts[cat] || 0}</span>`;
    b.addEventListener("click", () => {
      state.category = cat;
      els.crumb.textContent = cat === "All" ? "All snips" : `Category: ${cat}`;
      refresh();
    });
    els.catList.appendChild(b);
  }

  // counts in filters
  const allCount = state.snips.length;
  const pinnedCount = state.snips.filter(s => s.pinned).length;
  els.countAll.textContent = allCount;
  els.countPinned.textContent = pinnedCount;
}

function renderStats(stats, filteredTotal) {
  els.stats.innerHTML = `
    <span>${stats.total} total</span> ·
    <span>${stats.pinned} pinned</span> ·
    <span>${filteredTotal} shown</span> ·
    <span>${stats.total_uses} copies</span>
  `;
}

async function selectSnip(id) {
  state.activeId = id;
  renderList();
  const { snip } = await api.get(id);
  if (!snip) { renderDetail(null); return; }
  renderDetail(snip);
}

function renderDetail(s) {
  if (!s) {
    els.detail.innerHTML = `
      <div class="placeholder">
        <div class="placeholder-emoji">📝</div>
        <div>Select a snip to view, edit, or copy.</div>
      </div>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-head">
      <div>
        <h1 class="detail-title">${escapeHTML(s.title || "(untitled)")}</h1>
        <div class="detail-meta">
          <span class="cat-pill">${escapeHTML(s.category || "General")}</span>
          <span>created ${formatDate(s.created_at)}</span>
          <span>· updated ${formatDate(s.updated_at)}</span>
          <span>· used ${s.uses || 0} times</span>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn" id="copyBtn">📋 Copy</button>
        <button class="btn" id="pinBtn">${s.pinned ? "📌 Unpin" : "📌 Pin"}</button>
        <button class="btn" id="editBtn">✏ Edit</button>
        <button class="btn danger" id="delBtn">🗑 Delete</button>
      </div>
    </div>
    <pre class="detail-body" id="detailBody"></pre>
    ${(s.tags || []).length ? `<div class="detail-tags">${s.tags.map(t => `<span class="tag-pill">#${escapeHTML(t)}</span>`).join("")}</div>` : ""}
  `;
  document.getElementById("detailBody").textContent = s.content;

  document.getElementById("copyBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(s.content);
    await api.use(s.id);
    toast("✅ Copied to clipboard");
    refresh();
  });
  document.getElementById("pinBtn").addEventListener("click", async () => {
    await api.update(s.id, { pinned: !s.pinned });
    toast(s.pinned ? "Unpinned" : "📌 Pinned");
    selectSnip(s.id);
    refresh();
  });
  document.getElementById("editBtn").addEventListener("click", () => openModal(s));
  document.getElementById("delBtn").addEventListener("click", async () => {
    if (!confirm("Delete this snip?")) return;
    await api.remove(s.id);
    state.activeId = null;
    renderDetail(null);
    toast("🗑 Deleted");
    refresh();
  });
}

/* ----- Modal --------------------------------------------------------- */
function openModal(snip = null) {
  state.editingId = snip ? snip.id : null;
  els.modalTitle.textContent = snip ? "Edit snip" : "New snip";
  els.fTitle.value = snip ? snip.title : "";
  els.fContent.value = snip ? snip.content : "";
  els.fPinned.checked = snip ? !!snip.pinned : false;
  els.fTags.value = snip ? (snip.tags || []).join(", ") : "";
  // populate categories
  els.fCategory.innerHTML = state.categories
    .map(c => `<option ${snip && snip.category === c ? "selected" : ""}>${escapeHTML(c)}</option>`)
    .join("");
  if (snip && !state.categories.includes(snip.category)) {
    const opt = document.createElement("option");
    opt.selected = true; opt.textContent = snip.category;
    els.fCategory.appendChild(opt);
  }
  els.modal.hidden = false;
  setTimeout(() => els.fContent.focus(), 30);
}

function closeModal() { els.modal.hidden = true; state.editingId = null; }

async function saveModal() {
  const payload = {
    title: els.fTitle.value.trim(),
    content: els.fContent.value,
    category: els.fCategory.value || "General",
    tags: els.fTags.value.split(",").map(s => s.trim()).filter(Boolean),
    pinned: els.fPinned.checked,
  };
  if (!payload.content.trim()) { toast("⚠ Content is empty"); return; }
  let res;
  if (state.editingId) res = await api.update(state.editingId, payload);
  else res = await api.create(payload);
  if (res.error) { toast("Error: " + res.error); return; }
  closeModal();
  toast(state.editingId ? "✅ Saved" : "✨ Created");
  selectSnip(res.snip.id);
  refresh();
}

/* ----- Import / Export ---------------------------------------------- */
async function doExport() {
  const data = await api.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `snipvault-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("⬇ Exported");
}

async function doImport(file) {
  try {
    const txt = await file.text();
    const data = JSON.parse(txt);
    const res = await api.importAll(data);
    toast(`⬆ Imported ${res.added} snips`);
    refresh();
  } catch (e) {
    toast("⚠ Invalid JSON file");
  }
}

/* ----- Theme --------------------------------------------------------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("snipvault-theme", theme);
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
}

/* ----- Helpers ------------------------------------------------------- */
function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return iso; }
}

/* ----- Events -------------------------------------------------------- */
function wire() {
  els.search.addEventListener("input", debounce(() => {
    state.query = els.search.value.trim();
    refresh();
  }, 180));

  els.newBtn.addEventListener("click", () => openModal());

  els.modalClose.addEventListener("click", closeModal);
  els.modalCancel.addEventListener("click", closeModal);
  els.modalSave.addEventListener("click", saveModal);
  els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeModal(); });

  els.newCat.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const name = els.newCat.value.trim();
    if (!name) return;
    await api.addCategory(name);
    els.newCat.value = "";
    toast(`Added "${name}"`);
    refresh();
  });

  els.themeBtn.addEventListener("click", toggleTheme);
  els.exportBtn.addEventListener("click", doExport);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", (e) => {
    if (e.target.files[0]) doImport(e.target.files[0]);
    e.target.value = "";
  });

  // Filter buttons
  document.querySelectorAll(".filter").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      state.category = b.dataset.cat;
      els.crumb.textContent = state.category === "All" ? "All snips" :
        state.category === "Pinned" ? "Pinned snips" : `Category: ${state.category}`;
      refresh();
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); els.search.focus();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault(); openModal();
    } else if (e.key === "Escape") {
      if (!els.modal.hidden) closeModal();
    }
  });
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ----- Boot ---------------------------------------------------------- */
(async function init() {
  const savedTheme = localStorage.getItem("snipvault-theme") || "dark";
  applyTheme(savedTheme);

  wire();

  // Seed some examples on first run
  const stats = await api.stats();
  if (stats.total === 0) {
    const seeds = [
      { title: "Hello world — Python", content: 'print("Hello, SnipVault 👋")', category: "Code", tags: ["python", "starter"] },
      { title: "Kill process on port (Windows)", content: "netstat -ano | findstr :PORT\ntaskkill /PID <pid> /F", category: "Command", tags: ["windows", "net"] },
      { title: "Useful colors", content: "#6ee7b7 — mint\n#34d399 — emerald\n#79c0ff — sky\n#f87171 — rose", category: "Color", tags: ["palette"] },
      { title: "Regex — email (simple)", content: "^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$", category: "Snippet", tags: ["regex", "email"] },
      { title: "Welcome to SnipVault", content: "Your snippets live here, locally on your machine.\nPress Ctrl+K to search, Ctrl+N to add a new snip.", category: "Note", tags: ["welcome"], pinned: true },
    ];
    for (const s of seeds) await api.create(s);
  }

  await refresh();
})();
