"""
SnipVault - A local, offline-first snippet & clipboard vault.
A simple, useful product for everyone.

Run: python app.py
Then open: http://127.0.0.1:5732
"""

import os
import sys
import json
import uuid
import datetime
import webbrowser
import threading
from pathlib import Path
from flask import Flask, request, jsonify, render_template

# Ensure safe UTF-8 output across Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from flask_cors import CORS
except ImportError:
    CORS = None

APP_DIR = Path(__file__).parent.resolve()
DATA_DIR = APP_DIR / "data"
DATA_FILE = DATA_DIR / "snipvault.json"
PORT = int(os.environ.get("PORT", 5732))

app = Flask(__name__, static_folder="static", template_folder="templates")
if CORS:
    CORS(app)

DEFAULT_CATEGORIES = [
    "General", "Code", "Snippet", "URL", "Note", "Color", "Command"
]

DEFAULT_SEEDS = [
    {
        "id": "b751911878a6",
        "title": "Hello world — Python",
        "content": 'print("Hello, SnipVault 👋")',
        "category": "Code",
        "tags": ["python", "starter"],
        "pinned": False,
        "uses": 0,
    },
    {
        "id": "4d5b893b43f5",
        "title": "Kill process on port (Windows)",
        "content": "netstat -ano | findstr :PORT\ntaskkill /PID <pid> /F",
        "category": "Command",
        "tags": ["windows", "net"],
        "pinned": False,
        "uses": 0,
    },
    {
        "id": "6a064541a1b4",
        "title": "Useful colors",
        "content": "#6ee7b7 — mint\n#34d399 — emerald\n#79c0ff — sky\n#f87171 — rose",
        "category": "Color",
        "tags": ["palette"],
        "pinned": False,
        "uses": 0,
    },
    {
        "id": "0fd25c1fb35f",
        "title": "Regex — email (simple)",
        "content": r"^[\w.+-]+@[\w-]+\.[\w.-]+$",
        "category": "Snippet",
        "tags": ["regex", "email"],
        "pinned": False,
        "uses": 0,
    },
    {
        "id": "79333ed42eee",
        "title": "Welcome to SnipVault",
        "content": "Your snippets live here, locally on your machine.\nPress Ctrl+K to search, Ctrl+N to add a new snip.",
        "category": "Note",
        "tags": ["welcome"],
        "pinned": True,
        "uses": 0,
    },
]


# ----------------------------- Storage -----------------------------------

def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def ensure_data():
    DATA_DIR.mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        now = now_iso()
        snips = []
        for s in DEFAULT_SEEDS:
            item = dict(s)
            item["created_at"] = now
            item["updated_at"] = now
            snips.append(item)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "snips": snips,
                "categories": list(DEFAULT_CATEGORIES)
            }, f, indent=2, ensure_ascii=False)


def load_db():
    ensure_data()
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, dict):
                data = {}
            data.setdefault("snips", [])
            data.setdefault("categories", list(DEFAULT_CATEGORIES))
            return data
    except Exception as e:
        print(f"Error loading {DATA_FILE}: {e}")
        return {
            "snips": [],
            "categories": list(DEFAULT_CATEGORIES)
        }


def save_db(db):
    ensure_data()
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


def _auto_title(content: str) -> str:
    if not content:
        return "Untitled"
    lines = [line.strip() for line in str(content).strip().splitlines() if line.strip()]
    first = lines[0] if lines else "Untitled"
    return first[:80].strip() or "Untitled"


def _all_tags(snips):
    out = []
    seen = set()
    for s in snips:
        for t in s.get("tags", []):
            if t and t not in seen:
                seen.add(t)
                out.append(t)
    return out


# ----------------------------- Routes ------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/snips", methods=["GET"])
def list_snips():
    db = load_db()
    q = (request.args.get("q") or "").lower().strip()
    cat = (request.args.get("category") or "").strip()
    pinned_only = request.args.get("pinned") in ("1", "true", "True")

    snips = db.get("snips", [])

    if q:
        terms = q.split()
        snips = [
            s for s in snips
            if all(
                term in (
                    (s.get("title") or "") + " " +
                    (s.get("content") or "") + " " +
                    (s.get("category") or "") + " " +
                    " ".join(s.get("tags") or [])
                ).lower()
                for term in terms
            )
        ]

    if cat and cat.lower() != "all":
        snips = [s for s in snips if (s.get("category") or "").lower() == cat.lower()]

    if pinned_only:
        snips = [s for s in snips if s.get("pinned")]

    # Pinned first, then newest updated first
    snips.sort(
        key=lambda s: (1 if s.get("pinned", False) else 0, s.get("updated_at", "")),
        reverse=True
    )
    return jsonify({"snips": snips, "total": len(snips)})


@app.route("/api/snips", methods=["POST"])
def create_snip():
    data = request.get_json(force=True, silent=True) or {}
    content = data.get("content")
    if content is None or not str(content).strip():
        return jsonify({"error": "content is required"}), 400

    content = str(content)
    title = (data.get("title") or "").strip() or _auto_title(content)
    cat = (data.get("category") or "General").strip() or "General"

    db = load_db()
    cats = db.setdefault("categories", list(DEFAULT_CATEGORIES))
    if cat not in cats:
        cats.append(cat)

    tags = [str(t).strip().lstrip("#") for t in (data.get("tags") or []) if str(t).strip().lstrip("#")]

    now = now_iso()
    snip = {
        "id": uuid.uuid4().hex[:12],
        "title": title,
        "content": content,
        "category": cat,
        "tags": tags,
        "pinned": bool(data.get("pinned", False)),
        "created_at": now,
        "updated_at": now,
        "uses": 0,
    }
    db.setdefault("snips", []).append(snip)
    save_db(db)
    return jsonify({"snip": snip}), 201


@app.route("/api/snips/<sid>", methods=["GET"])
def get_snip(sid):
    db = load_db()
    snip = next((s for s in db.get("snips", []) if s.get("id") == sid), None)
    if not snip:
        return jsonify({"error": "not found"}), 404
    return jsonify({"snip": snip})


@app.route("/api/snips/<sid>", methods=["PUT", "PATCH"])
def update_snip(sid):
    data = request.get_json(force=True, silent=True) or {}
    db = load_db()
    snip = next((s for s in db.get("snips", []) if s.get("id") == sid), None)
    if not snip:
        return jsonify({"error": "not found"}), 404

    if "content" in data:
        content = data["content"]
        if content is None or not str(content).strip():
            return jsonify({"error": "content cannot be empty"}), 400
        snip["content"] = str(content)

    if "title" in data:
        title = (data["title"] or "").strip()
        snip["title"] = title if title else _auto_title(snip.get("content", ""))

    if "category" in data:
        cat = (data["category"] or "General").strip() or "General"
        snip["category"] = cat
        cats = db.setdefault("categories", list(DEFAULT_CATEGORIES))
        if cat not in cats:
            cats.append(cat)

    if "tags" in data:
        raw_tags = data["tags"] if isinstance(data["tags"], list) else []
        snip["tags"] = [str(t).strip().lstrip("#") for t in raw_tags if str(t).strip().lstrip("#")]

    if "pinned" in data:
        snip["pinned"] = bool(data["pinned"])

    snip["updated_at"] = now_iso()
    save_db(db)
    return jsonify({"snip": snip})


@app.route("/api/snips/<sid>", methods=["DELETE"])
def delete_snip(sid):
    db = load_db()
    before = len(db.get("snips", []))
    db["snips"] = [s for s in db.get("snips", []) if s.get("id") != sid]
    if len(db["snips"]) == before:
        return jsonify({"error": "not found"}), 404
    save_db(db)
    return jsonify({"ok": True})


@app.route("/api/snips/<sid>/use", methods=["POST"])
def mark_used(sid):
    db = load_db()
    snip = next((s for s in db.get("snips", []) if s.get("id") == sid), None)
    if not snip:
        return jsonify({"error": "not found"}), 404
    snip["uses"] = int(snip.get("uses", 0)) + 1
    save_db(db)
    return jsonify({"snip": snip})


@app.route("/api/categories", methods=["GET"])
def categories():
    db = load_db()
    return jsonify({"categories": db.get("categories", list(DEFAULT_CATEGORIES))})


@app.route("/api/categories", methods=["POST"])
def add_category():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    db = load_db()
    cats = db.setdefault("categories", list(DEFAULT_CATEGORIES))
    if name not in cats:
        cats.append(name)
        save_db(db)
    return jsonify({"categories": cats})


@app.route("/api/stats", methods=["GET"])
def stats():
    db = load_db()
    snips = db.get("snips", [])
    by_cat = {}
    for s in snips:
        c = s.get("category", "General")
        by_cat[c] = by_cat.get(c, 0) + 1
    return jsonify({
        "total": len(snips),
        "pinned": sum(1 for s in snips if s.get("pinned")),
        "total_uses": sum(int(s.get("uses", 0)) for s in snips),
        "by_category": by_cat,
        "tags": _all_tags(snips),
    })


@app.route("/api/export", methods=["GET"])
def export_all():
    db = load_db()
    return jsonify(db)


@app.route("/api/import", methods=["POST"])
def import_all():
    data = request.get_json(force=True, silent=True)
    if data is None:
        return jsonify({"error": "invalid JSON format"}), 400

    if isinstance(data, dict):
        snips = data.get("snips", [])
        categories = data.get("categories", [])
    elif isinstance(data, list):
        snips = data
        categories = []
    else:
        return jsonify({"error": "expected JSON object or array"}), 400

    if not isinstance(snips, list):
        return jsonify({"error": "snips must be a list"}), 400

    db = load_db()
    cats = db.setdefault("categories", list(DEFAULT_CATEGORIES))
    for c in categories:
        if isinstance(c, str) and c.strip() and c.strip() not in cats:
            cats.append(c.strip())

    existing_ids = {s.get("id") for s in db.get("snips", []) if isinstance(s, dict) and s.get("id")}
    added = 0
    now = now_iso()
    for s in snips:
        if not isinstance(s, dict):
            continue
        content = s.get("content")
        if content is None or not str(content).strip():
            continue

        sid = s.get("id") or uuid.uuid4().hex[:12]
        if sid in existing_ids:
            continue
        existing_ids.add(sid)

        cat = (s.get("category") or "General").strip() or "General"
        if cat not in cats:
            cats.append(cat)

        raw_tags = s.get("tags") if isinstance(s.get("tags"), list) else []
        tags = [str(t).strip().lstrip("#") for t in raw_tags if str(t).strip().lstrip("#")]

        db["snips"].append({
            "id": sid,
            "title": (s.get("title") or _auto_title(str(content))).strip(),
            "content": str(content),
            "category": cat,
            "tags": tags,
            "pinned": bool(s.get("pinned", False)),
            "created_at": s.get("created_at") or now,
            "updated_at": s.get("updated_at") or now,
            "uses": int(s.get("uses", 0)),
        })
        added += 1

    save_db(db)
    return jsonify({"added": added, "total": len(db["snips"])})


# ----------------------------- Boot --------------------------------------

def open_browser():
    webbrowser.open_new(f"http://127.0.0.1:{PORT}")


if __name__ == "__main__":
    ensure_data()
    print("=" * 52)
    print("  [SnipVault] SnipVault is running!")
    print(f"  Open:  http://127.0.0.1:{PORT}")
    print(f"  Data:  {DATA_FILE}")
    print("  Stop:  Press Ctrl+C")
    print("=" * 52)
    threading.Timer(1.0, open_browser).start()
    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)
