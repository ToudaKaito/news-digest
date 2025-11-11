async function load() {
  const res = await fetch("./data/latest.json", { cache: "no-store" });
  const data = await res.json();
  const tabs = Object.keys(data.categories);
  const tabsEl = document.getElementById("tabs");
  const listEl = document.getElementById("list");
  const metaEl = document.getElementById("meta");
  const footEl = document.getElementById("foot");
  metaEl.textContent = `最終更新: ${new Date(data.generatedAt).toLocaleString("ja-JP")}`;
  footEl.textContent = `timezone: ${data.timezone} / version: ${data.version}`;

  let active = tabs[0] || "";

  function renderTabs() {
    tabsEl.innerHTML = "";
    for (const t of tabs) {
      const b = document.createElement("button");
      b.className = "tab" + (t === active ? " active" : "");
      b.textContent = t;
      b.onclick = () => { active = t; renderTabs(); renderList(); };
      tabsEl.appendChild(b);
    }
  }
  function renderList() {
    listEl.innerHTML = "";
    const arr = data.categories[active] || [];
    for (const it of arr) {
      const div = document.createElement("div");
      div.className = "card";
      const pub = it.published ? `・${it.published}` : "";
      div.innerHTML = `
        <div class="title"><a href="${it.url}" target="_blank" rel="noopener">${it.title}</a></div>
        <div class="meta">
          ${it.source}${pub}
          <span class="badge">一致${it.support_count}件</span>
        </div>
        <div>${(it.summary || "").slice(0, 300)}</div>
      `;
      listEl.appendChild(div);
    }
  }
  renderTabs(); renderList();
}
load().catch(err => {
  document.getElementById("list").textContent = "データの読み込みに失敗しました。";
  console.error(err);
});
