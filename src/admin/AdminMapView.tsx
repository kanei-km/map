import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { mapStyle, INITIAL_CENTER, INITIAL_ZOOM } from '../map/style'
import { getFreshnessStatus } from './adminConfig'
import type { ParticipantLocation } from './types'
import './AdminMapView.css'

interface AdminMapViewProps {
  participants: ParticipantLocation[]
}

export function AdminMapView({ participants }: AdminMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    })
    mapRef.current = map
    const markers = markersRef.current

    return () => {
      markers.forEach((marker) => marker.remove())
      markers.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const seenIds = new Set<string>()

    for (const participant of participants) {
      seenIds.add(participant.participantId)
      const status = getFreshnessStatus(participant.recordedAt)

      let marker = markersRef.current.get(participant.participantId)
      if (!marker) {
        const el = document.createElement('div')
        marker = new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([participant.longitude, participant.latitude])
          .addTo(map)
        markersRef.current.set(participant.participantId, marker)
      } else {
        marker.setLngLat([participant.longitude, participant.latitude])
      }

      const el = marker.getElement()
      el.className = `admin-marker admin-marker-${status}`
      el.replaceChildren()

      const label = document.createElement('span')
      label.className = 'admin-marker-label'
      label.textContent = `参加者 ${participant.displayCode}`
      el.appendChild(label)

      const dot = document.createElement('span')
      dot.className = 'admin-marker-dot'
      el.appendChild(dot)
    }

    for (const [id, marker] of markersRef.current) {
      if (!seenIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }
  }, [participants])

  return <div ref={containerRef} className="admin-map-container" />
}
