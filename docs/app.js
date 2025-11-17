// docs/app.js — 設定対応版（itemsPerCategory / showSummary / defaultTab）
async function load() {
  // 設定の読み込み（localStorage）
  const KEY = "digestSettings";
  const defaults = { itemsPerCategory: 40, showSummary: true, defaultTab: "" };
  const settings = (() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  })();

  const tabsEl = document.getElementById("tabs");
  const listEl = document.getElementById("list");
  const metaEl = document.getElementById("meta");
  const footEl = document.getElementById("foot");

  // ローディング表示
  listEl.textContent = "読み込み中…";

  // 最新JSONをキャッシュ無効で取得
  const res = await fetch("./data/latest.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // 最終更新（JST固定）／フッター
  const gen = new Date(data.generatedAt);
  const genText = isNaN(gen)
    ? "不明"
    : gen.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
  metaEl.textContent = `最終更新: ${genText}`;
  footEl.textContent = `timezone: ${data.timezone} / version: ${data.version}`;

  const categories = data?.categories ?? {};
  const tabs = Object.keys(categories);

  // URLハッシュ or 設定(defaultTab) or 先頭 の順で初期タブを決定
  const fromHash = decodeURIComponent(location.hash.slice(1));
  const preferred = settings.defaultTab && tabs.includes(settings.defaultTab)
    ? settings.defaultTab
    : null;
  let active = tabs.includes(fromHash) ? fromHash : (preferred || tabs[0] || "");

  function renderTabs() {
    tabsEl.innerHTML = "";
    if (!tabs.length) return;

    const frag = document.createDocumentFragment();

    tabsEl.setAttribute("role", "tablist");
    for (const t of tabs) {
      const b = document.createElement("button");
      b.className = "tab" + (t === active ? " active" : "");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", t === active ? "true" : "false");
      b.textContent = t;
      b.onclick = () => {
        active = t;
        location.hash = `#${encodeURIComponent(t)}`; // ハッシュで状態保持
        renderTabs();
        renderList();
      };
      frag.appendChild(b);
    }
    tabsEl.appendChild(frag);
  }

  function fmtPub(published) {
    if (!published) return "";
    const d = new Date(published);
    if (isNaN(d)) return published; // 既に整形済ならそのまま
    return d.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function renderList() {
    listEl.innerHTML = "";
    const arr = categories?.[active] ?? [];

    if (!active) {
      listEl.textContent = "カテゴリがありません。sources.yaml を設定してください。";
      return;
    }
    if (arr.length === 0) {
      listEl.textContent = "該当する記事がありません。";
      return;
    }

    const max = Number(settings.itemsPerCategory ?? 40);
    const frag = document.createDocumentFragment();

    for (const it of arr.slice(0, max)) {
      const card = document.createElement("div");
      card.className = "card";

      // タイトル（安全にtextContentで）
      const titleDiv = document.createElement("div");
      titleDiv.className = "title";
      const a = document.createElement("a");
      a.href = it.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = it.title || "(無題)";
      titleDiv.appendChild(a);

      // メタ（発行元・公開時刻・一致件数）
      const meta = document.createElement("div");
      meta.className = "meta";
      const metaText = document.createTextNode(
        `${it.source ?? ""}${it.published ? "・" + fmtPub(it.published) : ""}`
      );
      meta.appendChild(metaText);
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = `一致${it.support_count ?? 1}件`;
      meta.appendChild(badge);

      // 要約（最長300文字）— 表示可否は設定で制御
      const summary = document.createElement("div");
      summary.textContent = (it.summary || "").slice(0, 300);

      card.appendChild(titleDiv);
      card.appendChild(meta);
      if (settings.showSummary) card.appendChild(summary);

      frag.appendChild(card);
    }

    listEl.appendChild(frag);
  }

  renderTabs();
  renderList();
}

// 起動
load().catch((err) => {
  const el = document.getElementById("list");
  if (el) el.textContent = "データの読み込みに失敗しました。時間をおいて再読み込みしてください。";
  console.error(err);
});
