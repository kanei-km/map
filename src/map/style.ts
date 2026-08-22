import type { StyleSpecification } from 'maplibre-gl'

// 地理院タイル(淡色地図)。出典明示のみで利用可能、商用利用も可。
// 参考: 地理院タイル一覧 https://maps.gsi.go.jp/development/ichiran.html
export const mapStyle: StyleSpecification = {
  version: 8,
  sources: {
    gsi: {
      type: 'raster',
      tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 18,
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
    },
  },
  layers: [
    {
      id: 'gsi-tiles',
      type: 'raster',
      source: 'gsi',
    },
  ],
}

// 戦場ヶ原自然研究路(サンプルルート)周辺を初期表示地点とする。
export const INITIAL_CENTER: [number, number] = [139.446, 36.812]
export const INITIAL_ZOOM = 13

// 差し替え対象。実際のあるき道データが揃ったらこのファイルを置き換えるだけでよい。
export const ROUTE_URL = `${import.meta.env.BASE_URL}data/routes/sample-route.geojson`
export const ROUTE_SOURCE_ID = 'walking-route'
