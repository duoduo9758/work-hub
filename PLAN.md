# PLAN.md — work-hub 実装計画

> Step 4 の成果物。CHARTER / SPEC / DATA / WIREFRAME で確定したスコープを **実装手順** に落とし込む。
> 作成日：2026-05-27 / バージョン：**v0.1**

---

## 目次

1. [全体方針](#1-全体方針)
2. [v0: プロジェクト初期化](#2-v0-プロジェクト初期化)
3. [v1: 土台＋日数トラッカー](#3-v1-土台日数トラッカー)
4. [v2a: Todo 土台](#4-v2a-todo-土台)
5. [v2b: Todo チェックボックス](#5-v2b-todo-チェックボックス)
6. [v2c: Todo インデント](#6-v2c-todo-インデント)
7. [v2d: Todo スマホ対応](#7-v2d-todo-スマホ対応)
8. [v2e: Todo 保存堅牢化](#8-v2e-todo-保存堅牢化)
9. [v3: 休暇管理](#9-v3-休暇管理)
10. [v4: タイマー](#10-v4-タイマー)
11. [v5: UI 磨き込み・公開準備](#11-v5-ui-磨き込み公開準備)
12. [ファイル構成全体図](#12-ファイル構成全体図)
13. [リスクポイント](#13-リスクポイント)

---

## 1. 全体方針

### 1-1. 実装の基本ルール
- **1サブフェーズ = 1ブランチ = 1コミット**（Git）
- 各サブフェーズ完了時点で「動く状態」を維持
- 一機能完成ごとに **退避コミット**（後で戻れる地点）
- `feature/v1-tracker` / `feature/v2a-todo-base` 等のブランチ名

### 1-2. 各サブフェーズの構成（全段階共通）
```
1. ブランチ作成
2. 作業前宣言（変更してよいファイル / してはいけないファイル）
3. 実装
4. 動作確認（手動テスト）
5. サブエージェント差分レビュー（仕様外変更が混入していないか）
6. 修正があれば対応
7. コミット
8. （必要なら）ChatGPT スクショレビュー
```

### 1-3. モデル・工数推奨

| サブフェーズ | 推奨モデル / 工数 |
|---|---|
| v0 / v1 / v2a / v2b / v2c / v4 / v5 | Sonnet 4.6 / 中 |
| **v2d / v2e / v3** | **Opus 4.7 / 高**（複雑な実装） |
| バグ調査（3回直して直らない時） | **Opus 4.7 / max** |

### 1-4. 共通の禁止事項（実装時に守る）

- DATA.md 12章「禁止事項14項目」を必ず守る
- 絵文字を使わない（メモリ参照）
- ボタン文字を改行させない（white-space:nowrap + min-width）
- 機能修正とデザイン修正を同じコミットに混ぜない

---

## 2. v0: プロジェクト初期化

### 2-1. 目的
Vite + React + Firebase の最小骨組み。「Hello work-hub」が動く状態にする。

### 2-2. ブランチ
`feature/v0-init`

### 2-3. 触るファイル（新規作成）

```
work-hub/
├ index.html
├ package.json
├ vite.config.js
├ .gitignore
├ README.md
├ src/
│   ├ main.jsx
│   ├ App.jsx
│   └ styles/
│       ├ global.css
│       └ variables.css   ← モノクロCSS変数
```

### 2-4. 実装内容

- `npm create vite@latest work-hub --template react`
- React 18 / .jsx
- `vite.config.js` に `base: '/work-hub/'`（GitHub Pages 用）
- `.gitignore` に `node_modules/`, `dist/`, `.env*` 追加
- `src/styles/variables.css` に SPEC 9-6 のモノクロ CSS 変数定義
- `src/styles/global.css` に base スタイル（フォント、スクロールバー、`::selection`）
- `App.jsx` で「work-hub」見出しだけ表示

### 2-5. 完了条件

- [ ] `npm install` が成功
- [ ] `npm run dev` で localhost に表示される
- [ ] 「work-hub」見出しがブラウザに表示
- [ ] フォントが system-ui になっている
- [ ] CSS 変数が画面で機能している（背景白、文字黒）
- [ ] `npm run build` が成功

### 2-6. 手動テスト項目

| # | 操作 | 期待結果 |
|---|---|---|
| 1 | `npm run dev` | localhost:5173 が開く |
| 2 | 画面確認 | 「work-hub」と表示 |
| 3 | Chrome DevTools コンソール | エラー・警告ゼロ |
| 4 | `npm run build` | dist/ が生成、エラーなし |

### 2-7. リスク

- Vite 6.x の base パス指定で詰まる可能性 → `vite.config.js` を最初に検証

---

## 3. v1: 土台＋日数トラッカー

### 3-1. 目的
Firestore 接続 + アクセスコードログイン + トラッカー CRUD + ピン留めヘッダー。最初の公開可能バージョン。

### 3-2. ブランチ
`feature/v1-tracker`

### 3-3. 触るファイル

**新規作成：**

```
src/
├ lib/
│   ├ firebase.js          ← Firebase 初期化
│   ├ firestore.js         ← Firestore 基本ラッパー（fetch/save/error）
│   ├ uuid.js              ← UUID v4 + フォールバック
│   ├ storage.js           ← localStorage 安全ラッパー
│   ├ date.js              ← JST 日付ユーティリティ
│   ├ migration.js         ← ensureSchema()（空実装）
│   └ tracker-actions.js   ← トラッカー削除 transaction
├ features/
│   └ tracker/
│       ├ TrackerList.jsx           ← S1 画面
│       ├ TrackerCard.jsx           ← 各カード
│       ├ TrackerEditModal.jsx      ← 追加・編集
│       ├ TrackerDeleteConfirm.jsx  ← 削除確認
│       ├ tracker-store.js          ← Firestore ↔ state
│       └ tracker-calc.js           ← 進捗率計算
├ shared/
│   ├ components/
│   │   ├ Button.jsx               ← 3階層 variant
│   │   ├ Modal.jsx
│   │   ├ ConfirmDialog.jsx
│   │   ├ Spinner.jsx
│   │   └ ErrorMessage.jsx
│   ├ contexts/
│   │   ├ AuthContext.jsx          ← accessCode, isLoggedIn
│   │   └ MetaContext.jsx          ← pinnedTrackerId
│   └ hooks/
│       └ useLoadingState.js       ← loading/error/data の3パターン
├ screens/
│   ├ LoginScreen.jsx              ← S0
│   └ HeaderBar.jsx                ← H：ピン留めバー
└ App.jsx                          ← ルートレイアウト + ナビ
```

**編集：**
- `src/App.jsx`：ログイン状態でルーティング、左ナビ追加（v1 はトラッカータブのみ active）

### 3-4. 実装順序（v1 内）

1. **Firebase プロジェクト作成・初期化**（ユーザー作業：Firebase Console）
2. `lib/firebase.js`：Firebase SDK 初期化、env から API キー読み込み
3. `lib/uuid.js`, `lib/storage.js`, `lib/date.js`：依存ゼロのユーティリティ
4. `lib/migration.js`：`ensureSchema()` 空実装
5. `lib/firestore.js`：getDoc/setDoc/runTransaction ラッパー、エラーハンドリング
6. `shared/components/`：Button / Modal / Spinner / ErrorMessage（モックアップ HTML を参考に CSS 移植）
7. `shared/contexts/AuthContext.jsx`：ログイン・ログアウト関数
8. `screens/LoginScreen.jsx`：S0、アクセスコード入力 + 8〜64文字バリデーション
9. `App.jsx`：認証状態によるルーティング
10. `features/tracker/`：CRUD + 進捗計算
11. `screens/HeaderBar.jsx`：ピン留めバー（PC / スマホ両対応）
12. `lib/tracker-actions.js`：削除 transaction（ピン解除込み）
13. Firestore セキュリティルールをコンソールで設定（最初は v9-1 のテストモードでも可、v5 で本番モードに）

### 3-5. 完了条件

- [ ] アクセスコード（8〜64文字）でログインできる
- [ ] 7文字以下入力でエラー表示
- [ ] 初回ログイン時、Firestore に meta/singleton が作成される
- [ ] トラッカーを追加・編集・削除できる
- [ ] 進捗率・経過日数・残日数が正しく計算される（JST 基準）
- [ ] 終了日翌日に「終了」表示
- [ ] 1件をピン留めしてヘッダーバーに表示
- [ ] ピン留め変更で表示切替
- [ ] ピン留め中トラッカー削除で transaction が動作（ピン解除 + 削除）
- [ ] PC 1280px / スマホ 375px で破綻なく表示
- [ ] 別端末で追加 → 自端末で再読み込み → 反映される
- [ ] コンソールに error / warn が出ない
- [ ] `npm run build` 成功
- [ ] GitHub Pages にデプロイ済み、URL でアクセスできる

### 3-6. 手動テスト項目（抜粋）

| カテゴリ | テスト項目 |
|---|---|
| 認証 | AC-AUTH-01〜14 を順番に確認 |
| トラッカー基本 | AC-TRK-01〜23 を順番に確認 |
| トラッカー削除 | AC-TRK-28, 29, 30（ピン留め中削除、batch 失敗） |
| ヘッダー | AC-TRK-27（ピン有→無時のレイアウトジャンプ） |
| 共通 | AC-COMMON-01〜05、AC-DATA-01〜03 |

### 3-7. リスクポイント

- Firebase の env 設定で API キーをコミットしないように
- vite.config.js の base 設定（GitHub Pages 用）
- localStorage 不可ブラウザでの動作確認（プライベートモード）
- transaction で書き込み権限エラー時のメッセージ
- JST 日付計算が確実に Asia/Tokyo 固定で動くか（端末タイムゾーン非日本でテスト）

### 3-8. サブエージェント差分レビュー

実装完了時に「差分レビュー担当」を起動：
- 仕様外の機能追加がないか
- shared/ 配下の不用意な変更がないか
- DATA.md 禁止事項14項目を守っているか

---

## 4. v2a: Todo 土台

### 4-1. 目的
プロジェクト CRUD + 行追加・編集・削除（チェックなし、インデントなし、期限なし）+ デバウンス保存 + 競合検知の **最小実装**。

### 4-2. ブランチ
`feature/v2a-todo-base`

### 4-3. 推奨工数：**Opus 4.7 / 高**

行コンポーネント方式の実装は v1 の CRUD より複雑度が高い。

### 4-4. 触るファイル

**新規作成：**

```
src/
├ hooks/
│   ├ useDebounceSave.js        ← 6状態遷移実装
│   └ useFirestoreTransaction.js ← 汎用 transaction ラッパー
├ features/
│   └ todo/
│       ├ TodoScreen.jsx              ← S2 メイン
│       ├ ProjectSidebar.jsx          ← PC 左サイドバー
│       ├ ProjectAddModal.jsx
│       ├ ProjectEditModal.jsx
│       ├ ProjectDeleteConfirm.jsx
│       ├ TodoEditor.jsx              ← エディタ本体
│       ├ TodoRow.jsx                 ← 1行コンポーネント
│       ├ SaveStatusBadge.jsx         ← 保存状態表示
│       ├ ConflictWarning.jsx         ← 競合警告モーダル
│       ├ todo-store.js               ← Firestore ↔ state
│       └ todo-actions.js             ← 行操作（追加/分割/結合/削除）
```

**編集：**
- `src/App.jsx`：Todo タブを active 化
- 左ナビに Todo タブ追加（v1 で既に表示はしている、active 切替を有効化）

### 4-5. 実装順序（v2a 内）

1. `hooks/useDebounceSave.js`：状態遷移表通りに実装（テスト用フックを別途）
2. `hooks/useFirestoreTransaction.js`：DATA.md 8b-5 通り
3. `features/todo/todo-store.js`：プロジェクト CRUD（Firestore）
4. `features/todo/ProjectSidebar.jsx` + `ProjectAdd/Edit/DeleteConfirm.jsx`
5. `features/todo/TodoRow.jsx`：textarea ベース、自動リサイズ（最大6行）、Enter / Backspace / IME 抑制
6. `features/todo/TodoEditor.jsx`：行配列の管理、行追加・編集・削除のロジック
7. `features/todo/SaveStatusBadge.jsx`：useDebounceSave の status を表示
8. `features/todo/ConflictWarning.jsx`：競合検知時のモーダル
9. `features/todo/TodoScreen.jsx`：上記を組み合わせる

### 4-6. 完了条件

- [ ] プロジェクトを 1〜100 件まで追加・編集・削除できる
- [ ] 行の追加・編集・削除ができる（textarea ベース、最大6行高）
- [ ] Enter で行分割（カーソル位置で2行に）
- [ ] 行頭 Backspace で上行と結合
- [ ] IME 変換中の Enter / Tab は新規行追加・インデント変更を発火しない
- [ ] 500文字超過行の入力・ペーストは弾く
- [ ] 複数行ペーストで自動分割
- [ ] 1.5秒デバウンス保存が動作
- [ ] visibilitychange / pagehide で強制保存
- [ ] 「未保存」「保存中」「保存済み」「失敗」「競合」を画面表示
- [ ] 競合検知で警告モーダル、「再読み込み」で復元
- [ ] 900KB 超過保存はエラー表示
- [ ] v1 機能（トラッカー）を壊していない

### 4-7. 手動テスト項目（抜粋）

| カテゴリ | テスト項目 |
|---|---|
| プロジェクト | AC-TODO-P01〜P12 |
| 行編集 | AC-TODO-L01〜L28 |
| 保存状態 | AC-TODO-S01〜S09 |
| 競合検知 | AC-TODO-C01〜C09 |
| 容量 | AC-TODO-L28（900KB 超過） |

### 4-8. リスクポイント

- **textarea の自動リサイズ実装**：内容に応じて高さ拡張は `scrollHeight` を使うが、再レンダリングで暴れやすい → useRef + useEffect で慎重に
- **IME 抑制**：`compositionstart` / `compositionend` を正しく扱う、`isComposing` をチェック
- **行 ID 管理**：Enter 分割時の id 割り当てを間違えると React key 衝突
- **useDebounceSave の状態機械**：6状態 × イベントの遷移を漏れなく実装
- **conflict 中の自動保存抑制**：visibilitychange を見逃すと事故

### 4-9. サブエージェント

実装完了時に差分レビュー必須（特に shared/ への影響、仕様外機能追加の検知）。

---

## 5. v2b: Todo チェックボックス

### 5-1. 目的
チェックボックスの ON/OFF トグル + チェック済みの取り消し線表示 + Ctrl+1 でチェックボックス挿入・削除 + 500ms 以内保存。

### 5-2. ブランチ
`feature/v2b-todo-checkbox`

### 5-3. 触るファイル（編集のみ）

- `features/todo/TodoRow.jsx`：チェックボックス UI + クリックトグル + Ctrl+1 キーバインド
- `features/todo/TodoEditor.jsx`：チェックボックス操作のハンドラ
- `features/todo/todo-actions.js`：hasCheckbox / checked のトグル関数
- 共通 CSS：チェック済み行の取り消し線 + 薄色

### 5-4. 完了条件

- [ ] 行をクリックして編集モード、チェックボックスのクリックでトグル
- [ ] チェック済み行は取り消し線 + 薄色表示
- [ ] Ctrl+1 で hasCheckbox トグル
- [ ] チェックボックス操作は **500ms 以内に保存**（デバウンス短縮）
- [ ] Backspace で行結合時、上行の hasCheckbox / checked が保持される
- [ ] v1 / v2a を壊していない

### 5-5. リスクポイント

- 500ms 保存と 1.5秒デバウンス保存が同時にトリガーされるケース：useDebounceSave で「最後の更新内容を1回保存」になるよう実装

---

## 6. v2c: Todo インデント

### 6-1. 目的
PC で Tab / Shift+Tab で行のインデントレベル変更（最大 5）。データ的な親子関係は持たない。

### 6-2. ブランチ
`feature/v2c-todo-indent`

### 6-3. 触るファイル（編集のみ）

- `features/todo/TodoRow.jsx`：Tab / Shift+Tab キーバインド（IME 抑制と整合）
- 共通 CSS：インデントレベル別の padding-left

### 6-4. 完了条件

- [ ] Tab でインデント +1（最大5）
- [ ] Shift+Tab でインデント -1（最小0）
- [ ] インデントは見た目だけ反映、データ的親子関係なし
- [ ] スマホでは Tab / Shift+Tab が使えない（ボタン未配置でOK、PC限定）
- [ ] v1 / v2a / v2b を壊していない

### 6-5. リスクポイント

- ブラウザの Tab フォーカス移動と競合 → `preventDefault()` で確実に止める
- IME 変換中の Tab を抑制（`isComposing` チェック）

---

## 7. v2d: Todo スマホ対応

### 7-1. 目的
スマホで Todo を **閲覧 + チェック ON/OFF + 行追加 + テキスト編集** ができる UI 整備。インデント・行削除は PC 限定で OK。

### 7-2. ブランチ
`feature/v2d-todo-mobile`

### 7-3. 推奨工数：**Opus 4.7 / 高**

ヘッダー縮小・ソフトキーボード・タブナビとの干渉が地雷多い。

### 7-4. 触るファイル（編集のみ）

- `features/todo/TodoEditor.jsx`：スマホ用レイアウト、textarea フォーカス検知
- `features/todo/TodoRow.jsx`：スマホ用「+チェック」ボタン表示
- `screens/HeaderBar.jsx`：Todo フォーカス中の縮小モード
- `App.jsx`：ボトムナビ実装（スマホのみ）
- `features/todo/ProjectSidebar.jsx`：スマホではドロップダウンメニューに切替

### 7-5. 完了条件

- [ ] スマホ 375px で Todo 全機能が破綻なく動く
- [ ] 行をタップして編集できる
- [ ] チェックボックスをタップでトグル
- [ ] 「+ 新規行」ボタンで行追加
- [ ] textarea フォーカス中、ヘッダー進捗バーが縮小表示（プロジェクト名 + バーのみ）
- [ ] インデント変更・行削除ボタンは表示されない
- [ ] ソフトキーボード表示中も操作可能
- [ ] PC 機能（v2c）を壊していない

### 7-6. リスクポイント

- iOS Safari のソフトキーボード表示時の `viewport` 変化
- ヘッダー縮小のトランジションが本文をジャンプさせない
- スマホでの textarea カーソル位置安定性

---

## 8. v2e: Todo 保存堅牢化

### 8-1. 目的
保存失敗・再試行・競合警告・プロジェクト切替時の強制保存・ログアウト時の警告 UI を仕上げる。

### 8-2. ブランチ
`feature/v2e-todo-robustness`

### 8-3. 推奨工数：**Opus 4.7 / 高**

エラーハンドリングとエッジケース対応が多い。

### 8-4. 触るファイル（編集のみ）

- `hooks/useDebounceSave.js`：失敗時再試行・タイムアウト「slow」表示・transaction 失敗時の再 fetch
- `features/todo/ConflictWarning.jsx`：競合詳細メッセージ
- `features/todo/SaveStatusBadge.jsx`：「保存に時間がかかっています」表示
- `shared/contexts/AuthContext.jsx`：ログアウト時の未保存警告
- `App.jsx`：別タブ移動時の保存試行（タブ切替フック）

### 8-5. 完了条件

- [ ] 保存失敗時に「保存失敗 / 再試行」ボタン表示
- [ ] 再試行で同内容を再保存
- [ ] 10秒経過で「保存に時間がかかっています」表示（"failed" にしない）
- [ ] transaction 失敗時、再 fetch で「実は成功」を検知
- [ ] 競合警告で「他端末で更新されています / 再読み込み」モーダル
- [ ] プロジェクト切替時、未保存があれば強制保存
- [ ] 別タブ（休暇・タイマー等）切替時、未保存があれば強制保存
- [ ] ログアウト時、未保存があれば「未保存変更があります、破棄/保存/キャンセル」確認
- [ ] AC-TODO-S06〜S09, AC-TODO-C03〜C09 すべて確認
- [ ] v1〜v2d を壊していない

### 8-6. リスクポイント

- conflict 中の visibilitychange を本当に抑制できているか
- transaction の Promise が解決する前に「失敗扱い」しないか
- ログアウト確認ダイアログの「保存して」が失敗した時の挙動

---

## 9. v3: 休暇管理

### 9-1. 目的
有給・傷病休暇の use / adjustment 2種レコード管理 + 残量計算 + マイナス検知 + 2タブ履歴 + 年度フィルタ（9/1〜翌8/31）+ **丸1日有給5日必須警告**。

**use レコードは「X日 Y時間」2フィールド入力**（長期休暇を1レコードで対応）。

### 9-2. ブランチ
`feature/v3-leave`

### 9-3. 推奨工数：**Opus 4.7 / 高**

transaction 内クエリ + 残量再計算 + マイナス検知が複雑。

### 9-4. 触るファイル

**新規作成：**

```
src/
├ features/
│   └ leave/
│       ├ LeaveScreen.jsx              ← S3 メイン
│       ├ LeaveSummary.jsx             ← 残量サマリ
│       ├ LeaveActions.jsx             ← + 取得 / + 調整 ボタン
│       ├ LeaveHistoryTabs.jsx         ← 利用 / 調整 タブ + 年度フィルタ
│       ├ LeaveRecordRow.jsx           ← 1レコード行
│       ├ LeaveUseModal.jsx            ← 取得追加・編集
│       ├ LeaveAdjustModal.jsx         ← 調整追加・編集
│       ├ LeaveErrorDialog.jsx         ← 残量超過等のエラー
│       ├ LeaveDeleteConfirm.jsx
│       ├ leave-store.js
│       ├ leave-calc.js                ← 残量・年度判定
│       └ leave-actions.js             ← transaction 内クエリで保存
```

**編集：**
- `src/App.jsx`：休暇タブを active 化

### 9-5. 実装順序（v3 内）

1. `features/leave/leave-calc.js`：残量計算ロジック（純粋関数、テスト容易）+ **丸1日カウント関数** + **有給年度判定**
2. `features/leave/leave-store.js`：Firestore CRUD（一覧取得）
3. `features/leave/leave-actions.js`：use / adjustment 保存（transaction 内で全件 query）
4. `features/leave/LeaveSummary.jsx`：残量表示 + **5日警告表示（条件付き）**
5. `features/leave/LeaveHistoryTabs.jsx`：2タブ + 年度フィルタ（9/1〜翌8/31）
6. `features/leave/LeaveRecordRow.jsx`：1レコード表示（use は「X日Y時間」表示）+ 編集・削除
7. `features/leave/LeaveUseModal.jsx`：取得追加・編集（**X日 Y時間 の2フィールド入力**）
8. `features/leave/LeaveAdjustModal.jsx`：調整追加・編集（hours 1フィールド）
9. `features/leave/LeaveErrorDialog.jsx`：マイナス検知 / 大調整確認
10. `features/leave/LeaveScreen.jsx`：全体組み立て

### 9-6. 完了条件

- [ ] 有給・傷病それぞれ初期残量を **+ 調整（note=年度付与）** で設定できる
- [ ] use を「X日 Y時間」入力で追加できる（例：3日4時間 = 28h）
- [ ] use 追加で残量が減る、編集・削除で再計算される
- [ ] 残量を超える use はエラー
- [ ] adjustment 追加・編集・削除で残量変動、マイナス禁止
- [ ] 同日同種重複 use 可能（警告なし、note プレースホルダ）
- [ ] 利用履歴タブ・調整履歴タブが分離表示
- [ ] **年度フィルタ（現在年度 9/1〜翌8/31 / 過去年度 / すべて）動作**
- [ ] 残量サマリは常に全期間累計
- [ ] 1日=8h 換算表示（残124h → 「15日4時間」）
- [ ] use 入力検証：X≥0, Y∈0〜7, 合計>0, 残量内
- [ ] adjustment -9999〜+9999h の範囲外はエラー
- [ ] 絶対値 80h 以上の adjustment は確認ダイアログ
- [ ] 現在年度に adjustment ゼロのとき警告表示
- [ ] **丸1日有給5日未満で警告表示、5日以上で警告完全消滅**（有給のみ対象）
- [ ] v1〜v2 を壊していない

### 9-7. 手動テスト項目

| カテゴリ | テスト項目 |
|---|---|
| 基本 | AC-LEAVE-01〜23 |
| タブ・フィルタ | AC-LEAVE-T01〜T08 |
| 整合性 | AC-LEAVE-26〜32 |

### 9-8. リスクポイント

- **transaction 内クエリ**：Firestore JS SDK で `tx.get(query)` の使い方を間違えやすい
- 残量再計算で all leaveRecords を取得するコスト（普段は問題ない、想定数百件）
- adjustment 削除で残量がマイナスになるケースのメッセージ

---

## 10. v4: タイマー

### 10-1. 目的
カウントアップ / カウントダウン 2モード + Web Audio 通知音 + ローカル完結（Firestore 書き込みなし）。

### 10-2. ブランチ
`feature/v4-timer`

### 10-3. 触るファイル

**新規作成：**

```
src/
├ lib/
│   └ audio.js                  ← AudioContext lazy 初期化、ビープ音
├ features/
│   └ timer/
│       ├ TimerScreen.jsx       ← S4 メイン
│       ├ TimerDisplay.jsx      ← 大時刻表示
│       ├ TimerControls.jsx     ← Start/Stop/Reset 文脈切替
│       ├ TimerModeToggle.jsx   ← アップ/ダウン切替
│       ├ TimerCountdownInput.jsx ← MM:SS 入力
│       ├ TimerSoundToggle.jsx  ← 音 ON/OFF
│       └ timer-state.js        ← Date.now() 差分計算ロジック
```

**編集：**
- `src/App.jsx`：タイマータブを active 化

### 10-4. 実装順序（v4 内）

1. `lib/audio.js`：initAudioContext / playFinishSound
2. `features/timer/timer-state.js`：Date.now() 差分計算、localStorage 連携
3. `features/timer/TimerModeToggle.jsx`：モード切替
4. `features/timer/TimerCountdownInput.jsx`：MM:SS 入力（1:00〜99:59）
5. `features/timer/TimerDisplay.jsx`：1秒ごと表示更新
6. `features/timer/TimerControls.jsx`：Start/Stop/Reset、文脈で濃淡切替
7. `features/timer/TimerSoundToggle.jsx`：localStorage 連携
8. `features/timer/TimerScreen.jsx`：全体組み立て + 再訪時復帰

### 10-5. 完了条件

- [ ] カウントアップ：0:00:00 から無限カウント
- [ ] カウントダウン：MM:SS で設定、0:00 到達で自動停止
- [ ] Date.now() 差分計算（バックグラウンドからのズレなし）
- [ ] Start/Stop/Reset の濃淡が文脈で切り替わる
- [ ] カウントダウン到達で赤系表示 + 「時間です」+ タブタイトル変更 + 短い通知音
- [ ] 音 ON/OFF トグルが効く（デフォルト ON、localStorage 保存）
- [ ] AudioContext は Start クリック時に lazy 初期化
- [ ] タブ閉じ→再訪で「停止状態として復帰」ダイアログ
- [ ] カウントダウン実行中の設定時間変更で即時再計算
- [ ] Firestore に書き込みが発生しないこと（DevTools Network で確認）
- [ ] v1〜v3 を壊していない

### 10-6. リスクポイント

- **iOS Safari の AudioContext**：ユーザー操作内で resume() しないと無音
- **タブをバックグラウンドにした時の setInterval 抑制**：Date.now() 差分計算で吸収
- **システム時計変更**：max(0, elapsed) でクランプ

---

## 11. v5: UI 磨き込み・公開準備

### 11-1. 目的
`frontend-design` スキルで UI を磨き込む + Firestore セキュリティルール本番化 + GitHub Pages 公開。

### 11-2. ブランチ
`design/main-pass` + `release/v1.0.0`

### 11-3. 触るファイル

- 全 .jsx / CSS ファイル（装飾のみ、機能ロジックは触らない）
- `shared/components/`：細部の質感調整
- Firestore セキュリティルール（コンソール上、DATA.md 9-2 通り）

### 11-4. 実装順序（v5 内）

1. **デザイン磨き込みフェーズ（`design/main-pass` ブランチ）**
   - `frontend-design` スキルで全画面の磨き込み（モノクロ・ミニマル維持）
   - 細部の余白・タイポグラフィ・アニメーション
   - 機能には一切触らない
2. **公開前チェック（`release/v1.0.0` ブランチ）**
   - Firestore セキュリティルールを本番モード（DATA.md 9-2）に切替
   - SPEC 9-2 注意書き等の最終確認
   - `npm run build` でビルド確認
   - README に最低限の説明
3. **GitHub Pages デプロイ**
   - `vite.config.js` の `base` 確認
   - GitHub Actions or 手動デプロイ
4. **本番動作確認**
   - 公開 URL でログイン・全機能動作確認
   - スマホ実機でも確認
5. **タグ作成**
   - `v1.0.0` タグを切る

### 11-5. 完了条件

- [ ] frontend-design 適用後、「毎朝開きたくなる」UI 品質
- [ ] Firestore セキュリティルールが本番モード
- [ ] README に最低限の説明あり
- [ ] GitHub Pages で公開済み、URL で動作
- [ ] スマホ実機で全機能確認
- [ ] コンソールに error / warn が出ない
- [ ] `v1.0.0` タグが切られている

### 11-6. ChatGPT UI レビュー

`frontend-design` 適用後、ChatGPT に PC / スマホスクショを渡して使いにくさを指摘してもらう（最大2ラウンド、CHARTER 修正回数の上限通り）。

---

## 12. ファイル構成全体図（v5 完成時点）

```
work-hub/
├ CHARTER.md / SPEC.md / WIREFRAME.md / DATA.md / PLAN.md / BACKLOG.md / TEMPLATES.md（参照のみ、実装には含まない）
├ index.html
├ package.json
├ vite.config.js
├ .gitignore
├ README.md
├ mockup/index.html         ← 開発時の参照用、本番デプロイ対象外
├ public/                    ← 静的アセット（必要なら）
└ src/
    ├ main.jsx
    ├ App.jsx
    ├ styles/
    │   ├ global.css
    │   └ variables.css
    ├ lib/
    │   ├ firebase.js
    │   ├ firestore.js
    │   ├ uuid.js
    │   ├ storage.js
    │   ├ date.js
    │   ├ migration.js
    │   ├ audio.js
    │   └ tracker-actions.js
    ├ hooks/
    │   ├ useDebounceSave.js
    │   ├ useFirestoreTransaction.js
    │   └ useLoadingState.js
    ├ shared/
    │   ├ components/
    │   │   ├ Button.jsx
    │   │   ├ Modal.jsx
    │   │   ├ ConfirmDialog.jsx
    │   │   ├ Spinner.jsx
    │   │   └ ErrorMessage.jsx
    │   └ contexts/
    │       ├ AuthContext.jsx
    │       └ MetaContext.jsx
    ├ screens/
    │   ├ LoginScreen.jsx
    │   └ HeaderBar.jsx
    └ features/
        ├ tracker/
        │   ├ TrackerList.jsx
        │   ├ TrackerCard.jsx
        │   ├ TrackerEditModal.jsx
        │   ├ TrackerDeleteConfirm.jsx
        │   ├ tracker-store.js
        │   └ tracker-calc.js
        ├ todo/
        │   ├ TodoScreen.jsx
        │   ├ ProjectSidebar.jsx
        │   ├ ProjectAddModal.jsx
        │   ├ ProjectEditModal.jsx
        │   ├ ProjectDeleteConfirm.jsx
        │   ├ TodoEditor.jsx
        │   ├ TodoRow.jsx
        │   ├ SaveStatusBadge.jsx
        │   ├ ConflictWarning.jsx
        │   ├ todo-store.js
        │   └ todo-actions.js
        ├ leave/
        │   ├ LeaveScreen.jsx
        │   ├ LeaveSummary.jsx
        │   ├ LeaveActions.jsx
        │   ├ LeaveHistoryTabs.jsx
        │   ├ LeaveRecordRow.jsx
        │   ├ LeaveUseModal.jsx
        │   ├ LeaveAdjustModal.jsx
        │   ├ LeaveErrorDialog.jsx
        │   ├ LeaveDeleteConfirm.jsx
        │   ├ leave-store.js
        │   ├ leave-calc.js
        │   └ leave-actions.js
        └ timer/
            ├ TimerScreen.jsx
            ├ TimerDisplay.jsx
            ├ TimerControls.jsx
            ├ TimerModeToggle.jsx
            ├ TimerCountdownInput.jsx
            ├ TimerSoundToggle.jsx
            └ timer-state.js
```

合計ファイル数：約60ファイル（テスト用ファイル除く）

---

## 13. リスクポイント

### 13-1. 段階リリースの落とし穴

| リスク | 対策 |
|---|---|
| v2a が大きすぎて完成しない | 詰まったら v2a の中をさらに分割（行追加→編集→削除→デバウンス保存の順） |
| v3 の transaction 内クエリが初心者に難しい | バグ調査エージェント（max 工数）で原因特定 |
| v4 タイマーで AudioContext が iOS Safari で鳴らない | 実機で必ず動作確認 |
| v5 デザイン適用で機能を壊す | デザインブランチを分離、機能修正と混ぜない |

### 13-2. データ整合性

| リスク | 対策 |
|---|---|
| transaction 失敗時に状態がズレる | 再 fetch で「実は成功」を検知 |
| マイナス検知の漏れ | leave-calc.js を純粋関数化して単体で検証可能に |
| 行 ID 衝突 | UUID v4 + Firestore で保証 |
| schemaVersion 不整合 | ensureSchema() を毎回起動時に通す |

### 13-3. UI 品質

| リスク | 対策 |
|---|---|
| モノクロが地味すぎる | v5 で frontend-design + ChatGPT UI レビュー |
| ボタン文字の改行 | white-space:nowrap + min-width を共通 Button で強制 |
| スマホでヘッダーが本文を圧迫 | 縮小モードを v2d で実装 |

### 13-4. 修正回数の上限

CHARTER 通り：

- 1機能の修正：3回まで
- デザイン修正ラウンド：2回まで
- バグ修正：3回まで

**上限を超えたら**：その場で粘らず、前のステップ（設計や仕様）に戻る。

---

## 14. 承認チェック

- [ ] 実装順序 v0 → v1 → v2a → v2b → v2c → v2d → v2e → v3 → v4 → v5 に同意
- [ ] 各サブフェーズで commit + 動作確認 + サブエージェント差分レビュー
- [ ] ファイル構成（features / shared / lib / hooks / screens）に同意
- [ ] 共通ライブラリの段階分け（v1 / v2a / v4）に同意
- [ ] モデル・工数の推奨（Sonnet中 デフォルト、v2d/v2e/v3 は Opus高）に同意
- [ ] リスクポイントと対策に同意
- [ ] 修正回数の上限（3回ルール）を守る

承認後、Step 5（v0 プロジェクト初期化）から実装に入る。

---

## 15. 次にすること

Step 4 PLAN.md 承認後：
1. **新しいチャットウィンドウ** を開く（コンテキスト軽量化）
2. 「CLAUDE.md / SPEC.md / DATA.md / PLAN.md を読んで v0 から実装を始めて」と指示
3. Sonnet 4.6 / 中 で実装開始
4. このチャットは「設計まで完了」の記録として保持
