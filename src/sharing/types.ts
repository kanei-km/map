export interface CapturedPoint {
  id: string
  participantId: string
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  recordedAt: string
}
