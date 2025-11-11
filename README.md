# News Digest (P0, docs 版)
先輩はURLを見るだけ。GitHub Pages（/docs）+ GitHub Actionsで、カテゴリ別RSSの「最新リンク＋要約＋一致N件」を毎朝自動更新します。

## 公開手順（GitHub Pages）
1) リポジトリを作成し、本プロジェクト一式をアップロード
2) Settings → Pages
   - Source: Deploy from a branch
   - Branch: main
   - Folder: **/docs**
3) Settings → Actions → General → Workflow permissions → **Read and write permissions**
4) Actions → **Publish digest** → Run workflow（初回のみ手動）
5) 公開URL（`https://<ユーザー名>.github.io/<repo>/`）を先輩へ共有

## 編集ポイント
- `app/sources.yaml` … カテゴリ別のRSS一覧（日本語中心で開始）
- `docs/data/` … 生成される `latest.json` の置き場所（Actionsが自動更新）

## 構成
```
app/                # 収集→抽出→要約→JSON生成（Python）
  ingest.py
  textutil.py
  sources.yaml
  requirements.txt
docs/               # 公開（Pages配下）
  index.html
  app.js
  style.css
  data/.gitkeep
.github/workflows/publish.yml  # 毎朝ジョブ（07:00 JST）
```

## ローカル動作（任意）
```bash
python -m venv .venv && . .venv/bin/activate  # Windowsは .venv\Scripts\activate
pip install -r app/requirements.txt
python app/ingest.py --sources app/sources.yaml --out docs/data/latest.json
# docs/index.html をブラウザで開いて確認
```

## 方針
- P0/P1 は LLMや翻訳APIなし（0円運用）
- RSS中心・抽出型要約・同主題一致数（support_count）表示
