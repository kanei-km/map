# 日光国立公園あるき道(実証版PWA)

「日光国立公園あるき道」の地図とルートをスマートフォンで表示し、GPSによる現在地を確認できる実証版(PoC)のPWAです。

## 目的

山間部など通信圏外の場所でも、事前に保存した地図の上でルートと現在地を確認できることを実証するための、最小構成のプロトタイプです。本格アプリではありません。ユーザー登録・SNS・活動記録・写真投稿・決済といった機能は含みません。

位置情報は端末内でのみ使用し、外部サーバーへは一切送信しません。位置情報の履歴も保存しません。

## 開発環境

- Node.js 24系 / npm 11系
- React 19 + TypeScript + Vite
- MapLibre GL JS(地図描画)
- vite-plugin-pwa(Web App Manifest / Service Worker生成)
- 地図タイル: 地理院タイル(淡色地図) — 出典明示のみで利用可能

## 起動方法(開発サーバー)

```
npm install
npm run dev
```

`http://localhost:5173/` にブラウザでアクセスします。開発サーバーではService Workerは動作しないため、PWA機能(オフライン保存など)は次項の本番ビルドで確認してください。

## ビルド方法(本番ビルド)

```
npm run build
npm run preview
```

`http://localhost:4173/` で本番ビルドを確認できます。`npm run preview` はService Workerが実際に動作する唯一のローカル確認方法です。オフライン関連の動作確認は必ずこちらで行ってください。

型チェック(`tsc -b`)は`npm run build`に含まれています。Lintは `npm run lint` で実行できます(oxlint)。

## PWAの確認方法

1. `npm run build && npm run preview` を実行し、`http://localhost:4173/` にアクセスする
2. ブラウザの開発者ツールで Application(Chrome)/ Storage タブを開き、Service Workerが登録され `activated` になっていることを確認する
3. Manifest欄で名称・アイコン・`display: standalone` が反映されていることを確認する
4. スマートフォン実機でアクセスし、「ホーム画面に追加」からインストールし、アイコンをタップしてスタンドアロン表示(URLバーなし)で起動することを確認する

## GeoJSONルートの差し替え方法

ルートデータは `public/data/routes/sample-route.geojson` に配置されています。実際の「あるき道」データが用意できたら、**このファイルを同じ場所・同じファイル名で置き換えるだけ**で反映されます(コード変更は不要です)。

- 形式: `FeatureCollection` の中に `LineString` (ルート)や `Point` (地点)を含むGeoJSON
- 座標系: WGS84(緯度経度、`[経度, 緯度]`の順)
- `Point` の`Feature`に`properties.name`を設定すると、地点名ラベル付きのマーカーとして地図上に表示されます(GPXのウェイポイントに相当)
- 初期表示位置・ズームは `src/map/style.ts` の `INITIAL_CENTER` / `INITIAL_ZOOM` で調整してください(実データのルートに合わせて更新することを推奨します)

GPXファイルを直接読み込む機能は持たないため、GPXを用意した場合はGeoJSONへ変換してから配置してください(`<trkpt>` → `LineString`の座標、`<wpt>` → `name`付きの`Point`)。

## オフライン地図の保存方法

1. オンライン状態でアプリを開く
2. 画面左下の「地図を保存」ボタンを押す
3. 進捗が「保存中 ◯%」と表示され、完了すると「地図を更新」に変わり、画面上部に「オフライン利用準備完了」と保存日時・タイル枚数が表示される

保存される範囲は、GeoJSONルートの範囲に500mのバッファを加えた矩形、ズームレベルはz12〜z16です(`src/offline/tileCache.ts` の `BUFFER_METERS` / `MIN_ZOOM` / `MAX_ZOOM` で調整可能)。保存したタイルはCache Storage(`map-tiles-v1`)に明示的に保存され、ブラウザの偶発的なキャッシュには依存しません。

ルートデータを差し替えた場合は、「地図を保存」を再度押して該当エリアのタイルを保存し直してください。

## 位置共有機能(実証版)

利用者が「位置共有を開始」すると、この端末のGPS位置情報を60秒間隔でSupabaseへ送信します。通信できない場合はIndexedDBに一時保存し、オンライン復帰時・アプリ起動時・一定間隔(60秒)・次の位置取得時に自動で再送信します。

- リアルタイム追跡や遭難救助システムではありません。iPhoneでは画面ロック・バックグラウンド化により位置取得が停止します(後述の制約を参照)
- 位置共有は必ず利用者本人の操作で開始し、開始時に送信内容を明示します
- 認証にはSupabaseの匿名認証(Anonymous Auth)を使用し、メールアドレス等の入力は不要です。ただし初回のみ、他の参加者と区別するための**参加者識別番号を利用者自身が入力**します(管理者から指示された番号など、任意の文字列)。一度入力すれば、以後は同じ端末・同じ起動経路であれば再入力は不要です

### Supabaseのセットアップ

1. Supabaseプロジェクトを作成し、`supabase/migrations/` 内のSQLを順に適用する(`npx supabase db query --linked --project-ref <ref> --file supabase/migrations/<file>.sql`)
2. プロジェクトの匿名認証を有効化する(`supabase/config.toml` の `enable_anonymous_sign_ins = true` を `npx supabase config push` で反映)
3. `.env.local` に以下を設定する(`.env.example` を参照)

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable/anon key>
VITE_ENABLE_LOCATION_SHARING=true
```

`VITE_ENABLE_LOCATION_SHARING` を `false` にすると、位置共有機能を使わないイベント向けに「位置共有を開始」ボタンや関連のステータス表示を非表示にできます(未設定時は`true`扱い)。

4. GitHub Pagesへのデプロイでもこれらの値が必要なため、GitHubリポジトリのSecretsに `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を登録する(`gh secret set` など)

### データ保持期間

`app_config`テーブルの`location_retention_days`(既定14日)で保持期間を設定できます。`public.cleanup_old_location_points()`関数を実行すると、それより古い位置データを削除します(実証版では手動実行、または任意でpg_cron等によるスケジュール実行を検討してください)。

## 管理画面

運営者が参加者の最終確認位置を確認できる簡易ダッシュボードです。`/admin.html`(例: `https://kanei-km.github.io/map/admin.html`)からアクセスします。

- ログインには、`admins`テーブルに登録されたSupabaseアカウント(メール・パスワード)が必要です。一般の参加者アカウント(匿名認証)ではログインできません
- 新しい管理者を追加するには、Supabase Auth側にユーザーを作成した上で、`admins`テーブルに `user_id` を1行追加してください
- 各参加者について「参加者◯◯◯」「最終確認: HH:MM」「GPS精度」に加え、最終確認からの経過時間に応じた状態(更新中/更新遅延/位置情報更新なし)を表示します。**現在位置ではなく「最終確認位置」として扱います**
- しきい値(既定: 5分/15分)は `src/admin/adminConfig.ts` の `FRESHNESS_THRESHOLD_MINUTES` で変更できます
- 一覧は30秒ごとに自動更新されます
- 画面右上の「セッションをリセット」を押すと、全参加者の位置情報履歴(`location_points`)のみを削除し、一覧を空にできます。**参加者番号の登録(`participants`)は削除されない**ため、次回以降も同じ参加者番号を再入力する必要はありません。新しい実証セッションを始める前のクリア操作として使用してください

## デプロイ方法(GitHub Pages)

本リポジトリは GitHub Pages(`https://kanei-km.github.io/map/`)へのデプロイを前提に構成しています。

- `main` ブランチに push すると `.github/workflows/deploy-pages.yml` が自動的にビルド・デプロイします(リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく必要があります)
- Vite の `base` は `vite.config.ts` で `/map/` に固定しています。リポジトリ名や公開URLを変更する場合は、この値を合わせて変更してください
- GitHub PagesはGitHub Freeプランでは公開(Public)リポジトリでのみ利用できます

## iPhoneでのテスト方法

Service WorkerとGeolocation APIはHTTPS(またはlocalhost)必須です。上記のGitHub Pages URL(`https://kanei-km.github.io/map/`)はHTTPSで配信されるため、そのままiPhone実機でテストできます。

手順:
1. `https://kanei-km.github.io/map/` をSafariで開く
2. 地図・ルート・「現在地」ボタンが表示されることを確認する
3. Safariの共有ボタン →「ホーム画面に追加」を選択(iOSには自動インストール promptがないため手動操作が必要です)
4. ホーム画面のアイコンから起動し、スタンドアロン表示になることを確認する
5. オンライン状態で「地図を保存」を実行する
6. **重要**: 保存も、後述の機内モードテストも、必ず同じ起動経路(ホーム画面アイコンから)で行ってください。Safariのタブから開いた場合とホーム画面アプリとで保存領域が別扱いになることがあります

## Androidでのテスト方法

- `https://kanei-km.github.io/map/` をChromeで開く(USBデバッグ経由で `adb reverse tcp:4173 tcp:4173` を使い、PC上の `http://localhost:4173/map/` をそのまま端末のChromeで開く方法でも確認できます。localhostはセキュアコンテキスト扱いのため証明書なしで動作します)
- Chromeでアクセスすると画面下部などに「ホーム画面に追加」の案内が自動表示されることがあります
- ホーム画面のアイコンから起動し、オンライン状態で「地図を保存」を実行してください

## 機内モードでのテスト方法(最終確認)

1. オンライン状態で、対象エリアの「地図を保存」を実行し、「オフライン利用準備完了」の表示を確認する
2. 端末を機内モードにする(GPSは維持し、Wi-Fi/モバイル通信のみ切る端末設定でも可)
3. ホーム画面のアイコンからアプリを起動する
4. 保存済み地図が表示されるか確認する
5. GeoJSONルート(オレンジ色の線)が表示されるか確認する
6. 現在地(GPS)が取得され、地図上に表示されるか確認する
7. 画面上部に「オフライン」表示が出ることを確認する

GPSは屋外の上空が開けた場所で確認してください。屋内や機内モード直後は、衛星測位に必要な情報(A-GPS)がネットワーク経由で得られないため、位置取得に数十秒〜数分かかることがあります。

## 現時点で分かっている制約

- **タイル提供元**: 地理院タイル(淡色地図)を採用しています。出典明示のみで利用可能ですが、実運用で対象エリアを大幅に広げる場合は、国土地理院への確認を推奨します
- **iOSのストレージ挙動**: Safariのタブとホーム画面アプリでCache Storage/localStorageの扱いが異なる場合があります。保存と動作確認は必ず同じ起動経路で行ってください
- **iOSのバックグラウンド制限**: 地図保存はアプリを開いている間(フォアグラウンド)にのみ行えます。バックグラウンドでの自動保存はできません
- **HTTPS必須**: 実機でのService Worker・Geolocationの動作にはHTTPSが必須です。GitHub Pagesへのデプロイにより満たされますが、リポジトリを非公開に戻すとGitHub Free環境ではPagesが使えなくなります
- **地図保存範囲**: サンプルルート周辺(z12〜z16、バッファ500m)に限定しています。範囲やズームレベルを広げるとタイル数・保存時間・保存容量が増加します
- **バンドルサイズ**: MapLibre GL JS等を含むため、本番ビルドのJSバンドルは約1.1MB(gzip後 約310KB)です。実証版のため未対応ですが、本格運用時はコード分割等の最適化を検討してください
- **GPS精度**: 山間部・樹林帯では衛星捕捉状況により精度や取得時間が変動します
- **位置共有はフォアグラウンド限定**: 画面ロックやアプリのバックグラウンド化が起きると、iOS Safariでは位置取得が停止します。これはWebアプリの制約であり回避できません。実証実験中は画面を開いたままにしてください
- **位置データの認可**: 参加者はSupabase匿名認証で識別し、RLS(Row Level Security)により自分の位置データのみ書き込み・閲覧可能です。管理画面は別途登録した管理者アカウントでのみ全参加者を閲覧できます
- **同時再送信の扱い**: 複数のタイミングで再送信を試みる設計のため、同じ位置データが競合して送信されることがあります。位置データは一度記録したら変更しない前提とし、送信は「重複時は何もしない」方式で安全に重複排除しています
