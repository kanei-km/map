import { ROUTE_URL } from '../map/style'

export const TILE_URL_TEMPLATE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
export const TILE_CACHE_NAME = 'map-tiles-v1'
export const MIN_ZOOM = 12
export const MAX_ZOOM = 16
export const BUFFER_METERS = 500
const DOWNLOAD_CONCURRENCY = 6

const OFFLINE_STATUS_KEY = 'nikko-arukimichi:offline-map-status'

export interface OfflineMapStatus {
  savedAt: string
  tileCount: number
}

export interface SaveProgress {
  completed: number
  total: number
}

interface BoundingBox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

function walkCoordinates(coords: unknown, callback: (lng: number, lat: number) => void): void {
  if (
    Array.isArray(coords) &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    callback(coords[0], coords[1])
    return
  }
  if (Array.isArray(coords)) {
    for (const item of coords) {
      walkCoordinates(item, callback)
    }
  }
}

function computeBoundingBox(geojson: any): BoundingBox {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  const visitGeometry = (geometry: any) => {
    if (!geometry) return
    walkCoordinates(geometry.coordinates, (lng, lat) => {
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    })
  }

  if (geojson.type === 'FeatureCollection') {
    for (const feature of geojson.features) {
      visitGeometry(feature.geometry)
    }
  } else if (geojson.type === 'Feature') {
    visitGeometry(geojson.geometry)
  } else {
    visitGeometry(geojson)
  }

  return { minLng, minLat, maxLng, maxLat }
}

function bufferBoundingBox(bbox: BoundingBox, meters: number): BoundingBox {
  const centerLat = (bbox.minLat + bbox.maxLat) / 2
  const latDelta = meters / 111320
  const lngDelta = meters / (111320 * Math.cos((centerLat * Math.PI) / 180))
  return {
    minLng: bbox.minLng - lngDelta,
    maxLng: bbox.maxLng + lngDelta,
    minLat: bbox.minLat - latDelta,
    maxLat: bbox.maxLat + latDelta,
  }
}

function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180
  const n = 2 ** zoom
  const x = Math.floor(((lng + 180) / 360) * n)
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  )
  return {
    x: Math.min(Math.max(x, 0), n - 1),
    y: Math.min(Math.max(y, 0), n - 1),
  }
}

function listTileUrls(bbox: BoundingBox, minZoom: number, maxZoom: number): string[] {
  const urls: string[] = []
  for (let z = minZoom; z <= maxZoom; z++) {
    const nw = lngLatToTile(bbox.minLng, bbox.maxLat, z)
    const se = lngLatToTile(bbox.maxLng, bbox.minLat, z)
    for (let x = nw.x; x <= se.x; x++) {
      for (let y = nw.y; y <= se.y; y++) {
        urls.push(
          TILE_URL_TEMPLATE.replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y)),
        )
      }
    }
  }
  return urls
}

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
): Promise<void> {
  let index = 0
  async function worker() {
    while (index < tasks.length) {
      const current = index++
      await tasks[current]()
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}

export async function saveOfflineArea(
  onProgress?: (progress: SaveProgress) => void,
): Promise<OfflineMapStatus> {
  const routeResponse = await fetch(ROUTE_URL)
  if (!routeResponse.ok) {
    throw new Error('ルートデータの取得に失敗しました。')
  }
  const geojson = await routeResponse.json()
  const bbox = computeBoundingBox(geojson)
  const buffered = bufferBoundingBox(bbox, BUFFER_METERS)
  const tileUrls = listTileUrls(buffered, MIN_ZOOM, MAX_ZOOM)

  const cache = await caches.open(TILE_CACHE_NAME)
  let completed = 0
  onProgress?.({ completed: 0, total: tileUrls.length })

  const tasks = tileUrls.map((url) => async () => {
    const alreadyCached = await cache.match(url)
    if (!alreadyCached) {
      try {
        const tileResponse = await fetch(url)
        if (tileResponse.ok) {
          await cache.put(url, tileResponse)
        }
      } catch {
        // 個別タイルの取得失敗は無視して続行する
      }
    }
    completed += 1
    onProgress?.({ completed, total: tileUrls.length })
  })

  await runWithConcurrency(tasks, DOWNLOAD_CONCURRENCY)

  const status: OfflineMapStatus = {
    savedAt: new Date().toISOString(),
    tileCount: tileUrls.length,
  }
  localStorage.setItem(OFFLINE_STATUS_KEY, JSON.stringify(status))
  return status
}

export function getOfflineStatus(): OfflineMapStatus | null {
  const raw = localStorage.getItem(OFFLINE_STATUS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OfflineMapStatus
  } catch {
    return null
  }
}
