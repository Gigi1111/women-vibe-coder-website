#!/usr/bin/env python3
"""
Site health checks for Women Vibe Coders. Plain Python 3, nothing to install.

  python3 tests/check_site.py                 # check the files in this folder (+ all outside links)
  python3 tests/check_site.py --offline       # only check files and links inside the site (no internet)
  python3 tests/check_site.py --live https://gigi1111.github.io/women-vibe-coder-website/
                                              # also check the published site

What it checks
  1. Every page loads its own files: images, pages, downloads and #section links all exist.
  2. Every outside link (guides, Luma, Discord, fonts, scripts...) still answers.
  3. The Welcome Slides (.pptx) and Starter Kit (.pdf) are real, openable files of a sensible size,
     and the links inside the slides work too.
  4. The Discord invite is still valid (not expired or deleted).
  5. The Luma calendar is still public.
  6. With --live: the published pages, short links and downloads are reachable.

Exit code 0 = all good, 1 = something is broken. Problems are listed at the end and,
when running on GitHub, also written to the job summary.
"""
import argparse
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Pages that make up the public site (the /draft/ review copy is checked separately by its own build).
PAGES = ["index.html", "starter-kit/index.html", "discord/index.html", "luma/index.html"]

# Files people download. Each must exist, be the right kind of file and stay under the size cap.
DOWNLOADS = {
    "assets/downloads/women-vibe-coders-welcome-slides.pptx": "pptx",
    "assets/downloads/women-vibe-coders-starter-kit.pdf": "pdf",
}
MAX_DOWNLOAD_MB = 25

DISCORD_INVITE = "z2NAsePDAG"
LUMA_CALENDAR = "https://luma.com/calendar/cal-Pkz6yetEPWfvMfW"

# Hosts that only exist to be preconnected to (they answer 404 on "/" by design).
PRECONNECT_ONLY = {"https://fonts.googleapis.com", "https://fonts.gstatic.com"}
# Sites that sometimes refuse automated checks; a 403/429 from these is a warning, not a failure.
BOT_SHY_HOSTS = {"www.datacamp.com", "datacamp.com", "openai.com", "www.openai.com", "luma.com", "lu.ma"}

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

problems, warnings, passed = [], [], []


def fail(msg):
    problems.append(msg)
    print(f"  ✗ {msg}")


def warn(msg):
    warnings.append(msg)
    print(f"  ! {msg}")


def ok(msg):
    passed.append(msg)
    print(f"  ✓ {msg}")


class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if a.get(key):
                self.links.append((tag, a[key]))


def parse(path):
    p = LinkCollector()
    with open(path, encoding="utf-8") as f:
        text = f.read()
    p.feed(text)
    # fetch('...') calls in inline scripts load data too (e.g. the world map)
    for url in re.findall(r"fetch\(\s*['\"](https?://[^'\"]+)['\"]", text):
        p.links.append(("fetch", url))
    return p


def http_get(url, method="GET", tries=3):
    """Return (status, final_url, body_bytes or None). Retries on network errors / 5xx."""
    last = None
    for attempt in range(tries):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                body = r.read() if method == "GET" else None
                return r.status, r.geturl(), body
        except urllib.error.HTTPError as e:
            last = (e.code, url, None)
            if e.code < 500 and e.code != 429:
                return last
        except Exception as e:  # DNS, timeout, TLS...
            last = (0, url, str(e).encode())
        time.sleep(2 * (attempt + 1))
    return last


# ── 1. Internal files and #anchors ────────────────────────────────────────────
def check_internal(page_rel, parsed, external):
    page_dir = os.path.dirname(os.path.join(ROOT, page_rel))
    for tag, link in parsed.links:
        if link.startswith(("mailto:", "tel:", "javascript:", "data:")):
            continue
        if link.startswith(("http://", "https://")):
            external.setdefault(link, set()).add(page_rel)
            continue
        target, _, frag = link.partition("#")
        target = target.split("?")[0]
        if not target:  # "#section" on the same page
            if frag and frag not in parsed.ids:
                fail(f"{page_rel}: link to #{frag} goes nowhere (no element has id=\"{frag}\")")
            continue
        path = os.path.normpath(os.path.join(page_dir, urllib.parse.unquote(target)))
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        if not os.path.exists(path):
            fail(f"{page_rel}: {link} → file not found ({os.path.relpath(path, ROOT)})")
        elif frag and path.endswith(".html"):
            if frag not in parse(path).ids:
                fail(f"{page_rel}: {link} → page exists but has no #{frag} section")


# ── 2. Outside links ──────────────────────────────────────────────────────────
def check_external(external):
    for url in sorted(external):
        where = ", ".join(sorted(external[url]))
        if url.rstrip("/") in PRECONNECT_ONLY:
            continue
        status, final, _ = http_get(url)
        host = urllib.parse.urlparse(url).hostname or ""
        if 200 <= status < 400:
            ok(f"{url}")
        elif status in (403, 429, 999) and host in BOT_SHY_HOSTS:
            warn(f"{url} answered {status} to the robot check (site blocks bots; open it by hand to be sure) [{where}]")
        else:
            reason = f"HTTP {status}" if status else "could not connect"
            fail(f"{url} is unreachable ({reason}) [used in {where}]")


# ── 3. Downloads ──────────────────────────────────────────────────────────────
def check_download_bytes(name, kind, data, source):
    mb = len(data) / 1_000_000
    if len(data) == 0:
        return fail(f"{source}: {name} is empty")
    if mb > MAX_DOWNLOAD_MB:
        fail(f"{source}: {name} is {mb:.1f} MB (over {MAX_DOWNLOAD_MB} MB, too slow on phones)")
    if kind == "pdf":
        if not data.startswith(b"%PDF"):
            return fail(f"{source}: {name} is not a real PDF")
        pages = len(re.findall(rb"/Type\s*/Page[^s]", data))
        if pages < 1:
            return fail(f"{source}: {name} has no pages")
        ok(f"{source}: {name} is a valid PDF, {pages} pages, {mb:.1f} MB")
    elif kind == "pptx":
        try:
            z = zipfile.ZipFile(io.BytesIO(data))
            bad = z.testzip()
            slides = [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
        except zipfile.BadZipFile:
            return fail(f"{source}: {name} is not a valid PowerPoint file (damaged)")
        if bad:
            return fail(f"{source}: {name} is damaged (bad part: {bad})")
        if "ppt/presentation.xml" not in z.namelist() or not slides:
            return fail(f"{source}: {name} opens but has no slides")
        ok(f"{source}: {name} is a valid PowerPoint deck, {len(slides)} slides, {mb:.1f} MB")
        return z
    return None


def links_in_pptx(z):
    urls = set()
    for n in z.namelist():
        if n.startswith("ppt/slides/_rels/") and n.endswith(".rels"):
            xml = z.read(n).decode("utf-8", "ignore")
            for m in re.finditer(r'Target="(https?://[^"]+)"[^>]*TargetMode="External"', xml):
                urls.add(m.group(1).replace("&amp;", "&"))
    return urls


# ── 4 & 5. Community links ────────────────────────────────────────────────────
def check_discord():
    status, _, body = http_get(f"https://discord.com/api/v10/invites/{DISCORD_INVITE}")
    if status == 200:
        info = json.loads(body)
        guild = (info.get("guild") or {}).get("name", "?")
        if info.get("expires_at"):
            warn(f"Discord invite works (server: {guild}) but EXPIRES at {info['expires_at']}; make a never-expiring one")
        else:
            ok(f"Discord invite valid, never expires (server: {guild})")
    elif status == 404:
        fail(f"Discord invite discord.gg/{DISCORD_INVITE} is invalid or expired; create a new one and update the site")
    else:
        warn(f"Couldn't verify the Discord invite right now (HTTP {status})")


def check_luma():
    status, _, body = http_get(LUMA_CALENDAR)
    if status == 200 and body and b"Women Vibe Coders" in body:
        ok("Luma calendar is public and shows Women Vibe Coders")
    elif status == 200:
        warn("Luma calendar loads, but the page doesn't mention Women Vibe Coders; check it by hand")
    elif status in (403, 429):
        warn(f"Luma blocked the robot check (HTTP {status}); open {LUMA_CALENDAR} by hand")
    else:
        fail(f"Luma calendar unreachable (HTTP {status}): {LUMA_CALENDAR}")


# ── 6. Published site ─────────────────────────────────────────────────────────
def check_live(base):
    base = base.rstrip("/") + "/"
    for rel in ["", "starter-kit/", "discord/", "luma/", "assets/logo.png", "assets/starter-kit-preview.jpg"]:
        status, _, _ = http_get(base + rel)
        (ok if status == 200 else fail)(f"live {base + rel} → HTTP {status}")
    for rel, kind in DOWNLOADS.items():
        status, _, data = http_get(base + rel)
        if status != 200 or data is None:
            fail(f"live download {base + rel} → HTTP {status}")
        else:
            check_download_bytes(os.path.basename(rel), kind, data, "live")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="skip everything that needs the internet")
    ap.add_argument("--live", metavar="URL", help="also check the published site at this address")
    args = ap.parse_args()

    external = {}
    print("1. Pages and their files")
    for page in PAGES:
        full = os.path.join(ROOT, page)
        if not os.path.exists(full):
            fail(f"page missing: {page}")
            continue
        before = len(problems)
        check_internal(page, parse(full), external)
        if len(problems) == before:
            ok(f"{page}: all internal links and files found")

    print("\n2. Downloads")
    for rel, kind in DOWNLOADS.items():
        full = os.path.join(ROOT, rel)
        if not os.path.exists(full):
            fail(f"download missing: {rel}")
            continue
        with open(full, "rb") as f:
            z = check_download_bytes(os.path.basename(rel), kind, f.read(), "file")
        if kind == "pptx" and z:
            for url in links_in_pptx(z):
                external.setdefault(url, set()).add(os.path.basename(rel))

    if not args.offline:
        print("\n3. Outside links")
        check_external(external)
        print("\n4. Community")
        check_discord()
        check_luma()
    if args.live:
        print(f"\n5. Published site ({args.live})")
        check_live(args.live)

    print(f"\n{len(passed)} passed, {len(warnings)} warnings, {len(problems)} problems")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(f"### Site check: {len(problems)} problems, {len(warnings)} warnings, {len(passed)} passed\n\n")
            for m in problems:
                f.write(f"- ❌ {m}\n")
            for m in warnings:
                f.write(f"- ⚠️ {m}\n")
    report = os.environ.get("SITE_CHECK_REPORT")
    if report:
        with open(report, "w", encoding="utf-8") as f:
            f.write("\n".join([f"- ❌ {m}" for m in problems] + [f"- ⚠️ {m}" for m in warnings]) + "\n")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
