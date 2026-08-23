import { supabase } from '../supabase/client'
import { getPendingPoints, deletePendingPoint } from './pointsQueue'
import type { CapturedPoint } from './types'

function toRow(point: CapturedPoint) {
  return {
    id: point.id,
    participant_id: point.participantId,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: point.accuracy,
    altitude: point.altitude,
    recorded_at: point.recordedAt,
  }
}

export interface FlushResult {
  sent: number
  remaining: number
}

// 未送信の位置データを送信できるだけ送信する。1件でも失敗したら
// (多くの場合オフラインが原因のため)そこで打ち切り、次の機会に再試行する。
export async function flushPendingPoints(): Promise<FlushResult> {
  const points = await getPendingPoints()
  let sent = 0

  for (const point of points) {
    // 位置データは一度記録したら変更しないため、競合時は書き込まず無視する。
    // (複数の再送信トリガーが同じ点をほぼ同時に送っても、UPDATE権限を必要とせず安全に重複排除できる)
    const { error } = await supabase
      .from('location_points')
      .upsert(toRow(point), { onConflict: 'id', ignoreDuplicates: true })

    if (error) break

    await deletePendingPoint(point.id)
    sent += 1
  }

  const remaining = await getPendingPoints()
  return { sent, remaining: remaining.length }
}
