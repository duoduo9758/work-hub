# work-hub

個人用ワークハブ。日数進捗トラッカー / Todo / 休暇管理 / タイマーを1つのアプリに集約。

## 開発環境

```bash
npm install
npm run dev
```

## ビルド・デプロイ

```bash
npm run build
```

GitHub Pages（`duoduo9758/work-hub`）にデプロイ。

## 環境変数

`.env.example` をコピーして `.env.local` を作成し、Firebase の設定値を記入。

## 技術スタック

- Vite + React 18
- Firebase Firestore（Spark無料プラン）
- CSS変数（モノクロ・ミニマル）
