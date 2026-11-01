/**
 * OSIRIS — Live transit on the map.
 *
 * Attached while the Live Buses & Transit layer is on, and it owns everything
 * it draws, the way the traffic layer does:
 *
 *   - zoomed out, a ring per transit system, sized by its fleet;
 *   - from zoom 5, every vehicle in view, coloured by mode (bus, tram, metro,
 *     train, ferry), moving between the places it reported (see
 *     transit-playback) and, close in, pointing where it is going;
 *   - a click on a vehicle selects it: a trail of where it has been this trip
 *     and a card that follows it and keeps its numbers current.
 *
 * The vehicles themselves are drawn on the GPU (transit-gl-layer), because
 * they move every frame; their route labels and the selected trail are
 * ordinary map layers refreshed a few times a second. Polling follows the
 * view: settled moves only, never while the tab is hidden.
 */
import type { GeoJSONSource, Map as MlMap, MapLayerMouseEvent, MapMouseEvent, Popup, PositionAnchor } from 'maplibre-gl';
import {
  TRANSIT_COLOR, TRANSIT_MODE_COLORS, TRANSIT_MODE_WORDS, TRANSIT_MODES, TRANSIT_POLL_MS, TRANSIT_VEHICLE_ZOOM,
  occupancyLabel, positionAge, viewBBox, type TransitFeedInfo, type TransitMode, type TransitVehicle,
} from './transit';
import {
  courseBetween, createPlayback, displayTimeFor, forgetFeedsOtherThan, ingest, metresBetween, motionOf, sampleAt, trailOf,
  updateCourse, type Sample, type Track,
} from './transit-playback';
import { TRANSIT_STRIDE, createTransitVehicleLayer, markerSize, packVehicle, rgb } from './transit-gl-layer';

export type TransitState = 'overview' | 'loading' | 'ready' | 'empty' | 'error';

export interface TransitStatus {
  state: TransitState;
  /** One line for the layer panel. */
  text: string;
}

export interface TransitLayerOptions {
  /**
   * Opens the map's one popup at a place, returning it so the layer can move
   * and refresh it. `anchor` is the side of the popup at the place; left out,
   * the map picks one that fits.
   */
  openPopup: (lngLat: [number, number], html: string, anchor?: PositionAnchor) => Popup;
  onStatus?: (status: TransitStatus) => void;
  /** The map's layers that have click handlers of their own: a click on one of them is not a vehicle's. */
  clickableLayers?: ReadonlySet<string>;
}

const SRC_LABELS = 'transit-labels';
const SRC_COVERAGE = 'transit-coverage';
const SRC_TRAIL = 'transit-trail';
const GL_LAYER = 'transit-vehicles';
export const TRANSIT_LAYER_IDS = [
  'transit-coverage-dots',
  'transit-coverage-label',
  'transit-trail',
  GL_LAYER,
  'transit-vehicle-icons',
  'transit-label',
];
const OWN_SOURCES = new Set([SRC_LABELS, SRC_COVERAGE, SRC_TRAIL]);
/** Vehicle icons visible from this zoom */
const ICON_ZOOM = 8.5;
/** Route labels with terminal & up/down indicators from this zoom */
const LABEL_ZOOM = 11.5;
const LABEL_REFRESH_MS = 150;
const TRAIL_REFRESH_MS = 100;
const SETTLE_MS = 350;
/** A click this close (px) to a vehicle selects it. */
const PICK_RADIUS_PX = 14;
/** Room (px) a vehicle card needs beside the vehicle: its size plus the popup's offset. */
const CARD_W = 440, CARD_H = 370;
const EMPTY = { type: 'FeatureCollection' as const, features: [] };

/**
 * 2D 정밀 차량 형상 캔버스 렌더러 (버스, 스마트 택시, KTX 고속철도, 수도권 지하철)
 * 상행선(Neon Cyan / Emerald)과 하행선(Neon Orange / Amber)을 시각적으로 명확히 분기
 */
function drawVehicleCanvas(mode: 'bus' | 'taxi' | 'rail' | 'metro', isUp: boolean, size = 48): { width: number; height: number; data: Uint8Array } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  const mainColor = isUp ? '#00E5FF' : '#FF9100'; // 상행 청록색, 하행 주황색
  const arrowChar = isUp ? '▲' : '▼';

  if (mode === 'bus') {
    // ── 버스 (BUS): 직사각형 차체, 곡면 전면유리, 승객 창문, 루프 공조기(A/C) ──
    const w = 22, h = 40, r = 5;
    const x0 = cx - w / 2, y0 = cy - h / 2;

    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 6;

    ctx.fillStyle = '#0B1526';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, w, h, r);
    else ctx.rect(x0, y0, w, h);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    // 전면 윈드실드 (상단 파노라마 유리)
    ctx.fillStyle = isUp ? '#38BDF8' : '#FDBA74';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0 + 2, y0 + 3, w - 4, 8, [4, 4, 1, 1]);
    else ctx.rect(x0 + 2, y0 + 3, w - 4, 8);
    ctx.fill();

    // 측면 승객 창문 (좌우 3개씩)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let wy = y0 + 13; wy <= y0 + 25; wy += 6) {
      ctx.fillRect(x0 + 1.5, wy, 2.5, 4);
      ctx.fillRect(x0 + w - 4, wy, 2.5, 4);
    }

    // 후면 창문
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x0 + 3, y0 + h - 4, w - 6, 2.5);

    // 루프 에어컨/공조 유닛
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - 5, cy + 2, 10, 8, 2);
    else ctx.rect(cx - 5, cy + 2, 10, 8);
    ctx.fill();
    ctx.stroke();

    // 지붕 운행방향 인디케이터 (▲ / ▼)
    ctx.fillStyle = mainColor;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrowChar, cx, cy - 3);

    // 전면 헤드라이트 (상단 좌우 백색 LED)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x0 + 3, y0 + 1.5, 1.5, 0, Math.PI * 2);
    ctx.arc(x0 + w - 3, y0 + 1.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 후면 테일램프 (하단 적색)
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(x0 + 1, y0 + h - 2, 3, 1.5);
    ctx.fillRect(x0 + w - 4, y0 + h - 2, 3, 1.5);

  } else if (mode === 'taxi') {
    // ── 스마트 택시 (K-TAXI): 승용 세단 차체 + 루프 [TAXI] 캡 램프 ──
    const w = 20, h = 34;
    const x0 = cx - w / 2, y0 = cy - h / 2;

    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 5;

    // 택시 바디 (골든 옐로우 바디 + 상/하행 네온 테두리)
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(cx - 7, y0);
    ctx.lineTo(cx + 7, y0);
    ctx.quadraticCurveTo(cx + 9, y0 + 6, cx + 10, y0 + 10);
    ctx.lineTo(cx + 10, y0 + 24);
    ctx.quadraticCurveTo(cx + 9, y0 + 30, cx + 7, y0 + h);
    ctx.lineTo(cx - 7, y0 + h);
    ctx.quadraticCurveTo(cx - 9, y0 + 30, cx - 10, y0 + 24);
    ctx.lineTo(cx - 10, y0 + 10);
    ctx.quadraticCurveTo(cx - 9, y0 + 6, cx - 7, y0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    // 앞유리창
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(cx - 6, y0 + 8);
    ctx.lineTo(cx + 6, y0 + 8);
    ctx.lineTo(cx + 7, y0 + 13);
    ctx.lineTo(cx - 7, y0 + 13);
    ctx.closePath();
    ctx.fill();

    // 뒷유리창
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(cx - 7, y0 + 21);
    ctx.lineTo(cx + 7, y0 + 21);
    ctx.lineTo(cx + 6, y0 + 25);
    ctx.lineTo(cx - 6, y0 + 25);
    ctx.closePath();
    ctx.fill();

    // 사이드 미러
    ctx.fillStyle = mainColor;
    ctx.fillRect(cx - 11, y0 + 9, 2, 3);
    ctx.fillRect(cx + 9, y0 + 9, 2, 3);

    // 루프 TAXI 표시등 돔 램프 (가장 상징적인 택시 형상)
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - 6, cy - 2, 12, 5, 2.5);
    else ctx.rect(cx - 6, cy - 2, 12, 5);
    ctx.fill();
    ctx.stroke();

    // 보닛 위 방향 화살표 (▲ / ▼)
    ctx.fillStyle = mainColor;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrowChar, cx, y0 + 4);

  } else if (mode === 'rail') {
    // ── KTX/SRT 고속철도: 날렵한 유선형 탄환 노즈(Bullet Train) + 팬터그래프 ──
    const w = 18, h = 44;
    const x0 = cx - w / 2, y0 = cy - h / 2;

    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 7;

    // 플래티넘 실버 차체 + 유선형 앞코
    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, y0);
    ctx.quadraticCurveTo(cx + 8, y0 + 6, cx + 8, y0 + 16);
    ctx.lineTo(cx + 8, y0 + h);
    ctx.lineTo(cx - 8, y0 + h);
    ctx.lineTo(cx - 8, y0 + 16);
    ctx.quadraticCurveTo(cx - 8, y0 + 6, cx, y0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    // 조종실 유선형 윈드실드 바이저
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(cx, y0 + 6);
    ctx.lineTo(cx + 5, y0 + 13);
    ctx.lineTo(cx - 5, y0 + 13);
    ctx.closePath();
    ctx.fill();

    // 측면 초고속 스트림라인
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, y0 + 18);
    ctx.lineTo(cx - 5, y0 + h - 4);
    ctx.moveTo(cx + 5, y0 + 18);
    ctx.lineTo(cx + 5, y0 + h - 4);
    ctx.stroke();

    // 지붕 팬터그래프 집전 장치
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 4, y0 + 26);
    ctx.lineTo(cx + 4, y0 + 32);
    ctx.moveTo(cx + 4, y0 + 26);
    ctx.lineTo(cx - 4, y0 + 32);
    ctx.stroke();

    // 지붕 운행방향 인디케이터
    ctx.fillStyle = mainColor;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrowChar, cx, cy + 13);

  } else {
    // ── 수도권 전철/지하철 (METRO): 통근형 전동차 선두차 정면 마스크 ──
    const w = 22, h = 38, r = 4;
    const x0 = cx - w / 2, y0 = cy - h / 2;

    const metroAccent = isUp ? '#00E676' : '#FF9100'; // 내선순환/상행은 에메랄드 그린, 외선/하행은 앰버
    ctx.shadowColor = metroAccent;
    ctx.shadowBlur = 6;

    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = metroAccent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, w, h, r);
    else ctx.rect(x0, y0, w, h);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    // 운전실 대형 통유리창
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0 + 2.5, y0 + 3, w - 5, 10, [3, 3, 1, 1]);
    else ctx.rect(x0 + 2.5, y0 + 3, w - 5, 10);
    ctx.fill();

    // 비상 탈출용 중앙 출입문 분할선
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, y0 + 3);
    ctx.lineTo(cx, y0 + 13);
    ctx.stroke();

    // 루프 방열 그릴
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x0 + 4, y0 + 17, w - 8, 3);
    ctx.fillRect(x0 + 4, y0 + 23, w - 8, 3);

    // 운행방향 표시
    ctx.fillStyle = metroAccent;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrowChar, cx, cy + 11);

    // 전면 헤드라이트 (백색 LED)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x0 + 3, y0 + 1, 3, 2);
    ctx.fillRect(x0 + w - 6, y0 + 1, 3, 2);
  }

  const imgData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(imgData.data) };
}

/** 8가지 상·하행 차량 심볼 이미지를 맵에 사전 등록 */
function registerTransitIcons(map: MlMap): void {
  if (typeof document === 'undefined') return;
  const modes: ('bus' | 'taxi' | 'rail' | 'metro')[] = ['bus', 'taxi', 'rail', 'metro'];
  const dirs = [true, false];

  for (const mode of modes) {
    for (const isUp of dirs) {
      const id = `transit-icon-${mode}-${isUp ? 'up' : 'down'}`;
      if (!map.hasImage(id)) {
        try {
          const img = drawVehicleCanvas(mode, isUp);
          if (img) map.addImage(id, img);
        } catch (e) {
          console.warn('[OSIRIS] Failed to register transit icon:', id, e);
        }
      }
    }
  }
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const safeUrl = (s: unknown) => (/^https?:\/\//i.test(String(s ?? '')) ? esc(s) : '#');
const count = (n: number) => n.toLocaleString('en-US');
const MODE_RGB = Object.fromEntries(TRANSIT_MODES.map(m => [m, rgb(TRANSIT_MODE_COLORS[m])])) as Record<TransitMode, [number, number, number]>;
const modeColor = ['match', ['get', 'mode'], ...TRANSIT_MODES.flatMap(m => [m, TRANSIT_MODE_COLORS[m]]), TRANSIT_MODE_COLORS.unknown] as unknown as string;

/** What the vehicle is called on its label: the route riders know, else the fleet number. */
function labelOf(v: TransitVehicle): string {
  return v.name ?? v.route ?? v.label ?? '';
}

/**
 * The popup anchor that opens a card ahead of a vehicle, given the screen
 * direction (degrees clockwise from up) back toward where it came from, so the
 * trail behind it stays in view.
 */
export function cardAnchor(behindDeg: number): 'top' | 'bottom' | 'left' | 'right' {
  const ahead = (((behindDeg + 180) % 360) + 360) % 360;
  if (ahead < 45 || ahead >= 315) return 'bottom'; // card above
  if (ahead < 135) return 'left';                  // card to the right
  if (ahead < 225) return 'top';                   // card below
  return 'right';                                  // card to the left
}

/** Frames per second worth drawing at a zoom: a bus moves a fraction of a pixel a second regionally. */
export function framesPerSecond(zoom: number): number {
  return zoom >= 12 ? 30 : zoom >= 9 ? 15 : 5;
}

export function attachTransit(map: MlMap, opts: TransitLayerOptions): () => void {
  let disposed = false;
  const pb = createPlayback();
  const feeds = new Map<string, TransitFeedInfo>();
  const vehicleLayer = createTransitVehicleLayer(GL_LAYER);
  let buffer = new Float32Array(1024 * TRANSIT_STRIDE);
  /** What was drawn last frame, for picking: key and position. */
  let drawnKeys: string[] = [];
  let drawnLngLat = new Float64Array(0);
  let coverageLoaded = false;
  let inflight: AbortController | undefined;
  let settle: ReturnType<typeof setTimeout> | undefined;
  let frame: number | undefined;
  let lastFrameAt = 0;
  let labelsAt = 0;
  let trailAt = 0;
  let selected: string | null = null;
  let popup: Popup | null = null;
  let popupRefreshedAt = 0;
  let lastStatus = '';
  let overviewText = 'Zoom in to a city to see its vehicles';

  const hidden = () => typeof document !== 'undefined' && document.hidden;
  const report = (state: TransitState, text: string) => {
    if (disposed || `${state}|${text}` === lastStatus) return;
    lastStatus = `${state}|${text}`;
    opts.onStatus?.({ state, text });
  };
  const source = (id: string) => map.getSource(id) as GeoJSONSource | undefined;

  // ── Sources and layers ──
  registerTransitIcons(map);
  for (const id of OWN_SOURCES) map.addSource(id, { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'transit-coverage-dots', type: 'circle', source: SRC_COVERAGE, maxzoom: TRANSIT_VEHICLE_ZOOM, paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'vehicles'], 0, 3, 100, 5, 1000, 9, 5000, 13],
    'circle-color': TRANSIT_COLOR, 'circle-opacity': 0.18,
    'circle-stroke-color': TRANSIT_COLOR, 'circle-stroke-width': 1.2, 'circle-stroke-opacity': 0.85,
  } });
  map.addLayer({ id: 'transit-coverage-label', type: 'symbol', source: SRC_COVERAGE, minzoom: 3.5, maxzoom: TRANSIT_VEHICLE_ZOOM, layout: {
    'text-field': ['get', 'name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
    'text-offset': [0, 1.3], 'text-allow-overlap': false,
  }, paint: { 'text-color': TRANSIT_COLOR, 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.85 } });
  map.addLayer({ id: 'transit-trail', type: 'line', source: SRC_TRAIL, minzoom: TRANSIT_VEHICLE_ZOOM,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': modeColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 15, 4], 'line-opacity': 0.75 } });
  map.addLayer(vehicleLayer);
  map.addLayer({
    id: 'transit-vehicle-icons',
    type: 'symbol',
    source: SRC_LABELS,
    minzoom: ICON_ZOOM,
    layout: {
      'icon-image': ['get', 'iconId'],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': [
        'interpolate', ['linear'], ['zoom'],
        8.5, 0.65,
        11, 0.8,
        13.5, 0.95,
        16, 1.15,
        18, 1.35,
      ],
    },
  });
  map.addLayer({
    id: 'transit-label',
    type: 'symbol',
    source: SRC_LABELS,
    minzoom: LABEL_ZOOM,
    layout: {
      'text-field': ['get', 'displayLabel'],
      'text-size': 9.5,
      'text-font': ['Open Sans Bold'],
      'text-offset': [0, 2.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-max-width': 18,
    },
    paint: {
      'text-color': ['get', 'textColor'],
      'text-halo-color': '#000000',
      'text-halo-width': 1.6,
    },
  });

  // ── The selected vehicle's card ──
  const cardHtml = (track: Track, nowMs: number): string => {
    const v = track.record;
    const feed = feeds.get(v.f);
    const mode = track.mode as TransitMode;
    const color = TRANSIT_MODE_COLORS[mode];
    const dT = displayTimeFor(track, nowMs);
    const s = sampleAt(track, dT);
    const motion = motionOf(track, s, nowMs, dT);
    const lagS = Math.round((nowMs - dT) / 1000);
    const where = feed ? [feed.region, feed.country].filter(Boolean).join(', ') : '';
    const routeText = v.name && v.route && v.name !== v.route ? `${esc(v.name)} <span style="color:#5C5A54;">(${esc(v.route)})</span>` : esc(v.name ?? v.route ?? '');
    const motionKo = motion === 'en route' ? '운행 중' : motion === 'stopped' ? '정류장 정차' : motion === 'waiting' ? '신호 대기' : '수신 지연';
    
    const dirKo = v.dir === 'inner'
      ? '내선순환 (시계방향 ↻)'
      : v.dir === 'outer'
      ? '외선순환 (반시계방향 ↺)'
      : v.dir === 'up'
      ? '상행선 (기점 ➔ 종점 ▲)'
      : v.dir === 'down'
      ? '하행선 (종점 ➔ 기점 ▼)'
      : undefined;

    const destKo = v.dirLabel && v.dirLabel.includes('➔')
      ? v.dirLabel.split('➔')[1]?.trim()
      : undefined;

    const cell = (label: string, value: string | undefined, raw = false) => value
      ? `<div><span style="color:#5C5A54;">${label}</span><br/><span style="color:#E8E6E0;font-family:monospace;">${raw ? value : esc(value)}</span></div>` : '';
    const cells = [
      cell('노선 (ROUTE)', routeText, true),
      cell('차량번호', v.label ?? v.id),
      cell('운행 방향', dirKo),
      cell('행선지 (방면)', destKo),
      cell('운행상태', motionKo),
      cell('운행 속도', v.s !== undefined ? `${Math.round(v.s * 3.6)} km/h` : undefined),
      cell('진행 방위각', track.course !== undefined ? `${Math.round(track.course)}°` : undefined),
      cell('잔여 좌석', occupancyLabel(v.occ)),
      cell('위치 갱신', positionAge(v.t, nowMs)),
      cell('수신 좌표수', `${track.fixes.length}개`),
    ].join('');

    const dirBadge = v.dir === 'inner'
      ? ' [내선순환 ↻]'
      : v.dir === 'outer'
      ? ' [외선순환 ↺]'
      : v.dir === 'up'
      ? ' [상행 ▲]'
      : v.dir === 'down'
      ? ' [하행 ▼]'
      : '';

    const word = TRANSIT_MODE_WORDS[mode].toUpperCase();
    return `<div style="background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;border:1px solid ${color}55;min-width:240px;">
      <div style="color:${color};font-size:12px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid ${color}33;padding-bottom:6px;margin-bottom:8px;">${word}${dirBadge}${labelOf(v) ? ` · ${esc(labelOf(v))}` : ''}</div>
      <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:2px;">${esc(feed?.provider ?? '대중교통 운용사')}</div>
      ${where ? `<div style="color:#8A8880;font-size:9.5px;margin-bottom:8px;">${esc(where)}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;">${cells}</div>
      <div style="font-size:8.5px;color:#8A8880;line-height:1.45;">국토교통부 TAGO 및 운용사 실시간 GPS 관제 피드입니다. 실제 정밀 도로망 축선을 추적하며 지도상에 정확히 표시됩니다.</div>
      ${feed?.license ? `<a href="${safeUrl(feed.license)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;color:${color};border:1px solid ${color}40;background:${color}15;">[ 국토부 데이터 규약 ↗ ]</a>` : ''}
    </div>`;
  };

  const deselect = () => {
    selected = null;
    source(SRC_TRAIL)?.setData(EMPTY);
  };

  // ── Drawing ──
  const draw = (nowMs: number) => {
    const b = map.getBounds();
    // A margin, so vehicles do not pop in at the edge as the map is dragged.
    const padLng = (b.getEast() - b.getWest()) * 0.15, padLat = (b.getNorth() - b.getSouth()) * 0.15;
    const w = b.getWest() - padLng, e = b.getEast() + padLng, s = b.getSouth() - padLat, n = b.getNorth() + padLat;
    if (buffer.length < pb.tracks.size * TRANSIT_STRIDE) buffer = new Float32Array(Math.ceil(pb.tracks.size * 1.5) * TRANSIT_STRIDE);
    if (drawnLngLat.length < pb.tracks.size * 2) drawnLngLat = new Float64Array(Math.ceil(pb.tracks.size * 1.5) * 2);
    const keys: string[] = [];
    const wantIcons = map.getZoom() >= ICON_ZOOM;
    const wantLabels = map.getZoom() >= LABEL_ZOOM;
    const features: any[] = [];
    let selectedTrack: Track | undefined;
    let selectedAt: [number, number] | undefined;
    let i = 0;
    for (const track of pb.tracks.values()) {
      const sample = sampleAt(track, displayTimeFor(track, nowMs));
      const isSel = track.key === selected;
      if (!isSel && (sample.lng < w || sample.lng > e || sample.lat < s || sample.lat > n)) continue;
      const course = updateCourse(track, sample, nowMs);
      packVehicle(buffer, i, sample.lng, sample.lat, MODE_RGB[track.mode], course, isSel);
      drawnLngLat[i * 2] = sample.lng;
      drawnLngLat[i * 2 + 1] = sample.lat;
      keys.push(track.key);
      i++;

      if (wantIcons) {
        const v = track.record;
        const mode = (v.mode || track.mode) as TransitMode;
        const isUp = v.dir ? (v.dir === 'up' || v.dir === 'inner') : true;

        let iconMode: 'bus' | 'taxi' | 'rail' | 'metro' = 'bus';
        if (mode === 'taxi') iconMode = 'taxi';
        else if (mode === 'rail') iconMode = 'rail';
        else if (mode === 'metro') iconMode = 'metro';
        else iconMode = 'bus';

        const iconId = `transit-icon-${iconMode}-${isUp ? 'up' : 'down'}`;
        const bearing = course !== undefined && course >= 0 ? course : (v.b ?? 0);
        const displayLabel = wantLabels ? (v.dirLabel || labelOf(v)) : '';
        const textColor = isUp ? (iconMode === 'metro' ? '#00E676' : '#00E5FF') : '#FF9100';

        features.push({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [sample.lng, sample.lat] },
          properties: {
            iconId,
            bearing,
            displayLabel,
            textColor,
            mode,
            isUp,
          },
        });
      }

      if (isSel) { selectedTrack = track; selectedAt = [sample.lng, sample.lat]; }
    }
    drawnKeys = keys;
    vehicleLayer.setVehicles(buffer, map.getZoom() >= ICON_ZOOM ? 0 : i);

    if (wantIcons) {
      if (nowMs - labelsAt >= LABEL_REFRESH_MS) {
        source(SRC_LABELS)?.setData({ type: 'FeatureCollection', features });
        labelsAt = nowMs;
      }
    } else if (labelsAt) {
      source(SRC_LABELS)?.setData(EMPTY);
      labelsAt = 0;
    }

    if (selected && !selectedTrack) {
      // It left the feed; the card says so rather than pointing at nothing.
      popup?.setHTML(`<div style="padding:14px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#8A8880;">This vehicle is no longer in its operator's feed.</div>`);
      deselect();
    } else if (selectedTrack && selectedAt) {
      if (nowMs - trailAt >= TRAIL_REFRESH_MS) {
        source(SRC_TRAIL)?.setData({ type: 'FeatureCollection', features: [{
          type: 'Feature', geometry: { type: 'LineString', coordinates: trailOf(selectedTrack, sampleAt(selectedTrack, displayTimeFor(selectedTrack, nowMs))) }, properties: { mode: selectedTrack.mode },
        }] });
        trailAt = nowMs;
      }
      if (popup) {
        popup.setLngLat(selectedAt);
        if (nowMs - popupRefreshedAt > 1000) { popup.setHTML(cardHtml(selectedTrack, nowMs)); popupRefreshedAt = nowMs; }
      }
    }
  };

  const tick = (now: number) => {
    frame = undefined;
    if (disposed || hidden()) return;
    if (map.getZoom() >= TRANSIT_VEHICLE_ZOOM && pb.tracks.size && now - lastFrameAt >= 1000 / framesPerSecond(map.getZoom())) {
      lastFrameAt = now;
      draw(Date.now());
    }
    frame = requestAnimationFrame(tick);
  };
  const startFrames = () => { if (frame === undefined && !disposed) frame = requestAnimationFrame(tick); };

  // ── Polling ──
  const loadCoverage = async () => {
    try {
      const res = await fetch('/api/transit?coverage=1');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { feeds: list } = await res.json();
      if (disposed) return;
      coverageLoaded = true;
      source(SRC_COVERAGE)?.setData({ type: 'FeatureCollection', features: (list ?? []).map((f: { center: number[]; core: number[]; region: string; provider: string; vehicles: number }) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: f.center },
        properties: { name: f.region || f.provider, vehicles: f.vehicles, core: JSON.stringify(f.core) },
      })) });
      overviewText = `${count(list.length)} transit systems live · zoom in to a city`;
      if (map.getZoom() < TRANSIT_VEHICLE_ZOOM) report('overview', overviewText);
    } catch {
      report('error', 'Transit coverage unavailable');
    }
  };

  const loadVehicles = async () => {
    const b = map.getBounds();
    const [w, s, e, n] = viewBBox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth());
    inflight?.abort();
    const ctrl = new AbortController();
    inflight = ctrl;
    if (!pb.tracks.size) report('loading', 'Loading vehicles…');
    try {
      const res = await fetch(`/api/transit?bbox=${w.toFixed(4)},${s.toFixed(4)},${e.toFixed(4)},${n.toFixed(4)}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (disposed || ctrl.signal.aborted) return;
      const covering = new Set<string>();
      for (const f of data.feeds ?? []) { feeds.set(f.id, f); covering.add(f.id); }
      forgetFeedsOtherThan(pb, covering);
      ingest(pb, data.vehicles ?? [], Date.now());
      labelsAt = 0;
      draw(Date.now());
      startFrames();

      const live = (data.feeds ?? []).filter((f: { count: number }) => f.count > 0);
      const failing = (data.feeds ?? []).filter((f: { ok: boolean }) => !f.ok).length;
      if (!(data.feeds ?? []).length) report('empty', 'No live transit feed covers this view');
      else if (!data.vehicles?.length) report('empty', failing ? `${failing} feed${failing === 1 ? '' : 's'} here not answering` : 'No vehicles running here right now');
      else {
        const names = live.sort((a: { count: number }, c: { count: number }) => c.count - a.count).slice(0, 3).map((f: { provider: string }) => f.provider.replace(/\s*\(.*\)$/, ''));
        const more = live.length > 3 ? ` +${live.length - 3}` : '';
        report('ready', `${count(data.vehicles.length)} vehicles · ${names.join(', ')}${more}${failing ? ` · ${failing} not answering` : ''}`);
      }
    } catch (err) {
      if (ctrl.signal.aborted || disposed) return;
      console.warn('[OSIRIS] Transit unavailable:', err);
      report('error', 'Transit feeds unavailable');
    }
  };

  const load = () => {
    if (disposed || hidden()) return;
    if (map.getZoom() < TRANSIT_VEHICLE_ZOOM) {
      // Zoomed out: drop the vehicles, show the systems.
      if (pb.tracks.size) {
        forgetFeedsOtherThan(pb, new Set());
        vehicleLayer.setVehicles(buffer, 0);
        drawnKeys = [];
        source(SRC_LABELS)?.setData(EMPTY);
        deselect();
        popup?.remove();
      }
      if (coverageLoaded) report('overview', overviewText);
      else void loadCoverage();
    } else void loadVehicles();
  };
  const onMoveEnd = () => { clearTimeout(settle); settle = setTimeout(load, SETTLE_MS); };
  const onVisibility = () => { if (!hidden()) { load(); startFrames(); } };

  // ── Interaction ──
  /** The drawn vehicle nearest a screen point, within PICK_RADIUS_PX. */
  const pick = (x: number, y: number): string | null => {
    let best: string | null = null;
    // At least PICK_RADIUS_PX, more once the markers grow at street level.
    const radius = Math.max(PICK_RADIUS_PX, markerSize(map.getZoom()) * 1.8);
    let bestD = radius * radius;
    for (let i = 0; i < drawnKeys.length; i++) {
      const p = map.project([drawnLngLat[i * 2], drawnLngLat[i * 2 + 1]]);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = drawnKeys[i]; }
    }
    return best;
  };
  /** Another OSIRIS layer's feature under the point wins the click; the basemap does not. */
  /** Ahead of the vehicle when there is room there, so its trail is not under its own card. */
  const anchorFor = (track: Track, sample: Sample): PositionAnchor | undefined => {
    const from = trailOf(track, sample).find(([lng, lat]) => metresBetween({ lng, lat }, sample) >= 20);
    if (!from) return undefined;
    const anchor = cardAnchor(courseBetween(sample, { lng: from[0], lat: from[1] }) - map.getBearing());
    const p = map.project([sample.lng, sample.lat]);
    const { clientWidth: w, clientHeight: h } = map.getCanvas();
    const room = { bottom: p.y, top: h - p.y, left: w - p.x, right: p.x }[anchor];
    return room >= (anchor === 'top' || anchor === 'bottom' ? CARD_H : CARD_W) ? anchor : undefined;
  };

  // Only layers that take clicks themselves count. Any GeoJSON feature used to:
  // the night shade is one, so wherever it was night no vehicle could be clicked.
  const otherLayerHere = (ev: MapMouseEvent) => {
    const layers = [...(opts.clickableLayers ?? [])].filter(id => !TRANSIT_LAYER_IDS.includes(id) && map.getLayer(id));
    return layers.length > 0 && map.queryRenderedFeatures(ev.point, { layers }).length > 0;
  };

  const onClick = (ev: MapMouseEvent) => {
    if (map.getZoom() < TRANSIT_VEHICLE_ZOOM || !drawnKeys.length || otherLayerHere(ev)) return;
    const key = pick(ev.point.x, ev.point.y);
    const track = key ? pb.tracks.get(key) : undefined;
    if (!track) return;
    const sample = sampleAt(track, displayTimeFor(track, Date.now()));
    // Opening this card closes the one before, whose close handler deselects;
    // so the new selection is set only after it has run.
    const next = opts.openPopup([sample.lng, sample.lat], cardHtml(track, Date.now()), anchorFor(track, sample));
    popup = next;
    selected = key!;
    popupRefreshedAt = Date.now();
    trailAt = 0;
    next.on('close', () => { if (popup === next) { popup = null; deselect(); } });
    draw(Date.now());
  };
  let hoverAt = 0;
  const onMove = (ev: MapMouseEvent) => {
    const now = performance.now();
    if (now - hoverAt < 80 || map.getZoom() < TRANSIT_VEHICLE_ZOOM || !drawnKeys.length) return;
    hoverAt = now;
    const over = pick(ev.point.x, ev.point.y) !== null;
    const canvas = map.getCanvas();
    if (over) canvas.style.cursor = 'pointer';
    else if (canvas.style.cursor === 'pointer' && !otherLayerHere(ev)) canvas.style.cursor = '';
  };
  const onCoverageClick = (ev: MapLayerMouseEvent) => {
    try {
      const [w, s, e, n] = JSON.parse(String(ev.features?.[0]?.properties?.core));
      map.fitBounds([[w, s], [e, n]], { padding: 40, maxZoom: 12, duration: 1800, essential: true });
    } catch { /* malformed area: stay put */ }
  };
  const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
  const onLeave = () => { map.getCanvas().style.cursor = ''; };

  map.on('click', onClick);
  map.on('mousemove', onMove);
  map.on('click', 'transit-coverage-dots', onCoverageClick);
  map.on('mouseenter', 'transit-coverage-dots', onEnter);
  map.on('mouseleave', 'transit-coverage-dots', onLeave);
  map.on('moveend', onMoveEnd);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  const poll = setInterval(() => { if (!hidden() && map.getZoom() >= TRANSIT_VEHICLE_ZOOM) void loadVehicles(); }, TRANSIT_POLL_MS);

  load();

  return () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(settle);
    clearInterval(poll);
    if (frame !== undefined) cancelAnimationFrame(frame);
    inflight?.abort();
    popup?.remove();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    map.off('click', onClick);
    map.off('mousemove', onMove);
    map.off('click', 'transit-coverage-dots', onCoverageClick);
    map.off('mouseenter', 'transit-coverage-dots', onEnter);
    map.off('mouseleave', 'transit-coverage-dots', onLeave);
    map.off('moveend', onMoveEnd);
    map.getCanvas().style.cursor = '';
    // The style may already be gone when the whole map is being torn down.
    try {
      for (const id of TRANSIT_LAYER_IDS) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of OWN_SOURCES) if (map.getSource(id)) map.removeSource(id);
    } catch { /* map removed */ }
  };
}
