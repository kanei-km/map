import { useEffect, useRef, useState } from 'react'

export interface GeolocationPosition {
  latitude: number
  longitude: number
  accuracy: number
}

export interface GeolocationState {
  position: GeolocationPosition | null
  error: string | null
}

function toErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return '位置情報の利用が許可されていません。ブラウザまたは端末の設定で位置情報を許可してください。'
    case error.POSITION_UNAVAILABLE:
      return '現在地を取得できませんでした。GPSの電波状況をご確認ください。'
    case error.TIMEOUT:
      return '現在地の取得がタイムアウトしました。電波の良い場所でもう一度お試しください。'
    default:
      return '現在地を取得できませんでした。'
  }
}

export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GeolocationPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('このブラウザは位置情報に対応していません。')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => {
        setError(toErrorMessage(err))
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return { position, error }
}
