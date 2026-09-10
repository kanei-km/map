import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MapView, type MapViewHandle } from './map/MapView'
import { useGeolocation } from './geolocation/useGeolocation'
import { useDeviceOrientation } from './geolocation/useDeviceOrientation'
import { useOnlineStatus } from './network/useOnlineStatus'
import { saveOfflineArea, getOfflineStatus, type OfflineMapStatus } from './offline/tileCache'
import { useLocationSharing } from './sharing/useLocationSharing'
import { useLocationCapture } from './sharing/useLocationCapture'
import './App.css'

const TITLE_MAX_FONT_SIZE = 18
const TITLE_MIN_FONT_SIZE = 10

// フォントの幅は端末によって差があるため、実際に描画してから
// 1行に収まるまでフォントサイズを縮めることで、どの端末でも見切れないようにする。
function useFitTitleFontSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      let fontSize = TITLE_MAX_FONT_SIZE
      el.style.fontSize = `${fontSize}px`
      while (el.scrollWidth > el.clientWidth && fontSize > TITLE_MIN_FONT_SIZE) {
        fontSize -= 0.5
        el.style.fontSize = `${fontSize}px`
      }
    }

    fit()
    window.addEventListener('resize', fit)
    document.fonts?.ready.then(fit).catch(() => {})
    return () => window.removeEventListener('resize', fit)
  }, [])

  return ref
}

function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

function App() {
  const mapRef = useRef<MapViewHandle>(null)
  const titleRef = useFitTitleFontSize<HTMLHeadingElement>()
  const { position, error } = useGeolocation()
  const { compassHeading, requestPermission: requestCompassPermission } = useDeviceOrientation()
  const isOnline = useOnlineStatus()
  const heading =
    typeof position?.heading === 'number' && Number.isFinite(position.heading)
      ? position.heading
      : compassHeading
  const {
    isSharing,
    participantId,
    displayCode,
    authError,
    start: startSharing,
    stop: stopSharing,
  } = useLocationSharing()
  const { pendingCount, lastCapturedAt } = useLocationCapture(isSharing, participantId, position)

  // iOSはコンパスの利用許可をユーザー操作の中でリクエストする必要があるが、
  // 「現在地」ボタンのタップを待つと一度もタップしないユーザーは永久にコンパスが
  // 有効化されない。画面のどこか一回の操作で自動的にリクエストする。
  useEffect(() => {
    const handleFirstInteraction = () => {
      void requestCompassPermission()
    }
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true })
    return () => window.removeEventListener('pointerdown', handleFirstInteraction)
  }, [requestCompassPermission])

  const [offlineStatus, setOfflineStatus] = useState<OfflineMapStatus | null>(() =>
    getOfflineStatus(),
  )
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleLocateClick = () => {
    // iOSはコンパスの利用許可をユーザー操作の中でリクエストする必要があるため、
    // 現在地ボタンのタップに便乗して許可を求める(未対応/許可済みの端末では何もしない)。
    void requestCompassPermission()
    if (position) {
      mapRef.current?.flyToPosition(position)
    }
  }

  const handleSaveOfflineClick = async () => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    setProgress({ completed: 0, total: 0 })
    try {
      const status = await saveOfflineArea((p) => setProgress(p))
      setOfflineStatus(status)
    } catch {
      setSaveError('オフライン地図の保存に失敗しました。電波の良い場所でもう一度お試しください。')
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  const savePercent =
    progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  const saveButtonLabel = saving
    ? `保存中 ${savePercent}%`
    : offlineStatus
      ? '地図を更新'
      : '地図を保存'

  return (
    <div className="app">
      <header className="app-header">
        <h1 ref={titleRef}>ONSEN・ガストロノミーウォーキング in 那須塩原2026</h1>
        {!isOnline && <span className="offline-badge">オフライン</span>}
      </header>
      <main className="map-wrapper">
        <MapView ref={mapRef} position={position} heading={heading} />

        <div className="status-overlay">
          <div className="sharing-control">
            <button
              type="button"
              className={isSharing ? 'sharing-toggle sharing-on' : 'sharing-toggle'}
              onClick={isSharing ? stopSharing : startSharing}
            >
              {isSharing ? '位置共有を停止' : '位置共有を開始'}
            </button>
            <span className="sharing-status">
              {isSharing ? '位置共有: 有効(送信中)' : '位置共有: 停止中'}
              {displayCode && ` / 参加者番号: ${displayCode}`}
            </span>
            <button
              type="button"
              className="panel-toggle"
              onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
              aria-expanded={!panelCollapsed}
              aria-label={panelCollapsed ? '詳細情報を表示' : '詳細情報を折りたたむ'}
            >
              {panelCollapsed ? '▼' : '▲'}
            </button>
          </div>
          {!panelCollapsed && (
            <>
              {authError && <p className="status-error">{authError}</p>}
              {pendingCount > 0 && (
                <p className="status-ok">
                  未送信の位置データ: {pendingCount}件
                  {lastCapturedAt && `(最終記録 ${formatTime(lastCapturedAt)})`}
                </p>
              )}
              {error ? (
                <p className="status-error">{error}</p>
              ) : position ? (
                <p className="status-ok">
                  現在地取得済み
                  <br />
                  精度 ±{Math.round(position.accuracy)}m
                </p>
              ) : (
                <p className="status-pending">現在地を取得中...</p>
              )}
              {offlineStatus && (
                <p className="status-offline-ready">
                  オフライン利用準備完了
                  <br />
                  {formatSavedAt(offlineStatus.savedAt)}保存(タイル{offlineStatus.tileCount}枚)
                </p>
              )}
              {saveError && <p className="status-error">{saveError}</p>}
            </>
          )}
        </div>

        <button
          type="button"
          className="locate-button"
          onClick={handleLocateClick}
          disabled={!position}
        >
          現在地
        </button>

        <button
          type="button"
          className="save-offline-button"
          onClick={handleSaveOfflineClick}
          disabled={saving || !isOnline}
        >
          {saveButtonLabel}
        </button>
      </main>
    </div>
  )
}

export default App
