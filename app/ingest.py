# -*- coding: utf-8 -*-
import json, time, asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
import feedparser, httpx, yaml, tldextract
from summa.summarizer import summarize
import trafilatura

from textutil import normalize_url, normalize_title, similar, stable_id

def now_iso_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

def host_of(url: str) -> str:
    t = tldextract.extract(url)
    return ".".join([x for x in [t.domain, t.suffix] if x])

def entry_published_str(e: dict) -> str:
    # 優先: published → updated → 空文字
    return e.get("published") or e.get("updated") or ""

def entry_epoch(e: dict) -> float:
    # feedparser の struct_time を優先して epoch に
    for key in ("published_parsed", "updated_parsed"):
        st = e.get(key)
        if st:
            try:
                return time.mktime(st)
            except Exception:
                pass
    # 無ければ 0
    return 0.0

def ja_lead3(text: str, max_sentences: int = 3) -> str:
    # 日本語テキストを「。」で素朴に分割して先頭からN文
    if not text:
        return ""
    sents = [s for s in text.replace("\\n","").split("。") if s.strip()]
    return "。".join(sents[:max_sentences]) + ("。" if sents[:max_sentences] else "")

async def fetch_html(client: httpx.AsyncClient, url: str) -> str:
    r = await client.get(url, timeout=15)
    r.raise_for_status()
    return r.text

def extract_text(html: str, base_url: str) -> str:
    txt = trafilatura.extract(html, url=base_url, include_comments=False, favor_recall=True)
    return (txt or "").strip()

def summarize_text(text: str, max_sentences: int = 3) -> str:
    if not text:
        return ""
    # TextRank（英語寄り）→ うまく出なければ lead3 にフォールバック
    try:
        sents = summarize(text, split=True)
        if sents:
            return " ".join(sents[:max_sentences])
    except Exception:
        pass
    return ja_lead3(text, max_sentences=max_sentences)

def unique_append(items: List[dict], title: str) -> bool:
    # タイトル近似で重複抑制（緩め）
    for it in items:
        if similar(title, it["title"]):
            return False
    return True

async def ingest(cats: Dict[str, List[str]]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    headers = {"User-Agent": "NewsDigestBot/1.0 (+github actions)"}
    limits = httpx.Limits(max_connections=10, max_keepalive_connections=10)
    async with httpx.AsyncClient(headers=headers, limits=limits, follow_redirects=True) as client:
        for cat, feeds in cats.items():
            entries: List[dict] = []
            # 1) RSS取得
            for feed_url in feeds or []:
                try:
                    f = feedparser.parse(feed_url)
                    for e in f.entries[:50]:
                        title = (e.get("title") or "").strip()
                        link = normalize_url(e.get("link") or "")
                        if not title or not link:
                            continue
                        if not unique_append(entries, title):
                            continue
                        entries.append({
                            "title": title,
                            "url": link,
                            "published": entry_published_str(e),
                            "epoch": entry_epoch(e),
                            "source": host_of(link),
                        })
                except Exception:
                    continue

            # 2) 本文抽出 + 要約（並列）
            sem = asyncio.Semaphore(6)
            async def process(it: dict) -> Optional[dict]:
                async with sem:
                    html = ""
                    try:
                        html = await fetch_html(client, it["url"])
                    except Exception:
                        pass
                    text = extract_text(html, it["url"]) if html else ""
                    summ = summarize_text(text, max_sentences=3) or ""
                    # support_count は後段で近似束ねして設定
                    return {
                        "id": stable_id(it["title"], it["url"]),
                        "title": it["title"],
                        "url": it["url"],
                        "source": it["source"],
                        "published": it["published"],
                        "summary": summ,
                        "support_count": 1,
                        "_norm_title": normalize_title(it["title"]),
                        "_epoch": it["epoch"],
                    }
            results = [r for r in await asyncio.gather(*[process(it) for it in entries]) if r]

            # 3) 同主題束ね（タイトル近似） → support_count を増加
            results.sort(key=lambda x: x["_norm_title"])
            for i in range(len(results)):
                for j in range(i+1, len(results)):
                    a, b = results[i], results[j]
                    if similar(a["title"], b["title"]):
                        a["support_count"] = max(a["support_count"], 2)
                        b["support_count"] = max(b["support_count"], 2)

            # 4) 新しい順（epoch 降順）に切り出し
            results.sort(key=lambda x: x.get("_epoch", 0.0), reverse=True)
            out[cat] = [{k:v for k,v in r.items() if not k.startswith("_")} for r in results[:40]]
    return out

def main():
    import argparse, asyncio
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", default="app/sources.yaml")
    ap.add_argument("--out", default="docs/data/latest.json")
    args = ap.parse_args()

    cfg = yaml.safe_load(Path(args.sources).read_text(encoding="utf-8"))
    tz = cfg.get("timezone","Asia/Tokyo")
    cats = cfg.get("categories",{})

    data = asyncio.run(ingest(cats))
    Path("docs/data").mkdir(parents=True, exist_ok=True)
    payload = {
        "version": "1",
        "generatedAt": now_iso_utc(),
        "timezone": tz,
        "categories": data
    }
    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.out}")

if __name__ == "__main__":
    main()
