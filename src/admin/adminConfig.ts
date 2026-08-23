// 最終確認からの経過時間による状態しきい値(分)。必要に応じて変更可能。
export const FRESHNESS_THRESHOLD_MINUTES = {
  updating: 5,
  delayed: 15,
}

export type FreshnessStatus = 'updating' | 'delayed' | 'stale'

export const FRESHNESS_LABEL: Record<FreshnessStatus, string> = {
  updating: '更新中',
  delayed: '更新遅延',
  stale: '位置情報更新なし',
}

export function getFreshnessStatus(recordedAt: string): FreshnessStatus {
  const minutesAgo = (Date.now() - new Date(recordedAt).getTime()) / 60_000
  if (minutesAgo <= FRESHNESS_THRESHOLD_MINUTES.updating) return 'updating'
  if (minutesAgo <= FRESHNESS_THRESHOLD_MINUTES.delayed) return 'delayed'
  return 'stale'
}
