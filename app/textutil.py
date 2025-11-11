# -*- coding: utf-8 -*-
import re, unicodedata, hashlib
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

DROP_PARAMS = {"utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","ref","utm_id","igshid"}

def normalize_url(u: str) -> str:
    try:
        p = urlparse(u)
        q = [(k,v) for k,v in parse_qsl(p.query, keep_blank_values=True) if k not in DROP_PARAMS]
        p = p._replace(query=urlencode(q, doseq=True), fragment="")
        return urlunparse(p)
    except Exception:
        return u

_ws = re.compile(r"\s+")
_brackets = re.compile(r"[（(].*?[)）]")
_nonword = re.compile(r"[^\w\u3040-\u30ff\u4e00-\u9fff]+")

def normalize_title(t: str) -> str:
    if not t: return ""
    s = unicodedata.normalize("NFKC", t)
    s = _brackets.sub(" ", s)
    s = _ws.sub(" ", s).strip().lower()
    s = _nonword.sub(" ", s)
    s = _ws.sub(" ", s).strip()
    return s

def jaccard_sim(a: str, b: str) -> float:
    sa, sb = set(normalize_title(a).split()), set(normalize_title(b).split())
    if not sa or not sb: return 0.0
    inter = len(sa & sb)
    uni = len(sa | sb)
    return inter / max(1, uni)

def similar(a: str, b: str, threshold: float = 0.6) -> bool:
    return jaccard_sim(a, b) >= threshold

def stable_id(title: str, url: str) -> str:
    raw = (normalize_title(title) + "||" + normalize_url(url)).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:16]
