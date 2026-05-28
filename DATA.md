# DATA.md — work-hub データ・状態設計

> Step 3 の成果物。初心者がAI任せで実装する前提で、**データ整合性が崩れない設計** を確定する。
> 作成日：2026-05-28 / バージョン：**v0.6**（ChatGPT休暇レビュー反映：Security Rules強化（use合計>0/adjustment hours!=0/note/date/id検証/days上限）、adjustment UI 3フィールド記述統一、Todo行id承認チェック修正）

---

## 目次

1. [設計原則](#1-設計原則)
2. [Firestore データ構造](#2-firestore-データ構造)
3. [ID 生成方式](#3-id-生成方式)
4. [削除方式・編集影響](#4-削除方式編集影響)
5. [並び順の保存](#5-並び順の保存)
6. [localStorage 設計](#6-localstorage-設計)
7. [React 状態管理](#7-react-状態管理)
8. [画面間データ共有](#8-画面間データ共有)
9. [Firestore セキュリティルール](#9-firestore-セキュリティルール)
10. [課金・容量見積もり](#10-課金容量見積もり)
11. [マイグレーション方針](#11-マイグレーション方針)
12. [禁止事項（壊れやすい設計パターン）](#12-禁止事項壊れやすい設計パターン)

---

## 1. 設計原則

### 1-1. シングルソース原則
- **業務データは Firestore が唯一の正**（Single Source of Truth）
- localStorage には業務データを書かない（UI設定とアクセスコードのみ）
- 計算可能な値はデータとして保存しない（残量・進捗率など、原始データから都度計算）

### 1-2. 再計算可能性
- 残量、進捗率、累計時間、% などすべて **その場で計算**
- 派生データ（derived data）を Firestore に書き込まない（整合性崩壊の原因）

### 1-3. クライアント主導の競合検知
- すべての書き込み可能なドキュメントに `version`, `updatedAt`, `updatedByClientId` を持たせる
- 保存時は Firestore transaction で `version` をチェック → `FieldValue.increment(1)` で更新

### 1-4. 削除は **物理削除**（論理削除フラグは持たない）
- `deleted: true` フラグ方式は使わない（カウント・集計が複雑になる）
- 削除確認ダイアログで防ぐ + 関連データの一括削除を transaction or batch で保証

### 1-5. ユーザーごとの完全分離
- すべてのデータは `users/{accessCode}/` 以下のサブコレクション
- アクセスコードが違えば物理的にデータパスが別

---

## 2. Firestore データ構造

### 2-1. パス構造

```
users/{accessCode}/
  ├ meta/                       ← ユーザーメタ情報
  │   └ singleton               ← 単一ドキュメント
  ├ trackers/                   ← 日数進捗トラッカー
  │   └ {trackerId}             ← 各トラッカー
  ├ todoProjects/               ← Todoプロジェクト
  │   └ {projectId}             ← 各プロジェクト（行配列を含む）
  └ leaveRecords/               ← 休暇レコード
      └ {recordId}              ← use または adjustment レコード
```

**ポイント：**
- ユーザーごとに完全分離（同じパス構造をユーザーごとに持つ）
- `tracker` `todoProject` `leaveRecord` はそれぞれ独立コレクション
- `meta` は singleton（1ドキュメント固定）でユーザー全体の設定を持つ

### 2-2. エンティティ詳細

#### users/{accessCode}/meta/singleton

ユーザー全体のメタ情報。1ドキュメント固定（`docId = "singleton"`）。

```typescript
{
  createdAt: Timestamp,           // 初回アクセスコード使用日時
  lastLoginAt: Timestamp,         // 最終ログイン日時
  pinnedTrackerId: string | null, // ヘッダー固定中のトラッカーID
  schemaVersion: number,          // データスキーマバージョン（マイグレーション用、初期=1）
}
```

#### users/{accessCode}/trackers/{trackerId}

日数進捗トラッカー（最大10件）。

```typescript
{
  id: string,           // = trackerId（クライアント生成 UUID、後述）
  title: string,        // 1〜30文字
  startDate: string,    // "YYYY-MM-DD"（JST カレンダー日）
  endDate: string,      // "YYYY-MM-DD"
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

**注意：** ピン留め状態はこのドキュメントには持たない（meta.pinnedTrackerId で一元管理）。

#### users/{accessCode}/todoProjects/{projectId}

Todo プロジェクト（最大100件）。1プロジェクト = 1ドキュメント、行配列を含む。

```typescript
{
  id: string,                    // = projectId
  name: string,                  // プロジェクト名 1〜30文字
  lines: [
    {
      id: string,                // UUID v4、Firestore に保存（v0.3 で再採用、React key 安定化のため）
      text: string,              // 0〜500文字（v0.3 改訂、極端なペースト防止）
      hasCheckbox: boolean,      // チェックボックス表示有無
      checked: boolean,          // チェック状態
      indent: number,            // インデントレベル 0〜5
    }
    // ... 最大1000行
    // 1プロジェクト全体のサイズが 900KB を超えたら保存不可（1MB 上限到達前に警告）
  ],
  version: number,               // 競合検知用、初期=1、保存時 +1
  updatedByClientId: string,     // 最終更新クライアント（UUID）
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

**注意：**
- プロジェクトの並び順はクライアント側で `createdAt` 降順で取得。明示的な並び替えはしない
- **行内 id は Firestore に保存する（v0.3 で再採用）**：React key 安定化・フォーカス保持・行分割/結合時の参照安定性のため
- **1プロジェクト最大1000行、1行500文字、全体900KB**：保存前にサイズチェックし、超過時はエラー表示

#### users/{accessCode}/leaveRecords/{recordId}

休暇レコード（use または adjustment）。

```typescript
{
  id: string,                       // = recordId
  type: "use" | "adjustment",       // 取得 or 調整
  leaveType: "paid" | "sick",       // 有給 or 傷病
  // use 用フィールド（v0.4 改訂）
  days?: number,                    // use のみ：日数 0以上の整数（X日Y時間入力のX部分、丸1日カウント基準）
  hours: number,                    // use: 0〜7の整数（Y時間部分） / adjustment: 整数（正負、絶対値9999以内）
  date: string,                     // "YYYY-MM-DD"（JST）
  note: string | null,              // 0〜30文字
  version: number,                  // 競合検知用、初期=1、保存時 +1
  updatedByClientId: string,        // 最終更新クライアント（UUID）
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

**フィールドの使い分け：**
- **use（取得）**：`days ≥ 0`, `hours 0〜7` の両方を持つ
  - 合計時間 = `days * 8 + hours`
  - 合計が 1 以上（`days > 0 || hours > 0`）を保存条件とする
  - `days` フィールドは **「丸1日」カウントの基準**（有給5日必須ルールで使用）
  - 入力 UI：「X日 Y時間」の2フィールド
- **adjustment（調整）**：`days` フィールドなし、`hours` のみ（正負どちらも可、-9999〜+9999）
  - 合計時間 = `hours`
  - 入力 UI：「**正負トグル + X日 + Y時間**」の3フィールド（X≥0, Y∈0〜7、内部で `hours = sign × (days*8 + Y)` に変換、SPEC 7-8 参照）

**注意：**
- **`version` と `updatedByClientId` を持つ**（Todo と同等の同時編集保護）
- 保存時は **transaction で残量再計算 + version チェック** を実施
- **transaction 内で同 leaveType の全 leaveRecords を query 取得**して残量再計算
- マイナスになるならエラー、整合性 OK なら保存
- 1ユーザーの leaveRecords 想定件数は数百件、Firestore transaction 内 query で十分実用範囲

### 2-3. 派生データ（保存しない計算項目）

以下は **常に都度計算**：

| 派生値 | 計算式 | 計算タイミング |
|---|---|---|
| トラッカーの進捗率 | `(今日 - startDate) / (endDate - startDate) × 100`、0〜100でクランプ | 画面表示時、1日1回または日付変更検知時 |
| トラッカーの経過日数 | `今日 - startDate`、0以上でクランプ | 同上 |
| トラッカーの残日数 | `endDate - 今日`、0以上でクランプ | 同上 |
| 有給残量 | `Σ(paid の adjustment.hours) - Σ(paid の use の合計時間)` ※use の合計時間 = `days*8 + hours` | 全レコード取得後にクライアント側で計算 |
| 傷病残量 | sick についても同様 | 同上 |
| **残量・取得済み・調整の表示** | すべて「X日 Y時間」形式で統一表示。X = `Math.floor(abs / 8)`、Y = `abs % 8`。負の値は先頭に「-」 | すべての休暇画面で統一 |
| **今年度取得済み（有給）** | `Σ(paid use の合計時間)` for date が現在の有給年度（9/1〜翌8/31）内 | 残量計算と同じタイミング、画面サマリに表示 |
| **今年度取得済み（傷病）** | `Σ(sick use の合計時間)` for date が現在の有給年度内（傷病も同じ年度集計を流用） | 同上 |
| **丸1日有給カウント**（5日必須ルール用） | `Σ(paid use.days)` for date が現在の有給年度内 | 半端時間 hours は含めない、days のみ |
| **5日達成フラグ** | 丸1日有給カウント >= 5 | true なら「丸1日取得：5 / 5日（達成）」通常スタイル、false なら「丸1日取得：◯ / 5日（未達、会社ルール目安）」warning スタイル。**今年度取得済みとは別行で表示**（認知負荷低減） |

---

## 3. ID 生成方式

### 3-1. すべて UUID v4（クライアント側生成）

- ライブラリ：`crypto.randomUUID()`（モダンブラウザ標準）
- 例：`"a3b8c4d2-1e7f-4b6c-9d0a-3f2e5c1b8d4a"`
- timestamp ベース ID は使わない（同一ミリ秒衝突・タイムゾーン依存を避ける）
- カスタム連番も使わない（同期コストが高い）

### 3-2. 例外：meta/singleton

- `docId = "singleton"`（固定）
- ユーザーごとに meta は1つしか持たないため

### 3-3. 行内 ID（Todo の lines[].id）

- 同じく UUID v4
- **Firestore に保存する**（v0.3 で確定、React key 安定化・行分割/結合時の参照安定性のため）
- 行追加時はクライアント側で `uuid()` を呼んで割り当て
- 行分割（Enter で行分割）時は、上半分が元の id を保持、下半分は新規 UUID 発行
- 行結合（Backspace で結合）時は、結合後の行は上行の id を保持、下行の id は破棄

---

## 4. 削除方式・編集影響

### 4-1. 削除は物理削除（hard delete）

- `deleteDoc` で Firestore から完全に削除
- 「削除済みフラグ」「論理削除」は使わない

### 4-2. 連鎖削除と batch write

**プロジェクト削除：**
- プロジェクトドキュメントを削除すれば中身（lines 配列）も一緒に消える（埋め込みなので連鎖不要）

**トラッカー削除：**
- 該当 tracker ドキュメントを削除
- **同時に meta.pinnedTrackerId が削除対象と一致する場合、null に更新**
- これは **Firestore transaction で実行**（v0.2 修正：batch ではなく transaction）
  - 理由：「読み取りから書き込みの間に他端末で meta が変わっていない」ことを保証するため
  - batch は書き込みの原子性のみ保証、読み取りは含まれない
  ```js
  await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(metaRef);
    const currentPinned = metaSnap.data()?.pinnedTrackerId;
    tx.delete(trackerRef);
    if (currentPinned === trackerId) {
      tx.update(metaRef, { pinnedTrackerId: null });
    }
  });
  ```
- transaction 失敗時は UI を削除前状態に戻す（AC-TRK-30 対応）

**休暇レコード削除：**
- 該当 record を削除
- 削除前に再計算してマイナスになるなら拒否（AC-LEAVE-07）

### 4-3. 編集影響

**プロジェクト名編集：**
- todoProjects/{projectId} の `name` を更新するだけ
- サイドバーは Firestore からの最新取得 or 楽観的更新でリアルタイム反映

**トラッカー編集：**
- 該当 tracker のフィールドを更新
- ピン留め中のトラッカーが編集された場合、ヘッダーの表示も自動更新（React state 再計算）

**休暇レコード編集：**
- 該当 record を更新
- 更新前に再計算 → マイナスになるなら拒否（AC-LEAVE-06）

**meta.pinnedTrackerId 編集：**
- 対象 trackerId が存在しない場合は null に戻す（AC-TRK-28）

### 4-4. ユーザー削除（ログアウト）

- Firestore データは **削除しない**（再ログイン時に復元できるように）
- localStorage の認証情報・タイマー実行中フラグ・音設定をクリア

---

## 5. 並び順の保存

### 5-1. ユーザー手動の並び替えは **しない**（CHARTER 第9章で確定済み）

- ドラッグ&ドロップ並び替えは Never
- `sortOrder` 等の手動順序フィールドは持たない

### 5-2. 各エンティティの暗黙の並び順

| エンティティ | 並び順 | 計算方法 |
|---|---|---|
| トラッカー一覧 | endDate 昇順 | Firestore クエリで `orderBy("endDate", "asc")` |
| Todoプロジェクト一覧 | createdAt 降順 | `orderBy("createdAt", "desc")` |
| Todo行（プロジェクト内） | 配列の出現順 | `lines` 配列の index 順（保存形式そのまま） |
| 休暇履歴 | date 降順、同日は createdAt 降順 | `orderBy("date", "desc"), orderBy("createdAt", "desc")` |

### 5-3. Todo行の並びは配列順

- データ的な親子関係はない（CHARTER 確定）
- インデントは見た目のみ
- 行追加 = 配列の末尾 push、または分割位置への splice
- 行削除 = 配列の filter

---

## 6. localStorage 設計

### 6-1. キー一覧（v0.2 改訂：accessCode 名前空間化）

**ルール：ユーザー固有データはキー名に `${accessCode}` を含める**。Firebase Auth 導入や複数アカウント切替時の衝突を予防。

| キー | 型 | 用途 | クリアタイミング |
|---|---|---|---|
| `workHub_accessCode` | string | 自動ログイン用（現在のアクティブアクセスコード） | ログアウト時 |
| `workHub_clientId` | string (UUID) | 競合検知（**ブラウザ単位で永続、accessCode 非依存**） | 手動初期化操作時のみ |
| `workHub_${accessCode}_timer_state` | "running" / "stopped" / "finished" | タイマー実行状態 | ログアウト時 / Reset |
| `workHub_${accessCode}_timer_mode` | "up" / "down" | カウントアップ/ダウン | ログアウト時 |
| `workHub_${accessCode}_timer_startedAt` | number (epoch ms) | Date.now() 差分計算用 | Stop / Reset / ログアウト時 |
| `workHub_${accessCode}_timer_countdown_seconds` | number | カウントダウン中の設定秒数 | ログアウト時 |
| `workHub_${accessCode}_timer_last_countdown_seconds` | number | 次回デフォルト値 | ログアウト時 |
| `workHub_${accessCode}_timer_sound_enabled` | "true" / "false" | 音 ON/OFF（デフォルト ON） | ログアウト時 |

**clientId の特殊扱い（v0.2 確定）：**
- accessCode に依存しない（ブラウザ単位）
- 初回起動時に UUID v4 を生成して localStorage に保存
- 以降は同じブラウザの全アクセスコードで共有
- 「同じブラウザの別タブで同じアクセスコード再ログイン」を「自分」と認識して競合検知が誤動作しない
- 「同じブラウザの別タブで別アクセスコード」も同じ clientId だが、Firestore パスが users/{accessCode}/ で分離されているので衝突しない

### 6-2. 業務データは保存しない

- Todo の行内容、トラッカー、休暇レコードは **絶対に localStorage に書かない**
- 書くと「localStorage 内の古いデータ vs Firestore の新しいデータ」の整合性事故が起きる

### 6-3. localStorage 不可時のフォールバック（AC-COMMON-03）

- プライベートブラウジング等で localStorage が無効な場合、メモリ上のデフォルト値で動作
- 「ブラウザの設定でデータ保存が制限されています」と控えめに表示
- アクセスコードは毎回入力が必要

---

## 7. React 状態管理

### 7-1. 状態の階層

```
App.jsx（ルート）
├ 認証状態（accessCode, isLoggedIn）
├ 現在のタブ（current_tab: "tracker" / "todo" / "leave" / "timer"）
├ meta 状態（pinnedTrackerId）
└ 各画面コンポーネント
   ├ TrackerScreen（S1）
   │   └ trackers[]、編集中のtracker、確認ダイアログ状態
   ├ TodoScreen（S2）
   │   ├ projects[]
   │   ├ selectedProjectId
   │   └ currentProject（lines 配列を含む、編集用ローカル state）
   ├ LeaveScreen（S3）
   │   ├ leaveRecords[]
   │   ├ currentTab: "use" / "adjustment"
   │   └ yearFilter
   └ TimerScreen（S4）
       ├ mode, state, elapsedSeconds, countdownSeconds
       └ soundEnabled
```

### 7-2. 状態管理ライブラリは使わない

- Redux / Zustand / Recoil / Jotai 等は **使わない**
- React の `useState` / `useReducer` / `useContext` のみ
- 初心者プロジェクトで状態管理ライブラリは過剰設計

### 7-3. Context の使い分け

- **AuthContext**：accessCode、isLoggedIn、logout 関数
- **MetaContext**：pinnedTrackerId とその更新関数（ヘッダーバーと S1 が共有）
- それ以外は props drilling で OK（深さ2〜3レベルなら問題なし）

### 7-4. 派生 state は useMemo

- 進捗率・残日数・残量計算は **useMemo** で計算
- 元データ（trackers、leaveRecords）が変わったときだけ再計算

### 7-5. Firestore 取得のタイミング

- **ログイン時**：meta のみ取得（trackers / todoProjects / leaveRecords は遅延取得）
- **タブ切替時**：該当タブのデータを取得（初回 or 明示再読込時のみ、メモリキャッシュがあれば再利用）
- **明示的な再読み込みボタン**（競合警告等）
- `onSnapshot`（リアルタイムリスナー）は **使わない**（CHARTER 確定）

### 7-5b. 楽観的更新は使わない（v0.3 明文化）

「楽観的更新」（保存前に UI を先に反映）は **使わない**。

- 編集中のローカル state は即時反映（textarea / モーダル等のローカル UI）
- Firestore 上の一覧データの更新は **保存成功後に反映**（楽観的にしない）
- 削除操作も **保存成功後に UI から消す**
- 失敗時の巻き戻し設計は避ける（事故が起きやすいため）
- 反応速度より「事故らない」を優先

### 7-5c. accessCode 切替時の React state 完全破棄（v0.3 明記）

ログアウト → 別アクセスコードログイン時：

- 前ユーザーの全 state を破棄：projects / trackers / leaveRecords / selectedProjectId / baseVersion / saveStatus / currentTab 等
- localStorage の accessCode 依存キー（`workHub_${accessCode}_*`）もクリア
- clientId はブラウザ単位なので保持
- 新ユーザーのデータを再取得して初期化

実装パターン：
```js
// AuthContext の logout / loginAs で
function changeAccessCode(newCode) {
  // 1. 全 React state を初期化（key プロップで再マウント or useEffect で破棄）
  // 2. 旧 accessCode 依存の localStorage を削除
  // 3. 新 accessCode を localStorage に保存
  // 4. App ルートで Firestore 再取得を開始
}
```

### 7-6. ローディング・エラー状態

各画面で以下の3パターンを持つ：

```typescript
{
  loading: boolean,
  error: string | null,
  data: T | null,
}
```

- `loading=true` のとき：スピナー表示
- `error` あり：エラー表示 + 再試行ボタン
- `data` あり：通常表示

---

## 8. 画面間データ共有

### 8-1. 共有する情報

| 情報 | 共有元 | 共有先 | 方法 |
|---|---|---|---|
| accessCode | App | 全画面 | AuthContext |
| pinnedTrackerId | App | ヘッダーバー + S1 トラッカー画面 | MetaContext |
| ピン留めトラッカーのデータ | S1 → ヘッダー | トラッカー一覧から取得 → ヘッダーで再計算 | MetaContext + 個別 fetch |
| current_tab | App | ヘッダー + ナビ + 本文 | App の useState |

### 8-2. 共有しない情報

- 各画面の編集中ローカル state（モーダル開閉、入力中の値）は親に上げない
- タブ間でデータが必要なケースは少ない（タイマーで作業時間 → Todo に反映、等はやらない）

### 8-3. タブ切替時の挙動

- タブを切り替えると、本文エリアのコンポーネントは **アンマウント** される（state がリセットされる）
- 再度開いたら **再マウント** されて Firestore から再取得
- Todo 編集中のタブ切替は AC-TODO-S09 で **強制保存** してから切替

---

## 8b. 共通ライブラリ・カスタムフック設計（v0.3 段階分け）

**共通化すべきモジュール** を段階リリースに合わせて実装。v1 で全部作るのは過剰なので、必要時期に合わせて分ける。

### 実装時期の分け方

| モジュール | 実装時期 | 理由 |
|---|---|---|
| `lib/date.js` | **v1 必須** | トラッカーの日付計算に直結 |
| `lib/uuid.js` | **v1 必須** | tracker / project / line ID 生成 |
| `lib/storage.js` | **v1 必須** | accessCode・clientId・localStorage 不可対応 |
| Firestore 基本ラッパー（fetch/save/error） | **v1 必須** | 全機能の土台 |
| トラッカー削除用の最小 transaction 関数 | **v1 必須** | ピン留め整合性のため |
| `hooks/useDebounceSave.js` | **v2a で実装** | Todo 保存で初めて必要 |
| `hooks/useFirestoreTransaction.js`（汎用版） | **v2a で実装** | v1 はトラッカー削除の最小実装で十分 |
| `lib/audio.js` | **v4 で実装** | タイマー音通知でのみ使用 |

v1 で土台を作りすぎないことで、機能実装の方に集中できる。

### 8b-1. `src/lib/date.js` — JST 日付ユーティリティ（v1 必須）

**ライブラリは追加しない**（dayjs / date-fns-tz は不採用、Intl 標準で十分）。

```js
// getTodayJST：必ず formatToParts を使う（toLocaleDateString で形式が崩れる罠を避ける）
export function getTodayJST() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;  // "2026-05-27"
}

// 日付文字列の parse は自前で行う（new Date(ymd) は UTC 扱いで JST と1日ズレるため絶対 NG）
function parseYmdAsUTC(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);  // ms
}

// daysDiffJST：JST カレンダー日同士の差分（純粋に文字列差分）
export function daysDiffJST(startDate, endDate) {
  return Math.round((parseYmdAsUTC(endDate) - parseYmdAsUTC(startDate)) / 86400000);
}

// 会計年度（4/1〜翌3/31）の境界判定 — トラッカー等で使用
export function getCurrentFiscalYear() {
  const today = getTodayJST();          // "YYYY-MM-DD"
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return month >= 4 ? year : year - 1;
}

export function getFiscalYearStart(fiscalYear) {
  return `${fiscalYear}-04-01`;
}

export function getFiscalYearEnd(fiscalYear) {
  return `${fiscalYear + 1}-03-31`;
}

// 有給年度（9/1〜翌8/31）の境界判定 — 休暇画面・5日ルール専用
// 会社固有ルール：有給年度は会計年度とは別
export function getCurrentLeaveYear() {
  const today = getTodayJST();          // "YYYY-MM-DD"
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return month >= 9 ? year : year - 1;
}

export function getLeaveYearStart(leaveYear) {
  return `${leaveYear}-09-01`;
}

export function getLeaveYearEnd(leaveYear) {
  return `${leaveYear + 1}-08-31`;
}

// 日付が指定の有給年度内かを判定
export function isInLeaveYear(date, leaveYear) {
  return date >= getLeaveYearStart(leaveYear) && date <= getLeaveYearEnd(leaveYear);
}
```

**絶対禁止：**
- `new Date("YYYY-MM-DD")` — UTC 解釈で1日ズレる
- `new Date().toLocaleDateString(...)` で `YYYY-MM-DD` を作る — 環境で `2026/5/7` 等に化ける
- `new Date().getMonth()` 等の端末タイムゾーン依存メソッド

### 8b-2. `src/lib/uuid.js` — UUID 生成（フォールバック付き）

```js
export function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // フォールバック（古いブラウザ / 非 secure context 用）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

### 8b-3. `src/lib/storage.js` — localStorage 安全ラッパー

```js
export function safeGetItem(key, defaultValue = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? defaultValue : v;
  } catch (e) {
    return defaultValue;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    // console.warn は出さない（成功条件「console.warn なし」に違反するため）
    // 開発時のみ確認したい場合は import.meta.env.DEV でガード
    if (import.meta.env?.DEV) {
      console.warn('localStorage 書き込み失敗', e);
    }
    return false;
  }
}

export function getNamespacedKey(accessCode, suffix) {
  // workHub_${accessCode}_${suffix} を返す
  return `workHub_${accessCode}_${suffix}`;
}
```

### 8b-4. `src/hooks/useDebounceSave.js` — デバウンス保存共通フック（v2a で実装）

Todo・休暇等で再利用。

```js
/**
 * useDebounceSave({
 *   value,                  // 監視対象の state
 *   onSave: async (val) => {...},  // 保存処理
 *   delay: 1500,            // デバウンス時間 ms
 *   saveOnVisibilityChange: true,
 *   saveOnPagehide: true,
 * })
 *
 * 戻り値: { status, save: () => Promise, retry: () => Promise, reload: () => Promise }
 */
```

**状態（6状態）と遷移表：**

| 状態 | 意味 |
|---|---|
| `idle` | 初期、編集なし |
| `dirty` | 編集あり、デバウンス待機中 |
| `saving` | Firestore 保存中 |
| `saving_slow` | 保存が10秒経過、ただし Promise 未確定（"failed" にしない、表示文言だけ変える） |
| `saved` | 保存成功 |
| `failed` | 保存失敗、編集内容は保持 |
| `conflict` | 競合検知、編集内容は保持、自動上書き禁止 |

**遷移表：**

| 現状態 | イベント | 次状態 | 挙動 |
|---|---|---|---|
| idle / saved | edit | dirty | デバウンスタイマー開始 |
| dirty | edit | dirty | デバウンスタイマーリセット |
| dirty | debounceElapsed | saving | onSave 実行 |
| dirty | forceSave（visibilitychange/pagehide/プロジェクト切替） | saving | デバウンス待たず onSave |
| saving | edit | saving | pendingDirty フラグ true |
| saving | forceSave | saving | 追加保存はしない（ロック） |
| saving | 10秒経過（Promise未確定） | saving_slow | 文言「保存に時間がかかっています」 |
| saving / saving_slow | saveResolve（成功）+ pendingDirty=false | saved | savedAt 更新 |
| saving / saving_slow | saveResolve + pendingDirty=true | dirty | デバウンス再開始 |
| saving / saving_slow | saveReject（失敗） | failed | 編集内容保持、再試行可能 |
| saving / saving_slow | conflictReject（version不一致） | conflict | 編集内容保持、自動上書き禁止 |
| failed | edit | dirty | エラー解除、デバウンス開始 |
| failed | retry | saving | 同内容で再保存（失敗前に対象 doc を再 fetch して「実は成功」なら saved 扱い） |
| conflict | edit | conflict | 編集は可能だが自動保存しない |
| conflict | reload | idle / saved | サーバーデータでローカル state を置換 |
| conflict | visibilitychange / pagehide | conflict | **自動保存しない**（重要） |
| saving / saving_slow | プロジェクト切替要求 | saving / saving_slow | 切替を保留、保存完了まで待つ |

**重要なルール：**
- `conflict` 中の `visibilitychange` / `pagehide` では **自動保存しない**（競合検知の意味がなくなるため）
- `saving` 中のプロジェクト切替は **保留**、保存完了まで待つ
- 10秒タイムアウトは「失敗確定」ではなく「遅延表示」（Promise は SDK のリトライを待つ）

**保証：**
- 保存中ロック（多重保存しない）
- 保存中に新編集が来たら、保存完了後に再デバウンス
- visibilitychange / pagehide で強制保存（conflict 中・saving 中はスキップ）

### 8b-4b. 休暇 transaction 擬似コード（v3 で実装、v0.5 追加）

leaveRecords の use / adjustment 追加・編集・削除すべてで以下のパターンを使う：

```js
// 例：use 追加
async function addLeaveUse({ leaveType, days, hours, date, note }) {
  return await runTransaction(db, async (tx) => {
    // 1. 同 leaveType の全 leaveRecords を取得（編集対象は新規なので除外不要）
    const q = query(
      collection(db, `users/${accessCode}/leaveRecords`),
      where('leaveType', '==', leaveType)
    );
    const snap = await tx.get(q);
    const records = snap.docs.map(d => d.data());

    // 2. 新レコードを含めた残量を計算
    const newRecord = { type: 'use', leaveType, days, hours, date, ... };
    const balance = calcBalance([...records, newRecord], leaveType);

    // 3. マイナスチェック
    if (balance < 0) {
      throw new Error(`SHORTAGE:${Math.abs(balance)}`);  // 残量 ◯日 ◯時間 不足
    }

    // 4. 保存
    const newRef = doc(collection(db, `users/${accessCode}/leaveRecords`));
    tx.set(newRef, {
      ...newRecord,
      id: newRef.id,
      version: 1,
      updatedByClientId: clientId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// 例：use 編集（編集対象を除外して残量再計算）
async function editLeaveUse(recordId, baseVersion, newData) {
  return await runTransaction(db, async (tx) => {
    const recordRef = doc(db, `users/${accessCode}/leaveRecords`, recordId);
    const recordSnap = await tx.get(recordRef);

    // 1. version 競合チェック（自分の clientId なら容認）
    const current = recordSnap.data();
    if (current.version !== baseVersion && current.updatedByClientId !== clientId) {
      throw new Error('CONFLICT');
    }

    // 2. 同 leaveType の全 leaveRecords を取得し、編集対象を除外
    const q = query(
      collection(db, `users/${accessCode}/leaveRecords`),
      where('leaveType', '==', newData.leaveType)
    );
    const snap = await tx.get(q);
    const others = snap.docs
      .map(d => d.data())
      .filter(r => r.id !== recordId);  // 編集対象を除外

    // 3. 編集後の値で残量再計算
    const balance = calcBalance([...others, newData], newData.leaveType);

    // 4. マイナスチェック
    if (balance < 0) throw new Error(`SHORTAGE:${Math.abs(balance)}`);

    // 5. 更新
    tx.update(recordRef, {
      ...newData,
      version: increment(1),
      updatedByClientId: clientId,
      updatedAt: serverTimestamp(),
    });
  });
}

// 例：adjustment 削除（残量がマイナスにならないか確認してから削除）
async function deleteLeaveAdjustment(recordId, baseVersion) {
  return await runTransaction(db, async (tx) => {
    const recordRef = doc(db, `users/${accessCode}/leaveRecords`, recordId);
    const recordSnap = await tx.get(recordRef);
    const target = recordSnap.data();

    // 1. version 競合チェック
    if (target.version !== baseVersion && target.updatedByClientId !== clientId) {
      throw new Error('CONFLICT');
    }

    // 2. 削除対象を除く全 leaveRecords を取得
    const q = query(
      collection(db, `users/${accessCode}/leaveRecords`),
      where('leaveType', '==', target.leaveType)
    );
    const snap = await tx.get(q);
    const remaining = snap.docs
      .map(d => d.data())
      .filter(r => r.id !== recordId);

    // 3. 削除後の残量計算（adjustment 削除なら残量が減る）
    const balance = calcBalance(remaining, target.leaveType);

    // 4. マイナスチェック
    if (balance < 0) throw new Error(`SHORTAGE:${Math.abs(balance)}`);

    // 5. 削除
    tx.delete(recordRef);
  });
}
```

**順序の厳守：**
1. version 競合チェック → 2. 全件取得 → 3. 残量再計算 → 4. マイナスチェック → 5. 書き込み
- この順序により、競合エラーが先に検出される（無駄な計算を避ける）
- 純粋関数 `calcBalance(records, leaveType)` を作って単体テスト可能に

**transaction 失敗時の挙動：**
- `CONFLICT` エラー：「他端末で更新されています。再読み込みしてください」モーダル
- `SHORTAGE:N` エラー：「残量が ◯日 ◯時間 不足します」モーダル（N を X日 Y時間 に変換して表示）
- ネットワーク失敗：「保存に失敗しました。再試行してください」と再試行ボタン
- 失敗時はモーダルを開いたまま、入力内容を保持

### 8b-5. `src/hooks/useFirestoreTransaction.js` — transaction 共通ラッパー（v2a で実装）

```js
/**
 * 標準的な transaction パターンを共通化：
 * 1. baseVersion をクライアントで保持
 * 2. tx.get で最新ドキュメントを取得
 * 3. version が baseVersion と一致 OR updatedByClientId が自分なら更新
 * 4. 保存成功後、サーバー側 version を再 fetch して state 更新（serverTimestamp / increment の確定値取得）
 * 5. CONFLICT エラーを catch 可能な形で投げる
 *
 * 失敗時の再 fetch ロジック（重要）：
 * transaction が reject した場合、対象 doc を再 fetch して：
 * - updatedByClientId === 自 clientId → 実は成功していた → status='saved' で返す
 * - updatedByClientId !== 自 clientId → 競合 → status='conflict' で返す
 * - 取得自体も失敗 → status='failed' で返す
 *
 * Todo・休暇・トラッカー（連鎖削除）で共有
 */
```

### 8b-6. `src/lib/audio.js` — タイマー通知音

サブエージェント指摘 5-7 対応。AudioContext の lazy 初期化と保持。

```js
let audioContextRef = null;  // モジュールスコープで保持

export function initAudioContext() {
  // ユーザー操作内（Start クリック等）で呼ぶ
  if (audioContextRef) {
    if (audioContextRef.state === 'suspended') {
      audioContextRef.resume();
    }
    return audioContextRef;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioContextRef = new Ctx();
  return audioContextRef;
}

export function playFinishSound() {
  if (!audioContextRef) return false;
  // 短いビープ音（500ms、Web Audio で生成）
  const osc = audioContextRef.createOscillator();
  const gain = audioContextRef.createGain();
  osc.frequency.value = 880;  // A5
  gain.gain.value = 0.1;
  osc.connect(gain).connect(audioContextRef.destination);
  osc.start();
  osc.stop(audioContextRef.currentTime + 0.3);
  return true;
}
```

---

## 9. Firestore セキュリティルール

### 9-1. v1 開発中（テストモード）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**注意：** Firestoreコンソールでテストモードを選択すると30日期限が付く。**30日以内に本番モードへ切り替え必須**。

### 9-2. v5 公開前（本番モード、v0.3 強化版）

Firebase Auth を使わないため本人保護はできないが、**破壊・汚染・無料枠消費リスクは Rules で最大限縮小する**。

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // アクセスコードの形式検証（8〜64文字、英数字/_/-）
    function validAccessCode(code) {
      return code is string
        && code.size() >= 8
        && code.size() <= 64
        && code.matches('^[A-Za-z0-9_-]+$');
    }

    // meta/singleton
    match /users/{accessCode}/meta/singleton {
      allow read: if validAccessCode(accessCode);
      allow write: if validAccessCode(accessCode)
        && request.resource.data.keys().hasOnly([
          'createdAt', 'lastLoginAt', 'pinnedTrackerId', 'schemaVersion'
        ]);
    }

    // trackers/{trackerId}
    match /users/{accessCode}/trackers/{trackerId} {
      allow read: if validAccessCode(accessCode);
      allow write: if validAccessCode(accessCode)
        && request.resource.data.keys().hasOnly([
          'id', 'title', 'startDate', 'endDate', 'createdAt', 'updatedAt'
        ])
        && request.resource.data.title is string
        && request.resource.data.title.size() <= 30;
    }

    // todoProjects/{projectId}
    match /users/{accessCode}/todoProjects/{projectId} {
      allow read: if validAccessCode(accessCode);
      allow write: if validAccessCode(accessCode)
        && request.resource.data.keys().hasOnly([
          'id', 'name', 'lines', 'version', 'updatedByClientId',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.name is string
        && request.resource.data.name.size() <= 30
        && request.resource.data.lines is list
        && request.resource.data.lines.size() <= 1000;
    }

    // leaveRecords/{recordId}
    // v0.6：use と adjustment で discriminated union、共通検証 + 個別検証
    match /users/{accessCode}/leaveRecords/{recordId} {
      allow read: if validAccessCode(accessCode);
      allow write: if validAccessCode(accessCode)
        // 共通検証（両 type 共通）
        && request.resource.data.leaveType in ['paid', 'sick']
        && request.resource.data.id == recordId
        && request.resource.data.note is string
        && request.resource.data.note.size() <= 30
        && request.resource.data.date is string
        && request.resource.data.date.matches('^\\d{4}-\\d{2}-\\d{2}$')
        // type 別のキー検証
        && (
          (request.resource.data.type == 'use'
            && request.resource.data.keys().hasOnly([
              'id', 'type', 'leaveType', 'days', 'hours', 'date', 'note',
              'version', 'updatedByClientId', 'createdAt', 'updatedAt'
            ])
            && request.resource.data.days is int
            && request.resource.data.days >= 0
            && request.resource.data.days <= 365              // v0.6 追加：日数上限
            && request.resource.data.hours is int
            && request.resource.data.hours >= 0
            && request.resource.data.hours <= 7
            // v0.6 追加：合計 > 0（days=0かつhours=0は不可）
            && (request.resource.data.days > 0 || request.resource.data.hours > 0))
          ||
          (request.resource.data.type == 'adjustment'
            && request.resource.data.keys().hasOnly([
              'id', 'type', 'leaveType', 'hours', 'date', 'note',
              'version', 'updatedByClientId', 'createdAt', 'updatedAt'
            ])
            && request.resource.data.hours is int
            && request.resource.data.hours >= -9999
            && request.resource.data.hours <= 9999
            // v0.6 追加：hours != 0（無意味な調整を拒否）
            && request.resource.data.hours != 0)
        );
    }

    // それ以外のパスは完全拒否
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**現実的な脅威モデル：**
- Firebase Auth を使わないため本人性確認は不可（CHARTER 6章で受容済み）
- ただし **アクセスコード形式（8文字以上）・キー検証・型検証・要素数制限** で破壊範囲を限定
- 機密情報を入れない前提で運用

**アクセスコード長さの方針（v0.3 強化）：**
- **最低 8 文字以上を必須**（Security Rules で拒否、SPEC AC-AUTH-02 で確認）
- 推奨は 12 文字以上（UI で説明文を出す）
- 短いコード（3〜7文字）は破られるリスクが高い

---

## 10. 課金・容量見積もり

### 10-1. Firestore Spark 無料プラン上限

- 読み取り：1日 20,000 回
- 書き込み：1日 20,000 回
- 削除：1日 20,000 回
- ストレージ：1GB
- ネットワーク送信：1日 10GB

### 10-2. 想定利用量（1ユーザー / 1日、v0.3 改訂）

ログイン時に全コレクションを読まず、**タブを開いた時に必要なものだけ取得**する方針に統一。

| 操作 | 回数想定 | 読み取り | 書き込み |
|---|---|---|---|
| ログイン（meta のみ） | 1〜3回 | meta 1 = 1〜3 | 0（初回のみ meta 作成 1書込） |
| 初期タブ取得（S1 トラッカー） | 1〜3回 | trackers 10 = 10〜30 | 0 |
| Todo タブを開く | 数回 | projects 100 + 開いたプロジェクトの内容 1 | 0 |
| 休暇タブを開く | 数回 | leaveRecords 数百 | 0 |
| Todo 編集 | 30分間で 100文字 → 1.5秒デバウンスで約20回保存 | 0（保存後 state 更新） | 約20回 |
| Todo プロジェクト切替 | 10回 | キャッシュから即時表示（再 fetch なし） | 0 |
| トラッカーCRUD | 数回 | 数回 | 数回 |
| 休暇レコードCRUD（transaction 内 query で全件取得） | 数回 | レコード数 × 操作回数 = 数百〜千 | 数回 |
| **合計（1日想定）** | | **約1000〜2500** | **約30〜100** |

無料枠（読み取り 20,000 / 書き込み 20,000）の **5〜15%** 程度。十分余裕あり。

### 10-3. 容量見積もり

| エンティティ | 1件あたり | 想定件数 | 合計 |
|---|---|---|---|
| meta | 約 200 bytes | 1 | 200 bytes |
| tracker | 約 250 bytes | 10 | 2.5KB |
| todoProject | 約 1KB（行50件想定） | 100 | 100KB |
| leaveRecord | 約 200 bytes | 1000 | 200KB |
| **合計** | | | **約 300KB** |

Spark プランの 1GB に対して 0.03%、課金心配なし。

### 10-4. 課金リスクと対策

**前提（最重要）：本プロジェクトでは絶対に課金されない**

- **Firebase Spark プラン（無料）のままで運用**
- Blaze プラン（従量課金）への変更は **明示的なプラン変更＋クレジットカード登録が必要**
- これを行わない限り、自動課金は **発生しない**
- CHARTER.md 第7章「全サービス完全無料、有料移行は絶対NG」を厳守

**上限到達時の挙動：**

| 上限種別 | 上限到達したらどうなる |
|---|---|
| 1日 20,000 書き込み | 21,001 回目以降の書き込みはエラーで拒否される（「保存失敗」表示が出る） |
| 1日 20,000 読み取り | 21,001 回目以降の読み取りはエラーで拒否される（「データ取得失敗」表示） |
| 1GB ストレージ | 新規データ書き込みが拒否される（既存データは閲覧可） |

**翌日（UTC 0:00）にリセットされて正常動作に戻る。課金は発生しない。**

| リスク | 対策 |
|---|---|
| Todo 編集が連続して書き込み爆発 | デバウンス1.5秒（CHARTER 確定） |
| Firestore リアルタイムリスナー(`onSnapshot`)で読み取り爆発 | 使わない（CHARTER 確定） |
| プロジェクト切替時に毎回 projects 全件取得 | サイドバー初回ロード後はメモリキャッシュ、明示再読み込みボタンで更新 |
| 開発中の意図しない無限ループ | 開発中は Firebase コンソールの利用ダッシュボードを時々確認 |
| 上限到達でアプリが使えなくなる | 1日想定 30〜100 書き込み、無料枠の 0.5% 以下なので通常到達しない |

---

## 11. マイグレーション方針

### 11-1. schemaVersion フィールドで管理 + 起動時 migration handler（v0.3 強化）

- `meta/singleton.schemaVersion` で現在のスキーマバージョンを保持
- 初期 = 1
- スキーマ変更時にインクリメント

**起動時 migration handler の空実装を v1 から仕込む：**

```js
// src/lib/migration.js
const CURRENT_SCHEMA_VERSION = 1;

export async function ensureSchema(accessCode) {
  const meta = await getMeta(accessCode);

  if (!meta) {
    // 新規ユーザー or meta 欠損
    // 既存サブコレクション（trackers/todoProjects/leaveRecords）があるかは確認しない
    // meta のみ作成、サブコレクションの空上書きはしない（AC-DATA-03）
    await createMeta({
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      pinnedTrackerId: null,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
    return;
  }

  const version = meta.schemaVersion ?? 1;  // 欠損時は 1 とみなす

  if (version > CURRENT_SCHEMA_VERSION) {
    // 古いアプリで新しいデータを開いた
    throw new Error('このアプリより新しいデータがあります。最新版にアップデートしてください');
  }

  if (version < CURRENT_SCHEMA_VERSION) {
    // migration を順次実行（v1 では空実装）
    await runMigrations(version, CURRENT_SCHEMA_VERSION);
    await updateMeta({ schemaVersion: CURRENT_SCHEMA_VERSION });
  }
}

async function runMigrations(from, to) {
  // v1 時点では何もしない（将来 v2 でスキーマ変更したら追加）
  // 例：if (from === 1 && to >= 2) { await migrate_1_to_2(accessCode); }
}
```

### 11-2. v1 → v2 移行

- v1：meta + trackers のみ
- v2：todoProjects 追加
- 移行：**自動マイグレーション不要**（todoProjects コレクションが空でも正常動作）
- AC-DATA-01〜03 で「欠損データでもエラーにしない」を保証

### 11-3. v2 → v3 移行

- v3：leaveRecords 追加
- 同じく自動マイグレーション不要

### 11-4. 既存スキーマの破壊的変更が必要になった場合

- 自分1人運用なので、**Firestore コンソールで手動補正**
- TBD-06 でユーザー承認済み

---

## 12. 禁止事項（壊れやすい設計パターン）

実装時に Claude Code がやらかしがちなパターン。**明示的に禁止**。

### 12-1. setDoc with merge:true の濫用禁止

```js
// ❌ NG：stale な lines が残る
await setDoc(projectRef, { lines: newLines }, { merge: true });

// ✅ OK：完全な状態を書き込む
await setDoc(projectRef, fullProjectData);
// または更新時：
await updateDoc(projectRef, { lines: newLines, updatedAt: serverTimestamp() });
```

（CHARTER 3-3 ルール）

### 12-2. 派生値の保存禁止

```js
// ❌ NG：残量を保存
await setDoc(metaRef, { paidLeaveBalance: 124 });

// ✅ OK：原始データから都度計算
const balance = adjustments.reduce(...) - uses.reduce(...);
```

### 12-3. リアルタイムリスナー禁止

```js
// ❌ NG：onSnapshot で課金爆発
onSnapshot(query(...), (snap) => { ... });

// ✅ OK：再読み込み時取得
const snap = await getDocs(query(...));
```

### 12-4. localStorage に業務データ保存禁止

```js
// ❌ NG
localStorage.setItem('workHub_todo_lines', JSON.stringify(lines));

// ✅ OK：Firestore のみ
await updateDoc(projectRef, { lines });
```

### 12-5. version チェックなしの上書き禁止

```js
// ❌ NG：他端末の変更を上書き
await updateDoc(projectRef, { lines: newLines, version: oldVersion + 1 });

// ✅ OK：transaction でチェック
await runTransaction(db, async (tx) => {
  const snap = await tx.get(projectRef);
  if (snap.data().version !== baseVersion) {
    throw new Error('CONFLICT');
  }
  tx.update(projectRef, {
    lines: newLines,
    version: increment(1),
    updatedByClientId: myClientId,
    updatedAt: serverTimestamp(),
  });
});
```

### 12-6. 連鎖削除を分割実行禁止

```js
// ❌ NG：途中で失敗するとピン解除されない
await deleteDoc(trackerRef);
await updateDoc(metaRef, { pinnedTrackerId: null });

// ❌ NG：batch は書き込みの原子性のみ、読み取り→書き込み間の他端末変更を検知できない
const batch = writeBatch(db);
batch.delete(trackerRef);
batch.update(metaRef, { pinnedTrackerId: null });
await batch.commit();

// ✅ OK：transaction で読み取り込みの整合性を保証
await runTransaction(db, async (tx) => {
  const metaSnap = await tx.get(metaRef);
  const currentPinned = metaSnap.data()?.pinnedTrackerId ?? null;
  tx.delete(trackerRef);
  if (currentPinned === trackerId) {
    tx.update(metaRef, { pinnedTrackerId: null });
  }
});
```

**判断基準：**
- 読み取りを伴う連鎖更新 → **transaction**（例：トラッカー削除＋ピン解除）
- 読み取り不要の純粋な複数書き込み → batch でも OK（ただし複合操作はほぼ常に transaction が安全）

### 12-7. タイムゾーン依存の日付計算禁止

```js
// ❌ NG：端末タイムゾーン依存
const today = new Date().toISOString().slice(0, 10);

// ❌ NG：new Date("YYYY-MM-DD") は UTC 扱いで JST と1日ズレる
const start = new Date(startDate);

// ❌ NG：toLocaleDateString は環境で形式がバラつく
const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

// ✅ OK：lib/date.js 経由（Intl.DateTimeFormat + formatToParts、自前 parse）
import { getTodayJST, daysDiffJST } from '@/lib/date';
const today = getTodayJST();         // "YYYY-MM-DD"
const days = daysDiffJST(start, end); // 日数差（整数）
```

**禁止：**
- `new Date("YYYY-MM-DD")` を絶対に使わない（UTC 解釈で前日ズレる）
- `toLocaleDateString` で `YYYY-MM-DD` を作らない（環境で `2026/5/7` 等に化ける）
- `dayjs` / `date-fns-tz` 等のライブラリは追加しない（依存最小限の方針）

### 12-8. クライアント側で予測 ID 生成禁止

```js
// ❌ NG：timestamp ベース、衝突あり
const id = Date.now().toString();

// ✅ OK：UUID v4（フォールバック付き lib/uuid.js 経由）
import { uuid } from '@/lib/uuid';
const id = uuid();
```

### 12-9. transaction 内で同一 doc に複数 write 禁止

```js
// ❌ NG：エラーになる
await runTransaction(db, async (tx) => {
  tx.update(docRef, { a: 1 });
  tx.update(docRef, { b: 2 });  // ← ここでエラー
});

// ✅ OK：1ドキュメントは1回にまとめる
await runTransaction(db, async (tx) => {
  tx.update(docRef, { a: 1, b: 2 });
});
```

### 12-10. addDoc で自動 ID 生成禁止（setDoc + doc(collection, uuid) を使う）

```js
// ❌ NG：Firestore が自動 ID を振るので、データ内の id と doc ID が不一致になる
await addDoc(collection(db, 'users/abc/trackers'), { id: 'my-uuid', title: '...' });

// ✅ OK：明示的に setDoc
import { uuid } from '@/lib/uuid';
const id = uuid();
await setDoc(doc(db, 'users/abc/trackers', id), { id, title: '...' });
```

### 12-11. AudioContext をマウント時に new しない

```jsx
// ❌ NG：ユーザー操作前に new するので、iOS Safari で suspend されて鳴らない
function Timer() {
  const audioCtx = useRef(new AudioContext());
}

// ✅ OK：Start クリック時に lazy 初期化
import { initAudioContext, playFinishSound } from '@/lib/audio';
function Timer() {
  const handleStart = () => {
    initAudioContext();  // ユーザー操作内で初期化
    // ...
  };
}
```

### 12-12. tx.update の serverTimestamp / increment は戻り値で取れない

```js
// ❌ NG：保存後の version が分からない、state がズレる
await runTransaction(db, async (tx) => {
  tx.update(docRef, { version: increment(1) });
});
setState({ ...state, version: state.version + 1 });  // ← サーバ側と乖離する可能性

// ✅ OK：transaction 後に再 fetch して最新値を取得
await runTransaction(db, async (tx) => {
  tx.update(docRef, { version: increment(1), updatedAt: serverTimestamp() });
});
const fresh = await getDoc(docRef);
setState({ ...state, version: fresh.data().version, updatedAt: fresh.data().updatedAt });
```

### 12-13. useEffect 依存配列に毎レンダー変わる関数を入れない

```jsx
// ❌ NG：fetchProjects が毎レンダー新しい参照になり、ループする
useEffect(() => {
  fetchProjects(accessCode);
}, [accessCode, fetchProjects]);  // fetchProjects が安定していない

// ✅ OK：useCallback で安定化、または依存に入れない
const fetchProjects = useCallback(async (code) => { ... }, []);
useEffect(() => {
  fetchProjects(accessCode);
}, [accessCode, fetchProjects]);
```

### 12-14. 楽観的更新の戻し先をクロージャに頼らない

```js
// ❌ NG：他の操作で state が変わると、巻き戻し時に他の変更も消える
const prev = projects;
setProjects(projects.filter(p => p.id !== id));
try { await deleteDoc(...); } catch (e) { setProjects(prev); }

// ✅ OK：失敗時は再 fetch
try {
  await deleteDoc(...);
  setProjects(projects.filter(p => p.id !== id));
} catch (e) {
  await refetchProjects();  // サーバー側の真実から復元
  showError('削除に失敗しました');
}
```

---

## 13. 承認チェック

- [ ] Firestore パス構造（users/{accessCode}/...）に同意
- [ ] エンティティ定義（meta / trackers / todoProjects / leaveRecords）に同意
- [ ] ID 生成は UUID v4 で確定
- [ ] 削除は物理削除。**読み取りを伴う連鎖更新は transaction**、純粋な複数書き込みのみ batch
- [ ] 並び順は固定（手動並び替えなし）
- [ ] localStorage は UI設定とアクセスコード・タイマー状態のみ
- [ ] React 状態管理は標準フック + 最小 Context のみ
- [ ] onSnapshot は使わない（読み取り時取得のみ）
- [ ] Firestore セキュリティルール（v5 で本番モード切替）
- [ ] 課金リスクは無料枠内
- [ ] マイグレーションは schemaVersion + 手動補正
- [ ] 禁止事項（12章、14項目）に同意
- [ ] 共通ライブラリ・カスタムフック（8b章）を v1 で必ず実装
- [ ] leaveRecords にも version を持たせ、Todo と同じ transaction 保護
- [ ] トラッカー削除は batch ではなく transaction（4-2）
- [ ] **Todo の行 id は Firestore に保存する**（v0.3 で再採用、React key 安定化のため）
- [ ] clientId は accessCode 非依存、ブラウザ単位で永続

承認後、ChatGPT 外部レビュー → Step 4 実装計画（PLAN.md）へ。
