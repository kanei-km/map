import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase/client'
import { AdminMapView } from './AdminMapView'
import { getFreshnessStatus, FRESHNESS_LABEL } from './adminConfig'
import type { ParticipantLocation } from './types'
import './AdminApp.css'

const REFRESH_INTERVAL_MS = 30_000

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

export function AdminApp() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<ParticipantLocation[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const checkAdmin = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setIsAdmin(false)
      setChecking(false)
      return
    }

    const { data } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', sessionData.session.user.id)
      .maybeSingle()

    setIsAdmin(!!data)
    setChecking(false)
  }, [])

  useEffect(() => {
    checkAdmin()
  }, [checkAdmin])

  const loadData = useCallback(async () => {
    const [{ data: points, error: pointsError }, { data: people, error: peopleError }] =
      await Promise.all([
        supabase.from('latest_location_points').select('*'),
        supabase.from('participants').select('id, display_code'),
      ])

    if (pointsError || peopleError) {
      setLoadError('データの取得に失敗しました。')
      return
    }

    const codeById = new Map((people ?? []).map((p) => [p.id, p.display_code]))
    setParticipants(
      (points ?? []).map((point) => ({
        participantId: point.participant_id,
        displayCode: codeById.get(point.participant_id) ?? '?',
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy,
        recordedAt: point.recorded_at,
      })),
    )
    setLoadError(null)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    loadData()
    const intervalId = window.setInterval(loadData, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [isAdmin, loadData])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError('ログインに失敗しました。メールアドレスとパスワードをご確認ください。')
      return
    }
    setChecking(true)
    await checkAdmin()
  }

  if (checking) {
    return <div className="admin-loading">確認中...</div>
  }

  if (!isAdmin) {
    return (
      <div className="admin-login">
        <h1>管理画面ログイン</h1>
        <form onSubmit={handleLogin}>
          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {loginError && <p className="admin-error">{loginError}</p>}
          <button type="submit">ログイン</button>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <h1>日光国立公園あるき道 管理画面</h1>
      </header>
      <main className="admin-main">
        <div className="admin-map-wrapper">
          <AdminMapView participants={participants} />
        </div>
        <aside className="admin-list">
          {loadError && <p className="admin-error">{loadError}</p>}
          {participants.length === 0 && <p>まだ位置情報がありません。</p>}
          {participants.map((p) => {
            const status = getFreshnessStatus(p.recordedAt)
            return (
              <div key={p.participantId} className={`admin-list-item admin-status-${status}`}>
                <div className="admin-list-title">参加者 {p.displayCode}</div>
                <div>最終確認: {formatTime(p.recordedAt)}</div>
                <div>GPS精度: ±{Math.round(p.accuracy)}m</div>
                <div className="admin-list-status">{FRESHNESS_LABEL[status]}</div>
              </div>
            )
          })}
        </aside>
      </main>
    </div>
  )
}
