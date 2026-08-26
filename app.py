"""
SnipVault - A local, offline-first snippet & clipboard vault.
A simple, useful product for everyone.

Run: python app.py
Then open: http://127.0.0.1:5732
"""

import os
import json
import uuid
import datetime
import webbrowser
import threading
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory

APP_DIR = Path(__file__).parent.resolve()
DATA_DIR = APP_DIR / "data"
DATA_FILE = DATA_DIR / "snipvault.json"
PORT = 5732

app = Flask(__name__, static_folder="static", template_folder="templates")


# ----------------------------- Storage -----------------------------------

def ensure_data():
    DATA_DIR.mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump({"snips": [], "categories": [
                "General", "Code", "Snippet", "URL", "Note", "Color", "Command"
            ]}, f, indent=2)


def load_db():
    ensure_data()
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_db(db):
    ensure_data()
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


def now_iso():
    return datetime.datetime.utcnow().isoformat() + "Z"


# ----------------------------- Routes ------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/snips", methods=["GET"])
def list_snips():
    db = load_db()
    q = (request.args.get("q") or "").lower().strip()
    cat = (request.args.get("category") or "").strip()
    pinned_only = request.args.get("pinned") == "1"

    snips = db.get("snips", [])
    if q:
        snips = [s for s in snips if q in (s.get("title", "") + " " + s.get("content", "")).lower()]
    if cat and cat.lower() != "all":
        snips = [s for s in snips if s.get("category", "").lower() == cat.lower()]
    if pinned_only:
        snips = [s for s in snips if s.get("pinned")]

    # Newest first; pinned bubble up
    snips.sort(key=lambda s: (not s.get("pinned", False), s.get("updated_at", "")))
    snips.reverse()
    return jsonify({"snips": snips, "total": len(snips)})


@app.route("/api/snips", methods=["POST"])
def create_snip():
    data = request.get_json(force=True, silent=True) or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content is required"}), 400

    db = load_db()
    snip = {
        "id": uuid.uuid4().hex[:12],
        "title": (data.get("title") or _auto_title(content)).strip(),
        "content": content,
        "category": (data.get("category") or "General").strip(),
        "tags": [t.strip() for t in (data.get("tags") or []) if t.strip()],
        "pinned": bool(data.get("pinned", False)),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "uses": 0,
    }
    db["snips"].append(snip)
    save_db(db)
    return jsonify({"snip": snip})


@app.route("/api/snips/<sid>", methods=["GET"])
def get_snip(sid):
    db = load_db()
    snip = next((s for s in db["snips"] if s["id"] == sid), None)
    if not snip:
        return jsonify({"error": "not found"}), 404
    return jsonify({"snip": snip})


@app.route("/api/snips/<sid>", methods=["PUT", "PATCH"])
def update_snip(sid):
    data = request.get_json(force=True, silent=True) or {}
    db = load_db()
    snip = next((s for s in db["snips"] if s["id"] == sid), None)
    if not snip:
        return jsonify({"error": "not found"}), 404

    for key in ("title", "content", "category"):
        if key in data:
            snip[key] = data[key]
    if "tags" in data:
        snip["tags"] = [t.strip() for t in (data["tags"] or []) if t.strip()]
    if "pinned" in data:
        snip["pinned"] = bool(data["pinned"])
    snip["updated_at"] = now_iso()
    save_db(db)
    return jsonify({"snip": snip})


@app.route("/api/snips/<sid>", methods=["DELETE"])
def delete_snip(sid):
    db = load_db()
    before = len(db["snips"])
    db["snips"] = [s for s in db["snips"] if s["id"] != sid]
    if len(db["snips"]) == before:
        return jsonify({"error": "not found"}), 404
    save_db(db)
    return jsonify({"ok": True})


@app.route("/api/snips/<sid>/use", methods=["POST"])
def mark_used(sid):
    db = load_db()
    snip = next((s for s in db["snips"] if s["id"] == sid), None)
    if not snip:
        return jsonify({"error": "not found"}), 404
    snip["uses"] = int(snip.get("uses", 0)) + 1
    snip["updated_at"] = now_iso()
    save_db(db)
    return jsonify({"snip": snip})


@app.route("/api/categories", methods=["GET"])
def categories():
    db = load_db()
    return jsonify({"categories": db.get("categories", [])})


@app.route("/api/categories", methods=["POST"])
def add_category():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    db = load_db()
    cats = db.setdefault("categories", [])
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
    data = request.get_json(force=True, silent=True) or {}
    snips = data.get("snips", [])
    if not isinstance(snips, list):
        return jsonify({"error": "invalid"}), 400
    db = load_db()
    existing = {s["id"] for s in db["snips"]}
    added = 0
    for s in snips:
        if not isinstance(s, dict) or "content" not in s:
            continue
        sid = s.get("id") or uuid.uuid4().hex[:12]
        if sid in existing:
            continue
        db["snips"].append({
            "id": sid,
            "title": s.get("title") or _auto_title(s["content"]),
            "content": s["content"],
            "category": s.get("category", "General"),
            "tags": s.get("tags", []),
            "pinned": bool(s.get("pinned", False)),
            "created_at": s.get("created_at") or now_iso(),
            "updated_at": s.get("updated_at") or now_iso(),
            "uses": int(s.get("uses", 0)),
        })
        added += 1
    save_db(db)
    return jsonify({"added": added, "total": len(db["snips"])})


# ----------------------------- Helpers -----------------------------------

def _auto_title(content: str) -> str:
    first = content.strip().splitlines()[0] if content.strip() else "Untitled"
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


# ----------------------------- Boot --------------------------------------

def open_browser():
    webbrowser.open_new(f"http://127.0.0.1:{PORT}")


if __name__ == "__main__":
    ensure_data()
    print("=" * 52)
    print(f"  SnipVault is running!")
    print(f"  Open:  http://127.0.0.1:{PORT}")
    print(f"  Data:  {DATA_FILE}")
    print(f"  Stop:  Press Ctrl+C")
    print("=" * 52)
    threading.Timer(1.0, open_browser).start()
    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)
