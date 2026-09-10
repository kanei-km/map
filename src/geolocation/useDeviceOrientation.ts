import { useEffect, useRef, useState } from 'react'

export type CompassPermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied'

export interface DeviceOrientationState {
  compassHeading: number | null
  permissionState: CompassPermissionState
  requestPermission: () => Promise<void>
}

// iOS 13+はDeviceOrientationEvent.requestPermission()がユーザー操作(タップ等)の
// 呼び出し中でないと許可ダイアログを出さないため、型定義に無いAPIとして扱う。
interface DeviceOrientationEventConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

function needsExplicitPermission(): boolean {
  const ctor = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & DeviceOrientationEventConstructorWithPermission)
    | undefined
  return typeof ctor?.requestPermission === 'function'
}

function extractHeading(event: DeviceOrientationEvent): number | null {
  const iosHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
    .webkitCompassHeading
  if (typeof iosHeading === 'number' && Number.isFinite(iosHeading)) {
    return iosHeading
  }

  if (event.alpha === null) return null

  // Android等の absolute な alpha は反時計回りのため、北を0とする時計回りの値に変換する。
  // 画面回転がある場合は screen.orientation.angle の分だけ補正する。
  if (!event.absolute) return null
  const screenAngle = window.screen.orientation?.angle ?? 0
  return (360 - event.alpha + screenAngle + 360) % 360
}

export function useDeviceOrientation(): DeviceOrientationState {
  const [compassHeading, setCompassHeading] = useState<number | null>(null)
  const [permissionState, setPermissionState] = useState<CompassPermissionState>('prompt')
  const requestingRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setPermissionState('unsupported')
      return
    }
    if (!needsExplicitPermission()) {
      setPermissionState('granted')
    }
  }, [])

  useEffect(() => {
    if (permissionState !== 'granted') return

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const heading = extractHeading(event)
      if (heading !== null) {
        setCompassHeading(heading)
      }
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [permissionState])

  const requestPermission = async () => {
    if (requestingRef.current || permissionState === 'granted') return
    if (!needsExplicitPermission()) {
      setPermissionState('granted')
      return
    }

    requestingRef.current = true
    try {
      const ctor = window.DeviceOrientationEvent as unknown as Required<
        DeviceOrientationEventConstructorWithPermission
      >
      const result = await ctor.requestPermission()
      setPermissionState(result === 'granted' ? 'granted' : 'denied')
    } catch {
      setPermissionState('denied')
    } finally {
      requestingRef.current = false
    }
  }

  return { compassHeading, permissionState, requestPermission }
}
