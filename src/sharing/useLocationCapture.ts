import { useEffect, useRef, useState } from 'react'
import type { GeolocationPosition } from '../geolocation/useGeolocation'
import type { CapturedPoint } from './types'
import { addPendingPoint } from './pointsQueue'
import { flushPendingPoints } from './syncQueue'

const CAPTURE_INTERVAL_MS = 60_000
const SYNC_RETRY_INTERVAL_MS = 60_000

export interface LocationCaptureState {
  pendingCount: number
  lastCapturedAt: string | null
}

export function useLocationCapture(
  isSharing: boolean,
  participantId: string | null,
  position: GeolocationPosition | null,
): LocationCaptureState {
  const [pendingCount, setPendingCount] = useState(0)
  const [lastCapturedAt, setLastCapturedAt] = useState<string | null>(null)
  const lastCapturedAtRef = useRef<number>(0)

  const trySync = () => {
    flushPendingPoints()
      .then(({ remaining }) => setPendingCount(remaining))
      .catch((err) => {
        console.error('[sharing] 位置データの送信に失敗しました', err)
      })
  }

  // PWA起動時: 前回までの未送信データが残っていれば送信を試みる
  useEffect(() => {
    trySync()
  }, [])

  // 通信復旧時
  useEffect(() => {
    window.addEventListener('online', trySync)
    return () => window.removeEventListener('online', trySync)
  }, [])

  // 一定間隔でも再試行する(オンラインイベントが発火しないケースの保険)
  useEffect(() => {
    const intervalId = window.setInterval(trySync, SYNC_RETRY_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!isSharing) {
      lastCapturedAtRef.current = 0
    }
  }, [isSharing])

  useEffect(() => {
    if (!isSharing || !participantId || !position) return

    const now = Date.now()
    if (now - lastCapturedAtRef.current < CAPTURE_INTERVAL_MS) return
    lastCapturedAtRef.current = now

    const point: CapturedPoint = {
      id: crypto.randomUUID(),
      participantId,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      altitude: position.altitude,
      recordedAt: new Date(position.timestamp).toISOString(),
    }

    addPendingPoint(point)
      .then(() => {
        setLastCapturedAt(point.recordedAt)
        return flushPendingPoints()
      })
      .then(({ remaining }) => {
        setPendingCount(remaining)
      })
      .catch((err) => {
        console.error('[sharing] 位置データの保存に失敗しました', err)
      })
  }, [isSharing, participantId, position])

  return { pendingCount, lastCapturedAt }
}
