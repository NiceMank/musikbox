#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MUSIKBOX — Lecteur / téléchargeur de musique local
====================================================
Serveur local (stdlib Python uniquement) qui :
  - sert l'interface web (glassmorphism + bois verni)
  - agit en reverse-proxy sur l'API du portail Tubidy analysé
    (recherche, formats MP3/MP4, streaming, téléchargement)
  - télécharge les MP3 sur le disque (dossier library/) pour une
    bibliothèque 100% locale, lisible directement dans l'app
  - supprime les publicités interstitielles du site d'origine

Lancer :  python3 server.py  →  http://localhost:8787
"""

import base64
import html as html_mod
import json
import os
import re
import shutil
import string
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import http.cookiejar
import mimetypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
BASE = "https://eurostylealuminium.co.za"
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8787"))
ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(ROOT, "static")
LIBRARY = os.path.join(ROOT, "library")
INDEX_FILE = os.path.join(LIBRARY, "_index.json")
DL_HISTORY_FILE = os.path.join(LIBRARY, "_dl_history.json")
MAX_DOWNLOADS = 3          # téléchargements simultanés max
TIMEOUT = 180              # timeout réseau (s)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0 Safari/537.36")

# ----------------------------------------------------------------------------
# Session HTTP partagée (cookies conservés entre requêtes)
# ----------------------------------------------------------------------------
_cj = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cj))
_opener.addheaders = [
    ("User-Agent", UA),
    ("Accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"),
    ("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.8"),
]

_lock = threading.Lock()
_token_cache = {}   # requête -> jeton de pagination (pt)

def http_get(url, headers=None, timeout=TIMEOUT, binary=False):
    req = urllib.request.Request(url, headers=headers or {})
    with _lock:
        resp = _opener.open(req, timeout=timeout)
        data = resp.read()
        info = dict(resp.headers)
        return data, info

def http_post(url, fields, headers=None, timeout=TIMEOUT):
    body = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": BASE + "/",
        **(headers or {}),
    })
    with _lock:
        resp = _opener.open(req, timeout=timeout)
        return resp.read().decode("utf-8", "ignore")

def http_post_json(url, fields, headers=None, timeout=TIMEOUT):
    try:
        return json.loads(http_post(url, fields, headers, timeout))
    except Exception:
        return {}

# ----------------------------------------------------------------------------
# Scraping
# ----------------------------------------------------------------------------
def unescape(s):
    if not s:
        return ""
    return html_mod.unescape(s).strip()

def parse_duration(raw):
    """PT4M1S -> 241 ; PT1H2M3S -> 3723"""
    if not raw:
        return 0
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", raw)
    if not m:
        return 0
    h, mm, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mm * 60 + s

def fmt_duration(sec):
    if not sec:
        return "0:00"
    sec = int(sec)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

def parse_items(html_text):
    """Extrait les résultats (article.item) d'une page HTML du site."""
    items = []
    for art in re.findall(r'<article\s+class="item[^"]*".*?</article>', html_text, re.S):
        m = re.search(r'href="([^"]*?/download/[^"]+)"', art)
        if not m:
            continue
        url = unescape(m.group(1))
        m2 = re.search(r'<img[^>]*data-src="([^"]+)"[^>]*alt="([^"]*)"', art) or \
             re.search(r'<img[^>]*alt="([^"]*)"[^>]*data-src="([^"]+)"', art)
        thumb = m2.group(1) if m2 else ""
        title = unescape(m2.group(2)) if m2 else ""
        m3 = re.search(r'<h3[^>]*>\s*<a[^>]*>(.*?)</a>', art, re.S)
        if m3 and not title:
            title = unescape(re.sub(r"<[^>]+>", "", m3.group(1)))
        m4 = re.search(r'<time[^>]*datetime="([^"]+)"', art)
        dur = parse_duration(m4.group(1)) if m4 else 0
        if title:
            items.append({"title": title, "url": url, "thumb": thumb,
                          "duration": dur, "duration_str": fmt_duration(dur)})
    return items

def parse_playlists(html_text):
    """Extrait les playlists d'une page genre (div.item avec liens /playlist/)."""
    out = []
    for m in re.finditer(
            r'<div class="item[^"]*">\s*<a href="([^"]*?/playlist/[^"]+)"[^>]*title="([^"]*)"'
            r'[\s\S]{0,600}?<img[^>]*data-src="([^"]*)"', html_text):
        url, title, thumb = m.groups()
        if url and title:
            out.append({"title": unescape(title), "url": unescape(url),
                        "thumb": thumb, "playlist": True,
                        "duration": 0, "duration_str": "Playlist"})
    return out

def parse_pagination(html_text, base_path):
    """Cherche le lien page suivante (avec jeton chiffré)."""
    for m in re.finditer(r'href="([^"]*page=2[^"]*)"', html_text):
        href = unescape(m.group(1))
        if base_path in href or href.startswith("/"):
            return href if href.startswith("http") else BASE + href
    return None

# ----------------------------------------------------------------------------
# API Tubidy (reverse proxy)
# ----------------------------------------------------------------------------
def fetch_page(url):
    """Récupère une page du site et extrait payload + métadonnées."""
    data, _ = http_get(url if url.startswith("http") else BASE + url)
    text = data.decode("utf-8", "ignore")
    payload = None
    m = re.search(r"App\.video\('([^']+)'\)", text)
    if m:
        payload = m.group(1)
    title = ""
    m = re.search(r'<meta property="og:title" content="([^"]*)"', text)
    if m:
        title = unescape(m.group(1))
    else:
        m = re.search(r"<title>(.*?)</title>", text, re.S)
        if m:
            title = unescape(re.sub(r"\s*-\s*Download.*$", "", m.group(1)))
    thumb = ""
    m = re.search(r'<meta property="og:image" content="([^"]*)"', text)
    if m:
        thumb = m.group(1)
    dur = 0
    m = re.search(r'<article id="video"[\s\S]{0,6000}?<time[^>]*datetime="([^"]+)"', text)
    if not m:
        m = re.search(r'<time[^>]*datetime="([^"]+)"', text)
    if m:
        dur = parse_duration(m.group(1))
    return {"title": title, "thumb": thumb, "duration": dur,
            "duration_str": fmt_duration(dur), "payload": payload,
            "page_url": url, "url": url}

def api_formats(payload):
    """POST /api/video/formats avec nouvelle tentative tant que non traité."""
    for attempt in range(30):
        resp = http_post_json(BASE + "/api/video/formats", {"payload": payload})
        if resp.get("processed") or str(resp.get("status", "")).lower() == "error":
            break
        time.sleep(3)
    formats = resp.get("formats", []) if isinstance(resp, dict) else []
    return {
        "processed": bool(resp.get("processed")),
        "status": resp.get("status", "ok"),
        "formats": [
            {"label": f.get("label"), "size": f.get("size"),
             "payload": f.get("payload")}
            for f in formats if f.get("payload")
        ],
    }

def api_link(payload, kind):
    """POST /api/video/play ou /api/video/download -> {link, ads}"""
    endpoint = "/api/video/play" if kind == "play" else "/api/video/download"
    resp = http_post_json(BASE + endpoint, {"payload": payload})
    if not isinstance(resp, dict):
        return {"link": None}
    link = resp.get("link") or ""
    return {"link": link, "ads": resp.get("ads")}

# ----------------------------------------------------------------------------
# Bibliothèque locale (fichiers téléchargés)
# ----------------------------------------------------------------------------
def safe_filename(title, ext=".mp3"):
    keep = set(string.ascii_letters + string.digits + " -_()[]'’àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ")
    name = "".join(c if c in keep else " " for c in title)
    name = re.sub(r"\s+", " ", name).strip(" ._")
    if not name:
        name = "morceau_" + str(int(time.time()))
    if len(name) > 110:
        name = name[:110].rstrip(" ._-" )
    return name + ext

def load_index():
    if os.path.exists(INDEX_FILE):
        try:
            with open(INDEX_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_index(idx):
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, indent=1)

def load_dl_history():
    try:
        with open(DL_HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_dl_history(hist):
    try:
        with open(DL_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(hist, f, ensure_ascii=False, indent=1)
    except Exception:
        pass

def library_list():
    idx = load_index()
    files = []
    for name in os.listdir(LIBRARY):
        if not name.lower().endswith((".mp3", ".mp4", ".m4a", ".ogg", ".wav", ".flac")):
            continue
        path = os.path.join(LIBRARY, name)
        st = os.stat(path)
        meta = idx.get(name, {})
        files.append({
            "name": name,
            "title": meta.get("title", os.path.splitext(name)[0]),
            "thumb": meta.get("thumb", ""),
            "duration": meta.get("duration", 0),
            "duration_str": meta.get("duration_str", ""),
            "size": st.st_size,
            "size_str": fmt_size(st.st_size),
            "added": meta.get("added", st.st_mtime),
            "local": True,
        })
    files.sort(key=lambda f: f["added"], reverse=True)
    return files

def fmt_size(n):
    if n >= 1 << 30:
        return f"{n / (1 << 30):.2f} Go"
    if n >= 1 << 20:
        return f"{n / (1 << 20):.1f} Mo"
    if n >= 1 << 10:
        return f"{n / (1 << 10):.0f} Ko"
    return f"{n} o"

# --- Gestionnaire de téléchargements -----------------------------------------
DL = {}   # id -> {status, progress, filename, error, ...}
_dl_sem = threading.Semaphore(MAX_DOWNLOADS)
_dl_id = 0

def start_download(payload, title, thumb, duration, duration_str, ext=".mp3", url=""):
    global _dl_id
    # déjà en bibliothèque ? (même titre + même extension)
    idx = load_index()
    for fname, meta in idx.items():
        if meta.get("title") == title and fname.lower().endswith(ext):
            return {"id": "exists", "filename": fname, "title": title}
    with _lock:
        _dl_id += 1
        job_id = str(_dl_id)
    DL[job_id] = {"id": job_id, "status": "queued", "progress": 0, "filename": None,
                  "error": None, "title": title, "ext": ext,
                  "thumb": thumb, "duration_str": duration_str, "url": url,
                  "ts": time.time()}
    threading.Thread(target=_download_worker, args=(
        job_id, payload, title, thumb, duration, duration_str, ext),
        daemon=True).start()
    return {"id": job_id, "title": title}

def _record_history(job):
    hist = load_dl_history()
    hist[str(job.get("id"))] = {
        "id": job.get("id"), "title": job.get("title"),
        "thumb": job.get("thumb", ""), "duration_str": job.get("duration_str", ""),
        "ext": job.get("ext", "mp3"), "status": job.get("status"),
        "progress": job.get("progress", 0), "filename": job.get("filename"),
        "error": job.get("error"), "ts": job.get("ts", time.time()),
        "size": job.get("size"),
    }
    save_dl_history(hist)

def _download_worker(job_id, payload, title, thumb, duration, duration_str, ext):
    job = DL[job_id]
    tmp = None
    try:
        link = api_link(payload, "download").get("link")
        if not link:
            job["status"] = "error"
            job["error"] = "Aucun lien de téléchargement retourné."
            _record_history(job)
            return
        with _dl_sem:
            job["status"] = "downloading"
            fname = safe_filename(title, ext)
            path = os.path.join(LIBRARY, fname)
            tmp = path + ".part"
            req = urllib.request.Request(link, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=600) as resp, open(tmp, "wb") as out:
                total = int(resp.headers.get("Content-Length") or 0)
                done = 0
                while True:
                    chunk = resp.read(1 << 16)
                    if not chunk:
                        break
                    out.write(chunk)
                    done += len(chunk)
                    if total:
                        job["progress"] = round(done * 100 / total)
            os.replace(tmp, path)
            tmp = None
            idx = load_index()
            idx[fname] = {"title": title, "thumb": thumb,
                          "duration": duration, "duration_str": duration_str,
                          "added": time.time()}
            save_index(idx)
            job["status"] = "done"
            job["progress"] = 100
            job["filename"] = fname
            job["size"] = os.path.getsize(path)
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)[:300]
    finally:
        if tmp and os.path.exists(tmp):
            try:
                os.remove(tmp)
            except Exception:
                pass
        _record_history(job)

# ----------------------------------------------------------------------------
# Handler HTTP
# ----------------------------------------------------------------------------
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=STATIC, **kw)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (time.strftime("%H:%M:%S"), fmt % args))

    # --- helpers ------------------------------------------------------------
    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, msg, code=500):
        self.send_json({"error": msg}, code)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        try:
            return urllib.parse.parse_qs(self.rfile.read(length).decode("utf-8", "ignore"))
        except Exception:
            return {}

    def query(self, key, default=""):
        return self._qs.get(key, [default])[0] if key in self._qs else default

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # --- routes -------------------------------------------------------------
    def do_GET(self):
        self._qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        path = urllib.parse.urlparse(self.path).path
        try:
            if path == "/" or path == "/index.html":
                return self.serve_file("index.html")
            if path.startswith("/static/"):
                return self.serve_file(path[len("/static/"):])
            if path == "/api/health":
                return self.send_json({"ok": True, "app": "musikbox"})
            if path == "/api/search":
                return self.api_search()
            if path == "/api/suggest":
                return self.api_suggest()
            if path == "/api/top":
                return self.api_top()
            if path == "/api/genre":
                return self.api_genre()
            if path == "/api/page":
                return self.api_page()
            if path == "/api/library":
                return self.send_json({"items": library_list()})
            if path == "/api/download/status":
                return self.api_dl_status()
            if path == "/api/downloads":
                return self.api_downloads()
            if path.startswith("/stream"):
                return self.proxy_stream()
            if path.startswith("/library/file/"):
                return self.serve_library_file(path[len("/library/file/"):])
            return self.send_error_json("Route inconnue : " + path, 404)
        except urllib.error.HTTPError as e:
            return self.send_error_json("Erreur HTTP %s" % e.code, 502)
        except Exception as e:
            return self.send_error_json(str(e)[:300], 500)

    def do_POST(self):
        self._qs = {}
        path = urllib.parse.urlparse(self.path).path
        body = self.read_body()
        try:
            if path == "/api/formats":
                payload = body.get("payload", [""])[0]
                if not payload:
                    return self.send_error_json("payload manquant", 400)
                return self.send_json(api_formats(payload))
            if path == "/api/play":
                payload = body.get("payload", [""])[0]
                if not payload:
                    return self.send_error_json("payload manquant", 400)
                return self.send_json(api_link(payload, "play"))
            if path == "/api/download":
                payload = body.get("payload", [""])[0]
                title = body.get("title", ["morceau"])[0]
                thumb = body.get("thumb", [""])[0]
                duration = int(body.get("duration", ["0"])[0] or 0)
                duration_str = body.get("duration_str", [""])[0]
                ext = ".mp4" if body.get("ext", ["mp4"])[0] == "mp4" else ".mp3"
                url = body.get("url", [""])[0]
                if not payload:
                    return self.send_error_json("payload manquant", 400)
                result = start_download(payload, title, thumb, duration, duration_str, ext, url)
                return self.send_json(result)
            if path == "/api/library/delete":
                name = body.get("name", [""])[0]
                target = os.path.join(LIBRARY, os.path.basename(name))
                if os.path.exists(target):
                    os.remove(target)
                idx = load_index()
                idx.pop(os.path.basename(name), None)
                save_index(idx)
                return self.send_json({"ok": True})
            return self.send_error_json("Route inconnue : " + path, 404)
        except Exception as e:
            return self.send_error_json(str(e)[:300], 500)

    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/library/"):
            name = os.path.basename(urllib.parse.unquote(path[len("/api/library/"):]))
            target = os.path.join(LIBRARY, name)
            if os.path.exists(target):
                os.remove(target)
            idx = load_index()
            idx.pop(name, None)
            save_index(idx)
            return self.send_json({"ok": True})
        return self.send_error_json("Route inconnue", 404)

    # --- implémentations -----------------------------------------------------
    def serve_file(self, rel):
        path = os.path.normpath(os.path.join(STATIC, rel))
        if not path.startswith(STATIC) or not os.path.isfile(path):
            return self.send_error_json("Fichier introuvable", 404)
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def api_search(self):
        q = self.query("q").strip()
        if not q:
            return self.send_json({"items": [], "has_more": False, "query": ""})
        # recherche spéciale "genre:slug" → playlists du genre
        if q.startswith("genre:"):
            slug = q.split(":", 1)[1].strip()
            try:
                data, _ = http_get(BASE + "/genre/" + slug)
                text = data.decode("utf-8", "ignore")
                return self.send_json({"items": parse_playlists(text), "has_more": False,
                                       "query": q, "page": 1, "playlists": True})
            except Exception as e:
                return self.send_json({"items": [], "has_more": False, "query": q,
                                       "error": str(e)[:200]})
        # recherche spéciale "playlist:url" → morceaux de la playlist
        if q.startswith("playlist:"):
            url = q.split(":", 1)[1].strip()
            try:
                data, _ = http_get(url if url.startswith("http") else BASE + url)
                text = data.decode("utf-8", "ignore")
                return self.send_json({"items": parse_items(text), "has_more": False,
                                       "query": q, "page": 1, "playlist": True})
            except Exception as e:
                return self.send_json({"items": [], "has_more": False, "query": q,
                                       "error": str(e)[:200]})
        page = max(1, int(self.query("page", "1") or 1))
        # le jeton chiffré (pt) présent sur la page 1 est réutilisable
        # pour toutes les pages suivantes → on le met en cache
        token = _token_cache.get(q)
        if token is None:
            first, _ = http_get(BASE + "/search?" + urllib.parse.urlencode({"q": q}))
            text1 = first.decode("utf-8", "ignore")
            # le HTML échappe les & (pt=...&page=2) : chercher juste "pt="
            m = re.search(r'pt=([^"\']+)', text1)
            token = m.group(1).split("&")[0] if m else ""
            with _lock:
                _token_cache[q] = token
        if page == 1:
            url = BASE + "/search?" + urllib.parse.urlencode({"q": q})
        elif token:
            url = BASE + "/search?" + urllib.parse.urlencode({"q": q, "page": page, "pt": token})
        else:
            url = BASE + "/search?" + urllib.parse.urlencode({"q": q, "page": page})
        data, _ = http_get(url)
        text = data.decode("utf-8", "ignore")
        items = parse_items(text)
        has_more = len(items) >= 20
        return self.send_json({"items": items, "has_more": has_more, "query": q, "page": page})

    def api_suggest(self):
        q = self.query("q").strip()
        if not q:
            return self.send_json({"items": []})
        url = ("https://suggestqueries.google.com/complete/search?hl=fr&ds=yt&client=youtube&q="
               + urllib.parse.quote(q))
        try:
            data, _ = http_get(url, headers={"Referer": "https://www.youtube.com/"})
            raw = data.decode("utf-8", "ignore")
            # réponse JSONP : window.google.ac.h([...])
            start, end = raw.find("["), raw.rfind("]")
            if start < 0 or end <= start:
                return self.send_json({"items": []})
            arr = json.loads(raw[start:end + 1])
            items = [s[0] if isinstance(s, (list, tuple)) else s
                     for s in (arr[1] if len(arr) > 1 else [])]
            return self.send_json({"items": items})
        except Exception:
            return self.send_json({"items": []})

    def api_top(self):
        url = BASE + "/top-videos"
        data, _ = http_get(url)
        text = data.decode("utf-8", "ignore")
        items = parse_items(text)
        if self.query("shuffle") == "1":
            import random
            random.shuffle(items)
        return self.send_json({"items": items})

    def api_genre(self):
        slug = self.query("slug").strip()
        if not slug:
            return self.send_json({"items": []})
        data, _ = http_get(BASE + "/genre/" + slug)
        text = data.decode("utf-8", "ignore")
        return self.send_json({"items": parse_items(text)})

    def api_page(self):
        url = self.query("url").strip()
        if not url:
            return self.send_error_json("url manquante", 400)
        if not url.startswith("http"):
            url = BASE + url
        return self.send_json(fetch_page(url))

    def api_dl_status(self):
        job_id = self.query("id")
        job = DL.get(job_id)
        if not job:
            return self.send_json({"error": "téléchargement inconnu"}, 404)
        return self.send_json(dict(job))

    def api_downloads(self):
        """Historique des téléchargements (persistant) + travaux en cours."""
        hist = load_dl_history()
        entries = list(hist.values())
        seen = {e["id"] for e in entries}
        for jid, job in DL.items():
            if jid not in seen:
                entries.append(dict(job))
        entries.sort(key=lambda e: e.get("ts", 0), reverse=True)
        for e in entries:
            e.setdefault("size", 0)
            if e.get("filename"):
                p = os.path.join(LIBRARY, e["filename"])
                e["exists"] = os.path.isfile(p)
                if not e.get("size") and os.path.isfile(p):
                    e["size"] = os.path.getsize(p)
            else:
                e["exists"] = False
        return self.send_json({"items": entries})

    def proxy_stream(self):
        """Proxy le flux audio/vidéo distant avec support des ranges
        (permet la lecture + la recherche dans la piste)."""
        target = self.query("u")
        if not target:
            return self.send_error_json("u manquante", 400)
        try:
            target = base64.urlsafe_b64decode(target + "==" * (-len(target) % 4)).decode()
        except Exception:
            pass
        rng = self.headers.get("Range")
        headers = {"User-Agent": UA, "Referer": BASE + "/"}
        if rng:
            headers["Range"] = rng
        try:
            resp = urllib.request.urlopen(urllib.request.Request(target, headers=headers), timeout=TIMEOUT)
        except urllib.error.HTTPError as e:
            return self.send_error_json("flux indisponible (%s)" % e.code, 502)
        self.send_response(resp.status)
        for h in ("Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"):
            v = resp.headers.get(h)
            if v:
                self.send_header(h, v)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            while True:
                chunk = resp.read(1 << 16)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            resp.close()

    def serve_library_file(self, name):
        """Sert un fichier de la bibliothèque avec support Range (lecture locale)."""
        name = os.path.basename(urllib.parse.unquote(name))
        path = os.path.join(LIBRARY, name)
        if not os.path.isfile(path):
            return self.send_error_json("fichier introuvable", 404)
        size = os.path.getsize(path)
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                if m.group(2):
                    end = min(int(m.group(2)), size - 1)
        length = end - start + 1
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        if rng:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(1 << 16, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
                remaining -= len(chunk)


def main():
    os.makedirs(LIBRARY, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("=" * 56)
    print("  MUSIKBOX — bibliothèque musicale locale")
    print("  Interface : http://localhost:%d" % PORT)
    print("  Bibliothèque locale : %s" % LIBRARY)
    print("  Ctrl+C pour arrêter")
    print("=" * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt.")


if __name__ == "__main__":
    main()
