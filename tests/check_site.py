#!/usr/bin/env python3
"""Static checks for the Deadline Calendar site.

Run from anywhere:  python3 tests/check_site.py
Exits non-zero and lists every failure if anything is off.
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://vj-madhu-dath.github.io/deadline-calendar"
BASE_HOST = urlparse(BASE).netloc
MIN_WORDS, MAX_WORDS = 980, 1020

failures: list[str] = []


def fail(where: str, msg: str) -> None:
    failures.append(f"{where}: {msg}")


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def page_url(p: Path) -> str:
    r = rel(p)
    if r == "index.html":
        return BASE + "/"
    if r.endswith("/index.html"):
        return f"{BASE}/{r[: -len('index.html')]}"
    return f"{BASE}/{r}"


def strip_tags(s: str) -> str:
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def attr(src: str, pattern: str) -> str | None:
    m = re.search(pattern, src, re.S | re.I)
    return m.group(1).strip() if m else None


HTML_FILES = sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts)
POST_FILES = sorted(p for p in (ROOT / "blog").glob("*.html") if p.name != "index.html")
IDS: dict[Path, set[str]] = {
    p: set(re.findall(r'\bid="([^"]+)"', read(p))) for p in HTML_FILES
}

# ---------------------------------------------------------------- page basics

titles: dict[str, Path] = {}
descs: dict[str, Path] = {}
canonicals: dict[str, Path] = {}

for p in HTML_FILES:
    src = read(p)
    where = rel(p)

    if not re.search(r"<html[^>]*\slang=", src, re.I):
        fail(where, "missing lang attribute on <html>")
    if 'name="viewport"' not in src:
        fail(where, "missing viewport meta")

    title = attr(src, r"<title>(.*?)</title>")
    if not title:
        fail(where, "missing <title>")
    elif title in titles:
        fail(where, f"duplicate title, also used by {rel(titles[title])}")
    else:
        titles[title] = p
    if title and len(title) > 75:
        fail(where, f"title is {len(title)} chars (max 75)")

    desc = attr(src, r'<meta name="description" content="(.*?)"')
    if not desc:
        fail(where, "missing meta description")
    elif desc in descs:
        fail(where, f"duplicate description, also used by {rel(descs[desc])}")
    else:
        descs[desc] = p
    if desc and not (50 <= len(desc) <= 185):
        fail(where, f"description is {len(desc)} chars (want 50-185)")

    canon = attr(src, r'<link rel="canonical" href="(.*?)"')
    expected = page_url(p)
    if not canon:
        fail(where, f"missing canonical (expected {expected})")
    elif canon != expected:
        fail(where, f"canonical is {canon}, expected {expected}")
    else:
        canonicals[canon] = p

    h1s = re.findall(r"<h1\b", src, re.I)
    if len(h1s) != 1:
        fail(where, f"has {len(h1s)} h1 elements (want 1)")

    for block in re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', src, re.S
    ):
        try:
            json.loads(block)
        except json.JSONDecodeError as exc:
            fail(where, f"invalid JSON-LD: {exc}")

# ---------------------------------------------------------------- links

for p in HTML_FILES:
    src = read(p)
    where = rel(p)
    for href in re.findall(r'href="([^"]+)"', src):
        if href.startswith(("mailto:", "tel:", "javascript:")):
            continue
        if href.startswith("#"):
            anchor = href[1:]
            if anchor and anchor not in IDS[p]:
                fail(where, f"anchor #{anchor} does not exist on this page")
            continue

        parsed = urlparse(href)
        if parsed.scheme in ("http", "https"):
            if parsed.netloc != BASE_HOST or not parsed.path.startswith(
                urlparse(BASE).path
            ):
                continue  # external source link, not ours to verify
            target = ROOT / parsed.path[len(urlparse(BASE).path) :].lstrip("/")
            fragment = parsed.fragment
        else:
            if not parsed.path:
                continue
            target = (p.parent / parsed.path).resolve()
            fragment = parsed.fragment

        if target.is_dir() or parsed.path.endswith("/"):
            target = target / "index.html"
        if not target.exists():
            fail(where, f"broken link: {href}")
            continue
        if fragment and target.suffix == ".html":
            if fragment not in IDS.get(target.resolve(), set()):
                fail(where, f"link {href} points at missing anchor #{fragment}")

# ---------------------------------------------------------------- posts

if len(POST_FILES) != 10:
    fail("blog/", f"expected 10 posts, found {len(POST_FILES)}")

post_urls: set[str] = set()
for p in POST_FILES:
    src = read(p)
    where = rel(p)
    post_urls.add(page_url(p))

    m = re.search(
        r'<div class="prose">(.*?)</div>\s*<div class="post-cta">', src, re.S
    )
    if not m:
        fail(where, "could not isolate .prose block")
        words = 0
    else:
        words = len(strip_tags(m.group(1)).split())
        if not (MIN_WORDS <= words <= MAX_WORDS):
            fail(where, f"{words} words in .prose (want {MIN_WORDS}-{MAX_WORDS})")
    badge = attr(src, r"<span>(\d+) min read</span>")
    if not badge:
        fail(where, "missing read-time badge")
    elif not (words / 250 <= int(badge) <= words / 120):
        fail(where, f"read-time badge {badge} min is off for {words} words")

    published = attr(src, r'<meta property="article:published_time" content="(.*?)"')
    if not published or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", published or ""):
        fail(where, "missing or malformed article:published_time")
    if published:
        shown = attr(src, r'<div class="article-meta">\s*<span>(.*?)</span>')
        months = {
            "January": 1, "February": 2, "March": 3, "April": 4, "May": 5,
            "June": 6, "July": 7, "August": 8, "September": 9, "October": 10,
            "November": 11, "December": 12,
        }
        y, mo, d = published.split("-")
        want = f"{int(d)} {[k for k, v in months.items() if v == int(mo)][0]} {y}"
        if shown != want:
            fail(where, f"visible date {shown!r} does not match {want!r}")

    blocks = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', src, re.S
    )
    article = None
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if data.get("@type") == "Article":
            article = data
    if not article:
        fail(where, "no Article JSON-LD")
    else:
        for key in ("headline", "datePublished", "dateModified", "author", "publisher"):
            if key not in article:
                fail(where, f"Article JSON-LD missing {key}")
        if article.get("author", {}).get("@type") != "Organization":
            fail(where, "Article author must be an Organization")
        if article.get("headline") != attr(src, r"<h1>(.*?)</h1>"):
            fail(where, "Article headline does not match the h1")
        if article.get("datePublished") != published:
            fail(where, "Article datePublished does not match the meta tag")

    for bad in ("rel=\"author\"", 'class="byline"', ">Written by", "About the author"):
        if bad in src:
            fail(where, f"byline marker present: {bad}")
    if re.search(r"<address\b", src, re.I):
        fail(where, "author <address> block present")

# ---------------------------------------------------------------- sitemap

sitemap = ROOT / "sitemap.xml"
if not sitemap.exists():
    fail("sitemap.xml", "missing")
else:
    try:
        tree = ET.parse(sitemap)
    except ET.ParseError as exc:
        fail("sitemap.xml", f"invalid XML: {exc}")
        tree = None
    if tree:
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locs = [e.text.strip() for e in tree.getroot().findall("s:url/s:loc", ns)]
        if len(locs) != len(set(locs)):
            fail("sitemap.xml", "duplicate <loc> entries")
        expected = set(canonicals)
        for missing in sorted(expected - set(locs)):
            fail("sitemap.xml", f"missing page: {missing}")
        for extra in sorted(set(locs) - expected):
            fail("sitemap.xml", f"points at unknown page: {extra}")
        for url in tree.getroot().findall("s:url", ns):
            loc = url.findtext("s:loc", default="", namespaces=ns).strip()
            lastmod = url.findtext("s:lastmod", default="", namespaces=ns).strip()
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", lastmod):
                fail("sitemap.xml", f"{loc} has malformed lastmod {lastmod!r}")
            if loc in post_urls:
                published = attr(
                    read(canonicals[loc]),
                    r'<meta property="article:published_time" content="(.*?)"',
                )
                if lastmod != published:
                    fail("sitemap.xml", f"{loc} lastmod {lastmod} != published {published}")

# ---------------------------------------------------------------- feed

feed = ROOT / "feed.xml"
if not feed.exists():
    fail("feed.xml", "missing")
else:
    try:
        root = ET.parse(feed).getroot()
    except ET.ParseError as exc:
        fail("feed.xml", f"invalid XML: {exc}")
        root = None
    if root is not None:
        if root.tag != "rss":
            fail("feed.xml", f"root element is {root.tag}, want rss")
        channel = root.find("channel")
        if channel is None:
            fail("feed.xml", "no <channel>")
        else:
            items = channel.findall("item")
            if len(items) != len(POST_FILES):
                fail("feed.xml", f"{len(items)} items, want {len(POST_FILES)}")
            seen: set[str] = set()
            for item in items:
                link = (item.findtext("link") or "").strip()
                seen.add(link)
                if link not in post_urls:
                    fail("feed.xml", f"item link is not a post: {link}")
                pub = item.findtext("pubDate") or ""
                try:
                    parsedate_to_datetime(pub)
                except (TypeError, ValueError):
                    fail("feed.xml", f"bad pubDate {pub!r} for {link}")
                if not (item.findtext("title") or "").strip():
                    fail("feed.xml", f"empty title for {link}")
                if not (item.findtext("guid") or "").strip():
                    fail("feed.xml", f"empty guid for {link}")
            for missing in sorted(post_urls - seen):
                fail("feed.xml", f"no item for {missing}")

# ---------------------------------------------------------------- report

if failures:
    print(f"{len(failures)} problem(s):\n")
    for f in failures:
        print("  -", f)
    sys.exit(1)

print(f"OK — {len(HTML_FILES)} pages, {len(POST_FILES)} posts, sitemap and feed consistent.")
