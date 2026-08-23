import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase/client'

const STORAGE_KEY = 'nikko-arukimichi:location-sharing-enabled'

function readInitialState(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export interface LocationSharingState {
  isSharing: boolean
  participantId: string | null
  displayCode: string | null
  authError: string | null
  start: () => Promise<void>
  stop: () => void
}

export function useLocationSharing(): LocationSharingState {
  const [isSharing, setIsSharing] = useState<boolean>(readInitialState)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [displayCode, setDisplayCode] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // 既にログイン済みのセッションがあれば、通信なしで参加者情報を復元する
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id
      if (!uid) return
      setParticipantId(uid)

      const { data: existing } = await supabase
        .from('participants')
        .select('display_code')
        .eq('id', uid)
        .maybeSingle()
      if (existing) {
        setDisplayCode(existing.display_code)
      }
    })
  }, [])

  const start = useCallback(async () => {
    setAuthError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      let uid = sessionData.session?.user?.id

      if (!uid) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error || !data.user) {
          throw new Error('参加者情報の初期化に失敗しました')
        }
        uid = data.user.id
      }

      const { data: existing } = await supabase
        .from('participants')
        .select('display_code')
        .eq('id', uid)
        .maybeSingle()

      let code = existing?.display_code ?? null

      if (!code) {
        const input = window.prompt(
          '参加者識別番号を入力してください(他の参加者と重複しない番号を管理者から指示された通りに入力してください)',
        )
        const trimmed = input?.trim()
        if (!trimmed) return
        code = trimmed

        const { error: upsertError } = await supabase
          .from('participants')
          .upsert({ id: uid, display_code: code }, { onConflict: 'id', ignoreDuplicates: true })
        if (upsertError) {
          throw upsertError
        }
      }

      const confirmed = window.confirm(
        '位置共有を開始すると、この端末のGPS位置情報が定期的にサーバーへ送信されます。開始しますか？',
      )
      if (!confirmed) return

      setParticipantId(uid)
      setDisplayCode(code)
      localStorage.setItem(STORAGE_KEY, 'true')
      setIsSharing(true)
    } catch {
      setAuthError('位置共有を開始できませんでした。通信の良い場所でもう一度お試しください。')
    }
  }, [])

  const stop = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'false')
    setIsSharing(false)
  }, [])

  return { isSharing, participantId, displayCode, authError, start, stop }
}
