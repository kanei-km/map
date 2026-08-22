import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { mapStyle, INITIAL_CENTER, INITIAL_ZOOM, ROUTE_URL, ROUTE_SOURCE_ID } from './style'
import type { GeolocationPosition } from '../geolocation/useGeolocation'
import './MapView.css'

export interface MapViewHandle {
  flyToPosition: (position: GeolocationPosition) => void
}

interface MapViewProps {
  position: GeolocationPosition | null
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { position },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    })

    map.addControl(new NavigationControl({ showCompass: false }), 'top-left')

    map.on('error', (e) => {
      console.error('[maplibre error]', e.error)
    })

    map.on('load', () => {
      map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: ROUTE_URL })

      map.addLayer({
        id: `${ROUTE_SOURCE_ID}-casing`,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7 },
      })

      map.addLayer({
        id: `${ROUTE_SOURCE_ID}-line`,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ff6b35', 'line-width': 4 },
      })
    })

    mapRef.current = map

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !position) return

    const lngLat: [number, number] = [position.longitude, position.latitude]

    if (!markerRef.current) {
      const el = document.createElement('div')
      el.className = 'current-location-marker'
      markerRef.current = new Marker({ element: el, anchor: 'center' }).setLngLat(lngLat)
      markerRef.current.addTo(map)
    } else {
      markerRef.current.setLngLat(lngLat)
    }
  }, [position])

  useImperativeHandle(ref, () => ({
    flyToPosition: (pos) => {
      mapRef.current?.flyTo({ center: [pos.longitude, pos.latitude], zoom: 16 })
    },
  }))

  return <div ref={containerRef} className="map-container" />
})
