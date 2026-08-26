/* ----- SnipVault frontend ------------------------------------------- */

const api = {
  async _fetch(url, options = {}) {
    try {
      const r = await fetch(url, options);
      const data = await r.json();
      if (!r.ok) {
        return { error: data.error || `HTTP error ${r.status}` };
      }
      return data;
    } catch (e) {
      console.error("API error for " + url, e);
      return { error: e.message || "Network request failed" };
    }
  },

  async list(params = {}) {
    const q = new URLSearchParams(params).toString();
    const data = await this._fetch("/api/snips" + (q ? "?" + q : ""));
    return data && data.snips ? data : { snips: [], total: 0 };
  },

  async get(id) {
    return this._fetch("/api/snips/" + encodeURIComponent(id));
  },

  async create(payload) {
    return this._fetch("/api/snips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async update(id, payload) {
    return this._fetch("/api/snips/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async remove(id) {
    return this._fetch("/api/snips/" + encodeURIComponent(id), { method: "DELETE" });
  },

  async use(id) {
    return this._fetch("/api/snips/" + encodeURIComponent(id) + "/use", { method: "POST" });
  },

  async categories() {
    const res = await this._fetch("/api/categories");
    return res && res.categories ? res : { categories: [] };
  },

  async addCategory(name) {
    return this._fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  },

  async stats() {
    const res = await this._fetch("/api/stats");
    return res && typeof res.total === "number"
      ? res
      : { total: 0, pinned: 0, total_uses: 0, by_category: {}, tags: [] };
  },

  async exportAll() {
    return this._fetch("/api/export");
  },

  async importAll(payload) {
    return this._fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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

/* ----- Clipboard fallback -------------------------------------------- */
async function copyText(text) {
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback below
    }
  }

  // Resilient textarea fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (err) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/* ----- DOM refs ------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const els = {
  sidebar: $("sidebar"),
  backdrop: $("sidebarBackdrop"),
  menuBtn: $("menuBtn"),
  list: $("snipList"),
  empty: $("listEmpty"),
  emptyEmoji: $("emptyEmoji"),
  emptyTitle: $("emptyTitle"),
  emptySub: $("emptySub"),
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
  els.toast.classList.add("show");
  els.toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
    els.toast.classList.remove("show");
    els.toast.style.display = "none";
  }, 2200);
}

/* ----- Rendering ----------------------------------------------------- */
async function refresh() {
  const params = {};
  if (state.query) params.q = state.query;
  if (state.category === "Pinned") params.pinned = 1;
  else if (state.category !== "All") params.category = state.category;

  const [listRes, catRes, stats] = await Promise.all([
    api.list(params),
    api.categories(),
    api.stats(),
  ]);

  state.snips = listRes.snips || [];
  state.categories = catRes.categories || [];

  renderList();
  renderCategories(stats);
  renderStats(stats, listRes.total ?? state.snips.length);

  // If currently active snippet is still in list, re-render detail with fresh data
  if (state.activeId) {
    const existing = state.snips.find(s => s.id === state.activeId);
    if (existing) {
      renderDetail(existing);
    } else {
      state.activeId = null;
      renderDetail(null);
    }
  }

  // Auto-select first snippet if none selected on desktop
  if (!state.activeId && state.snips.length > 0 && window.innerWidth > 900) {
    selectSnip(state.snips[0].id);
  }
}

function renderList() {
  els.list.innerHTML = "";
  if (state.snips.length === 0) {
    els.empty.hidden = false;
    els.empty.style.display = "flex";

    if (state.query) {
      els.emptyEmoji.textContent = "🔍";
      els.emptyTitle.textContent = "No matches found";
      els.emptySub.textContent = `No snips match "${state.query}". Try a different keyword or tag.`;
    } else if (state.category === "Pinned") {
      els.emptyEmoji.textContent = "📌";
      els.emptyTitle.textContent = "No pinned snips";
      els.emptySub.textContent = "Pin your most used snips so they stay right at the top.";
    } else if (state.category !== "All") {
      els.emptyEmoji.textContent = "🏷️";
      els.emptyTitle.textContent = `No snips in "${state.category}"`;
      els.emptySub.textContent = "Click ＋ New snip to create a snippet in this category.";
    } else {
      els.emptyEmoji.textContent = "🗂️";
      els.emptyTitle.textContent = "No snips yet";
      els.emptySub.innerHTML = 'Press <kbd>Ctrl</kbd>+<kbd>N</kbd> or click <b>＋ New snip</b> to start your vault.';
    }
    return;
  }

  els.empty.hidden = true;
  els.empty.style.display = "none";

  for (const s of state.snips) {
    const li = document.createElement("li");
    li.className = "snip-card" + (s.id === state.activeId ? " active" : "");
    li.dataset.id = s.id;

    const tagsHtml = (s.tags || []).slice(0, 3).map(t =>
      `<span class="tag-pill" data-tag="${escapeHTML(t)}">#${escapeHTML(t)}</span>`
    ).join("");

    li.innerHTML = `
      <div class="row1">
        <div class="title" title="${escapeHTML(s.title || "(untitled)")}">${escapeHTML(s.title || "(untitled)")}</div>
        <div class="card-badges">
          ${s.pinned ? '<span class="pin" title="Pinned">📌</span>' : ""}
          <button class="card-copy-btn" title="Copy snippet" data-id="${s.id}">📋</button>
        </div>
      </div>
      <div class="preview">${escapeHTML(s.content)}</div>
      <div class="meta">
        <div class="meta-tags">
          <span class="cat-pill">${escapeHTML(s.category || "General")}</span>
          ${tagsHtml}
        </div>
        <div class="meta-uses">used ${s.uses || 0}×</div>
      </div>
    `;

    // Click card to view
    li.addEventListener("click", (e) => {
      if (e.target.closest(".tag-pill") || e.target.closest(".card-copy-btn")) return;
      selectSnip(s.id);
    });

    // Quick copy button on card
    const copyBtn = li.querySelector(".card-copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await copyText(s.content);
        if (ok) {
          await api.use(s.id);
          toast("✅ Copied to clipboard");
          await refresh();
        } else {
          toast("⚠ Failed to copy");
        }
      });
    }

    // Tag pills inside card
    li.querySelectorAll(".tag-pill").forEach(pill => {
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        const tag = pill.dataset.tag;
        if (tag) {
          state.query = tag;
          els.search.value = tag;
          refresh();
        }
      });
    });

    els.list.appendChild(li);
  }
}

function renderCategories(stats) {
  els.catList.innerHTML = "";
  const counts = (stats && stats.by_category) || {};

  for (const cat of state.categories) {
    const b = document.createElement("button");
    b.className = "cat" + (cat === state.category ? " active" : "");
    b.innerHTML = `<span>${escapeHTML(cat)}</span><span class="count">${counts[cat] || 0}</span>`;
    b.addEventListener("click", () => {
      state.category = cat;
      els.crumb.textContent = `Category: ${cat}`;
      closeSidebar();
      refresh();
    });
    els.catList.appendChild(b);
  }

  // Count badges
  els.countAll.textContent = (stats && stats.total) || 0;
  els.countPinned.textContent = (stats && stats.pinned) || 0;

  // Active filter button state
  document.querySelectorAll(".filter").forEach(b => {
    b.classList.toggle("active", b.dataset.cat === state.category);
  });
}

function renderStats(stats, filteredTotal) {
  const total = (stats && stats.total) || 0;
  const pinned = (stats && stats.pinned) || 0;
  const uses = (stats && stats.total_uses) || 0;
  els.stats.innerHTML = `
    <span>${total} total</span> ·
    <span>${pinned} pinned</span> ·
    <span>${filteredTotal} shown</span> ·
    <span>${uses} copies</span>
  `;
}

async function selectSnip(id) {
  state.activeId = id;
  renderList();

  const res = await api.get(id);
  if (!res || res.error || !res.snip) {
    renderDetail(null);
    return;
  }
  renderDetail(res.snip);

  // Smooth scroll on smaller screens
  if (window.innerWidth <= 900 && els.detail) {
    els.detail.scrollIntoView({ behavior: "smooth" });
  }
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

  const tagsHtml = (s.tags || []).length
    ? `<div class="detail-tags">${s.tags.map(t =>
        `<span class="tag-pill" data-tag="${escapeHTML(t)}">#${escapeHTML(t)}</span>`
      ).join("")}</div>`
    : "";

  els.detail.innerHTML = `
    <div class="detail-head">
      <div>
        <h1 class="detail-title">${escapeHTML(s.title || "(untitled)")}</h1>
        <div class="detail-meta">
          <span class="cat-pill">${escapeHTML(s.category || "General")}</span>
          <span>created ${formatDate(s.created_at)}</span>
          <span>· updated ${formatDate(s.updated_at)}</span>
          <span id="detailUses">· used ${s.uses || 0} times</span>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn primary" id="copyBtn">📋 Copy</button>
        <button class="btn" id="pinBtn">${s.pinned ? "📌 Unpin" : "📌 Pin"}</button>
        <button class="btn" id="editBtn">✏ Edit</button>
        <button class="btn danger" id="delBtn">🗑 Delete</button>
      </div>
    </div>
    <pre class="detail-body" id="detailBody"></pre>
    ${tagsHtml}
  `;

  document.getElementById("detailBody").textContent = s.content;

  // Copy
  document.getElementById("copyBtn").addEventListener("click", async () => {
    const ok = await copyText(s.content);
    if (ok) {
      const res = await api.use(s.id);
      if (res && res.snip) {
        s.uses = res.snip.uses;
        const usesEl = document.getElementById("detailUses");
        if (usesEl) usesEl.textContent = `· used ${s.uses} times`;
      }
      toast("✅ Copied to clipboard");
      await refresh();
    } else {
      toast("⚠ Failed to copy");
    }
  });

  // Pin / Unpin
  document.getElementById("pinBtn").addEventListener("click", async () => {
    const newPinned = !s.pinned;
    const res = await api.update(s.id, { pinned: newPinned });
    if (res && res.snip) {
      toast(newPinned ? "📌 Pinned to top" : "Unpinned");
      state.activeId = s.id;
      await refresh();
      await selectSnip(s.id);
    }
  });

  // Edit
  document.getElementById("editBtn").addEventListener("click", () => openModal(s));

  // Delete
  document.getElementById("delBtn").addEventListener("click", async () => {
    if (!confirm(`Delete "${s.title || "this snip"}"?`)) return;
    const res = await api.remove(s.id);
    if (res && res.error) {
      toast("Error: " + res.error);
      return;
    }
    state.activeId = null;
    renderDetail(null);
    toast("🗑 Deleted");
    await refresh();
  });

  // Tag clicks in detail
  els.detail.querySelectorAll(".tag-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const tag = pill.dataset.tag;
      if (tag) {
        state.query = tag;
        els.search.value = tag;
        refresh();
      }
    });
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

  // Populate categories
  const currentCat = snip
    ? snip.category
    : (state.category !== "All" && state.category !== "Pinned" ? state.category : "General");

  els.fCategory.innerHTML = state.categories
    .map(c => `<option value="${escapeHTML(c)}" ${currentCat === c ? "selected" : ""}>${escapeHTML(c)}</option>`)
    .join("");

  if (currentCat && !state.categories.includes(currentCat)) {
    const opt = document.createElement("option");
    opt.value = currentCat;
    opt.selected = true;
    opt.textContent = currentCat;
    els.fCategory.appendChild(opt);
  }

  els.modal.hidden = false;
  els.modal.classList.add("open");
  els.modal.style.display = "grid";
  setTimeout(() => (snip ? els.fContent : els.fTitle).focus(), 40);
}

function closeModal() {
  els.modal.hidden = true;
  els.modal.classList.remove("open");
  els.modal.style.display = "none";
  state.editingId = null;
  els.fTitle.value = "";
  els.fContent.value = "";
  els.fTags.value = "";
  els.fPinned.checked = false;
}

async function saveModal() {
  const content = els.fContent.value;
  if (!content || !content.trim()) {
    toast("⚠ Content is required");
    els.fContent.focus();
    return;
  }

  const category = els.fCategory.value || "General";
  const payload = {
    title: els.fTitle.value.trim(),
    content: content,
    category: category,
    tags: els.fTags.value.split(",").map(s => s.trim().replace(/^#/, "")).filter(Boolean),
    pinned: els.fPinned.checked,
  };

  let res;
  if (state.editingId) {
    res = await api.update(state.editingId, payload);
  } else {
    res = await api.create(payload);
    // Reset filters to All so user sees their new snip right away
    if (state.category !== "All" && state.category !== category) {
      state.category = "All";
      els.crumb.textContent = "All snips";
    }
    state.query = "";
    els.search.value = "";
  }

  if (!res || res.error) {
    toast("Error: " + (res?.error || "Failed to save"));
    return;
  }

  closeModal();
  toast(state.editingId ? "✅ Saved" : "✨ Created");

  await refresh();
  if (res.snip && res.snip.id) {
    await selectSnip(res.snip.id);
  }
}

/* ----- Import / Export ---------------------------------------------- */
async function doExport() {
  const data = await api.exportAll();
  if (!data || data.error) {
    toast("⚠ Export failed");
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `snipvault-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("⬇ Exported successfully");
}

async function doImport(file) {
  try {
    const txt = await file.text();
    const data = JSON.parse(txt);
    const res = await api.importAll(data);
    if (res && res.error) {
      toast("⚠ Import error: " + res.error);
      return;
    }
    toast(`⬆ Imported ${res.added ?? 0} snips`);
    await refresh();
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

/* ----- Mobile Sidebar ------------------------------------------------ */
function toggleSidebar() {
  if (els.sidebar) {
    const isOpen = els.sidebar.classList.toggle("open");
    if (els.backdrop) els.backdrop.classList.toggle("open", isOpen);
  }
}

function closeSidebar() {
  if (els.sidebar) els.sidebar.classList.remove("open");
  if (els.backdrop) els.backdrop.classList.remove("open");
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
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  } catch {
    return iso;
  }
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/* ----- Events -------------------------------------------------------- */
function wire() {
  // Search
  els.search.addEventListener("input", debounce(() => {
    state.query = els.search.value.trim();
    state.activeId = null;
    refresh();
  }, 150));

  // New snip
  els.newBtn.addEventListener("click", () => {
    closeSidebar();
    openModal();
  });

  // Modal actions
  els.modalClose.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
  els.modalCancel.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
  els.modalSave.addEventListener("click", (e) => {
    e.preventDefault();
    saveModal();
  });
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) {
      e.preventDefault();
      closeModal();
    }
  });

  // Ctrl+Enter / Cmd+Enter inside modal
  els.modal.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveModal();
    }
  });

  // Add category
  els.newCat.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const name = els.newCat.value.trim();
    if (!name) return;
    const res = await api.addCategory(name);
    if (res && res.error) {
      toast("Error: " + res.error);
      return;
    }
    els.newCat.value = "";
    toast(`Added category "${name}"`);
    refresh();
  });

  // Footer buttons
  els.themeBtn.addEventListener("click", toggleTheme);
  els.exportBtn.addEventListener("click", doExport);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", (e) => {
    if (e.target.files[0]) doImport(e.target.files[0]);
    e.target.value = "";
  });

  // Mobile menu & backdrop
  if (els.menuBtn) els.menuBtn.addEventListener("click", toggleSidebar);
  if (els.backdrop) els.backdrop.addEventListener("click", closeSidebar);

  // Filter buttons (All / Pinned)
  document.querySelectorAll(".filter").forEach(b => {
    b.addEventListener("click", () => {
      state.category = b.dataset.cat;
      els.crumb.textContent = state.category === "All" ? "All snips" :
        state.category === "Pinned" ? "Pinned snips" : `Category: ${state.category}`;
      state.activeId = null;
      closeSidebar();
      refresh();
    });
  });

  // Global keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      els.search.focus();
      els.search.select();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      openModal();
    } else if (e.key === "Escape") {
      if (!els.modal.hidden) closeModal();
      closeSidebar();
    }
  });
}

/* ----- Boot ---------------------------------------------------------- */
(async function init() {
  const savedTheme = localStorage.getItem("snipvault-theme") || "dark";
  applyTheme(savedTheme);
  wire();
  await refresh();
})();
