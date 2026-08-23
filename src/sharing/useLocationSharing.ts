import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase/client'

const STORAGE_KEY = 'nikko-arukimichi:location-sharing-enabled'

function readInitialState(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export interface LocationSharingState {
  isSharing: boolean
  participantId: string | null
  authError: string | null
  start: () => Promise<void>
  stop: () => void
}

export function useLocationSharing(): LocationSharingState {
  const [isSharing, setIsSharing] = useState<boolean>(readInitialState)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // 既にログイン済みのセッションがあれば、通信なしで参加者IDを復元する
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setParticipantId(data.session.user.id)
      }
    })
  }, [])

  const ensureParticipant = useCallback(async (): Promise<string> => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session?.user) {
      setParticipantId(sessionData.session.user.id)
      return sessionData.session.user.id
    }

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.user) {
      throw new Error('参加者情報の初期化に失敗しました')
    }

    await supabase
      .from('participants')
      .upsert({ id: data.user.id }, { onConflict: 'id', ignoreDuplicates: true })

    setParticipantId(data.user.id)
    return data.user.id
  }, [])

  const start = useCallback(async () => {
    const confirmed = window.confirm(
      '位置共有を開始すると、この端末のGPS位置情報が定期的にサーバーへ送信されます。開始しますか？',
    )
    if (!confirmed) return

    setAuthError(null)
    try {
      await ensureParticipant()
      localStorage.setItem(STORAGE_KEY, 'true')
      setIsSharing(true)
    } catch {
      setAuthError('位置共有を開始できませんでした。通信の良い場所でもう一度お試しください。')
    }
  }, [ensureParticipant])

  const stop = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'false')
    setIsSharing(false)
  }, [])

  return { isSharing, participantId, authError, start, stop }
}
