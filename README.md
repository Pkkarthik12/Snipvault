# 🔒 SnipVault

> Your **local-first snippet & clipboard vault** — one click to save, search, tag, pin, and copy anything you re-use every day.

SnipVault is a tiny, offline, single-user product that lives on **your machine**. No accounts. No cloud. No telemetry. Your snippets are stored in a plain JSON file you own and can back up anywhere.

---

## ✨ Why SnipVault?

Engineers save code. Designers save colors and SVG. Writers save quotes. Students save formulas. Everyone saves URLs and one-liners. Most "snippet managers" are bloated, want a login, or lock your data away.

SnipVault is the opposite:

- 🪶 **One Python file, one web page, one JSON file** — that's the whole product.
- 🔒 **Local-first.** Everything stays on your disk under `data/snipvault.json`.
- ⚡ **Instant.** No build step, no bundler, no framework.
- 🌗 **Beautiful.** Dark + light theme, keyboard shortcuts, copy-to-clipboard.
- 🏷️ **Organized.** Categories, tags, pinned snips, usage counts.
- 📦 **Portable.** Export / import the entire vault as one JSON file.
- 🧰 **Useful to everyone.** Not just engineers — anyone who re-uses text.

---

## 🚀 Run it on your machine (3 commands)

### Option A — Windows
```bat
git clone <your-repo-url> snipvault
cd snipvault
run.bat
```

### Option B — macOS / Linux
```bash
git clone <your-repo-url> snipvault
cd snipvault
chmod +x run.sh
./run.sh
```

### Option C — manual (any OS)
```bash
python -m pip install -r requirements.txt
python app.py
```

Then open: **http://127.0.0.1:5732**

The first run seeds a few example snips so you can see how it works. Delete them or keep them — your call.

---

## ⌨️ Keyboard shortcuts

| Shortcut        | Action                  |
| --------------- | ----------------------- |
| `Ctrl` + `K`    | Focus search            |
| `Ctrl` + `N`    | New snip                |
| `Esc`           | Close dialog            |

---

## 🧱 Features

- 📚 **All / Pinned / Category filters** in the sidebar
- 🔍 **Full-text search** across titles, content, and tags
- 🏷️ **Tags and categories** — your way of organizing
- 📋 **One-click copy** to clipboard with a "used N×" counter
- 📌 **Pin** important snips so they always float to the top
- 🌗 **Dark / Light theme** (auto-saved)
- 📤 **Export** the whole vault to JSON
- 📥 **Import** from JSON (deduplicates by id)
- ➕ **Add new categories on the fly**

---

## 🗃️ Where is my data?

`data/snipvault.json` — plain JSON. Back it up, sync it via Dropbox / iCloud / Git, or version-control it. You own it.

```json
{
  "snips": [
    {
      "id": "ab12cd34ef56",
      "title": "Hello world — Python",
      "content": "print(\"Hello, SnipVault 👋\")",
      "category": "Code",
      "tags": ["python", "starter"],
      "pinned": false,
      "created_at": "2026-08-26T10:00:00Z",
      "updated_at": "2026-08-26T10:00:00Z",
      "uses": 3
    }
  ],
  "categories": ["General", "Code", "Snippet", "URL", "Note", "Color", "Command"]
}
```

---

## 🧪 The API (if you want to integrate)

SnipVault exposes a tiny JSON API on the same port:

| Method | Endpoint                  | Purpose                       |
| ------ | ------------------------- | ----------------------------- |
| GET    | `/api/snips?q=&category=` | List / search snips           |
| POST   | `/api/snips`              | Create a snip                 |
| GET    | `/api/snips/<id>`         | Fetch one                     |
| PUT    | `/api/snips/<id>`         | Update                        |
| DELETE | `/api/snips/<id>`         | Delete                        |
| POST   | `/api/snips/<id>/use`     | Bump "uses" counter           |
| GET    | `/api/categories`         | List categories               |
| POST   | `/api/categories`         | Add a category                |
| GET    | `/api/stats`              | Vault stats                   |
| GET    | `/api/export`             | Whole-vault dump              |
| POST   | `/api/import`             | Merge-import a dump           |

---

## 🛠️ Tech

- **Backend:** Python + Flask (one file: `app.py`)
- **Frontend:** Vanilla HTML + CSS + JS — no build step, no node_modules
- **Storage:** Plain JSON

Total repo size: < 50 KB. Cold start: < 1 second.

---

## 🪪 License

MIT — do whatever you want, just don't blame us if your vault of cat memes gets too big.

---

## 🙌 Credits

Built as a simple, useful product for everyone.
SnipVault · 2026
