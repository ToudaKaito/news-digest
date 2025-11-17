// docs/settings.js
const KEY = "digestSettings";
const defaults = {
  itemsPerCategory: 40,
  showSummary: true,
  defaultTab: "" // 空なら先頭
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}
function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

async function init() {
  const s = loadSettings();

  // 入力初期値
  const items = document.getElementById("items");
  const summary = document.getElementById("summary");
  const defaultTab = document.getElementById("defaultTab");
  const msg = document.getElementById("msg");

  items.value = s.itemsPerCategory;
  summary.checked = !!s.showSummary;

  // 最新のカテゴリを読んでセレクトを作る
  try {
    const res = await fetch("./data/latest.json", { cache: "no-store" });
    const data = await res.json();
    const tabs = Object.keys(data?.categories ?? {});
    for (const t of tabs) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      defaultTab.appendChild(opt);
    }
    defaultTab.value = s.defaultTab || "";
  } catch {
    // 取得に失敗しても設定自体は保存できる
    defaultTab.value = s.defaultTab || "";
  }

  document.getElementById("saveBtn").onclick = () => {
    const n = Number(items.value);
    const safe = Number.isFinite(n) ? Math.max(5, Math.min(100, Math.round(n))) : defaults.itemsPerCategory;

    const next = {
      itemsPerCategory: safe,
      showSummary: !!summary.checked,
      defaultTab: defaultTab.value || ""
    };
    saveSettings(next);
    msg.textContent = "保存しました。トップに戻ると反映されます。";
    setTimeout(() => (window.location.href = "./index.html"), 600);
  };

  document.getElementById("resetBtn").onclick = () => {
    saveSettings(defaults);
    msg.textContent = "デフォルトに戻しました。トップに戻ると反映されます。";
    setTimeout(() => (window.location.href = "./index.html"), 600);
  };
}

init();
