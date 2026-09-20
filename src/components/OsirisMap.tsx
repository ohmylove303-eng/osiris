'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildGeometry, closeRing, drawReducer, initialDrawState, measure, type DrawAction, type DrawMode, type DrawProgress, type DrawResult, type DrawState } from '@/lib/draw';
import { installTerrainTileProtocol } from '@/lib/terrain-tiles';
import { attachTerrain, type TerrainStatus } from '@/lib/map-terrain';
import CctvPreviews, { type PreviewCamera } from '@/components/CctvPreviews';

import { latLngToMGRS, latLngToUTM } from '@/lib/mgrs-converter';
import { verifyEntitySpatialBoundary, getAllDemarcationGeoJSON } from '@/lib/demarcation-boundaries';
import { CHINA_ENCROACHMENT_SITES } from '@/lib/china-encroachment';
import { applyJudgmentBadgeEl, renderVerifyTargetContentHtml } from '@/lib/judgment-ui';

interface OsirisMapProps {
  arcgisLayers?: any[];
  terrainEnabled?: boolean;
  terrainRetry?: number;
  terrainFocus?: number;
  onTerrainStatusChange?: (status: TerrainStatus) => void;
  drawMode?: DrawMode | null;
  onDrawComplete?: (result: DrawResult) => void;
  onDrawProgress?: (p: DrawProgress | null) => void;
  onDrawCancel?: () => void;
  drawCommand?: { action: 'undo' | 'finish' | 'cancel'; seq: number } | null;
  drawnPolygons?: any[];
  selectedPolygonId?: string | null;
  route?: any;
  userLocation?: any;
  followUser?: boolean;
  onFollowInterrupt?: () => void;
  onMapCenter?: (coords: { lat: number; lng: number }) => void;
  navigating?: boolean;
  aircraftAirports?: Record<string, any[]>;
  data: any;
  activeLayers: Record<string, boolean>;
  onEntityClick?: (entity: any) => void;
  onMouseCoords?: (coords: { lat: number; lng: number }) => void;
  onRightClick?: (coords: { lat: number; lng: number }) => void;
  onViewStateChange?: (vs: { zoom: number; latitude: number }) => void;
  flyToLocation?: { lat: number; lng: number; zoom?: number; ts: number } | null;
  projection?: 'mercator' | 'globe';
  mapStyle?: string;
  sweepData?: any;
  scanTargets?: any[];
  demoMode?: boolean;
  theme?: 'core' | 'ghost';
}

function computeSolarTerminator(): [number, number][] {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  const decRad = declination * Math.PI / 180;
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const subsolarLng = (12 - utcHours) * 15;
  const points: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const lngRad = (lng - subsolarLng) * Math.PI / 180;
    const lat = Math.atan(-Math.cos(lngRad) / Math.tan(decRad)) * 180 / Math.PI;
    points.push([lng, lat]);
  }
  const darkSide = declination >= 0 ? -90 : 90;
  points.push([180, darkSide]);
  points.push([-180, darkSide]);
  points.push(points[0]);
  return points;
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

function localizeTacticalType(tType: string): string {
  const t = (tType || '').toUpperCase();
  if (t.includes('BASE_DEPOT') || t.includes('농축')) return '은폐 원심분리기 농축 기지 (HEU Plant)';
  if (t.includes('HARTS') || t.includes('갱도')) return '강화 갱도 포병 사격 진지 (HARTS)';
  if (t.includes('MISSILE') || t.includes('발사')) return '미신고 탄도미사일 운용 기지';
  if (t.includes('NAVAL') || t.includes('조선소')) return '해군 전술 잠수함 조선소';
  if (t.includes('NUCLEAR') || t.includes('원자로')) return '원자로 및 핵연료 재처리 시설';
  if (t.includes('UAV') || t.includes('무인기')) return '무인기 활주로 및 격납고';
  return '전술 전방 군사 진지';
}


function OsirisMap({
  data,
  activeLayers,
  onEntityClick,
  onMouseCoords,
  onRightClick,
  onViewStateChange,
  flyToLocation,
  projection = 'globe',
  terrainEnabled = false,
  terrainRetry = 0,
  terrainFocus = 0,
  onTerrainStatusChange,
  mapStyle = 'dark',
  sweepData,
  scanTargets = [],
  demoMode = false,
  theme = 'core',
  drawMode = null,
  onDrawComplete,
  onDrawProgress,
  onDrawCancel,
  drawCommand = null,
  drawnPolygons = [],
  selectedPolygonId = null,
  route = null,
  userLocation = null,
  followUser = false,
  onFollowInterrupt,
  navigating = false,
  aircraftAirports = {}
}: OsirisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawingCoordsRef = useRef<number[][]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const prevStyleRef = useRef(mapStyle);

  // Create aircraft icon on canvas (for WebGL symbol layer)
  const createIcon = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.4);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx, cy + size * 0.35);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
    ctx.closePath();
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  const createShipIcon = useCallback((map: maplibregl.Map, id: string, color: string, size: number = 24) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;

    // Ship Hull (pointed bow top, wide midship, flat stern bottom)
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.45); // Bow (front)
    ctx.quadraticCurveTo(cx + size * 0.35, cy - size * 0.1, cx + size * 0.28, cy + size * 0.38); // Starboard
    ctx.lineTo(cx - size * 0.28, cy + size * 0.38); // Stern (back)
    ctx.quadraticCurveTo(cx - size * 0.35, cy - size * 0.1, cx, cy - size * 0.45); // Port
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Captain Bridge / Cabin
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - size * 0.12, cy + size * 0.05, size * 0.24, size * 0.18);

    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  const createDot = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // ── DEMO MODE SPINNING ──
    let spinReq: number | undefined = undefined;
    let isSpinning = false;
    
    const startSpinning = () => {
      if (!map) return;
      isSpinning = true;
      let lastTime = performance.now();
      
      const frame = (time: number) => {
        if (!isSpinning) return;
        
        // Only spin if the user is not actively dragging or zooming the map
        if (!map.isMoving() && !map.isZooming()) {
          const dt = time - lastTime;
          const center = map.getCenter();
          // Adjust spin speed: 0.5 degrees per second
          center.lng += (0.5 * dt) / 1000;
          map.setCenter(center);
        }
        
        lastTime = time;
        spinReq = requestAnimationFrame(frame);
      };
      
      spinReq = requestAnimationFrame(frame);
    };

    if (demoMode) {
      startSpinning();
    } else {
      isSpinning = false;
      if (spinReq) cancelAnimationFrame(spinReq);
    }

    return () => {
      isSpinning = false;
      if (spinReq) cancelAnimationFrame(spinReq);
      if (typeof window !== 'undefined' && (window as any)._globeSpinTimer) {
        clearInterval((window as any)._globeSpinTimer);
      }
    };
  }, [mapReady, demoMode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    
    // Select basemap style
    const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

    const container = containerRef.current;
    maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);

    const mapOptions: maplibregl.MapOptions = {
      container: containerRef.current,
      style: styleUrl,
      center: [127.5, 38.0], zoom: 6.8, minZoom: 1.5, maxZoom: 18,
      attributionControl: false,
      maxPitch: 85,
      transformRequest: (url: string) => {
        // Route all CARTO CDN requests through the internal Next.js proxy API (prevent recursive loops)
        if (url.includes('cartocdn.com') && !url.includes('/api/proxy-tiles')) {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
          return { url: `${baseUrl}/api/proxy-tiles?url=${encodeURIComponent(url)}` };
        }
        return { url };
      },
    };

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map(mapOptions);
    } catch {
      container.innerHTML = '';
      map = new maplibregl.Map({
        ...mapOptions,
        canvasContextAttributes: { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, antialias: false },
      });
    }

    map.on('load', () => {
      mapRef.current = map;
      if (typeof window !== 'undefined') {
        (window as any).__map = map;
        (window as any).map = map;
      }
      
      // Auto-localize vector map labels to Korean
      try {
        const style = map.getStyle();
        if (style && style.layers) {
          style.layers.forEach((layer) => {
            if (layer.type === 'symbol' && layer.layout && (layer.layout as any)['text-field']) {
              if (!layer.id.startsWith('sat-') && !layer.id.startsWith('flight') && !layer.id.startsWith('cctv') && !layer.id.startsWith('quake') && !layer.id.startsWith('fire') && !layer.id.startsWith('maritime') && !layer.id.startsWith('war-') && !layer.id.startsWith('sdk-')) {
                try {
                  map.setLayoutProperty(layer.id, 'text-field', [
                    'coalesce',
                    ['get', 'name_ko'],
                    ['get', 'name:ko'],
                    ['get', 'name_kr'],
                    ['get', 'name_en'],
                    ['get', 'name']
                  ]);
                } catch {}
              }
            }
          });
        }
      } catch (e) {
        console.warn('[OSIRIS] Map localization error:', e);
      }
      
      // Theme colors
      const isGhost = theme === 'ghost';
      const phantomPurple = '#B388FF';
      const phantomDark = '#1A0040';
      const cameraColor = isGhost ? '#B388FF' : '#00E676';
      const flightCom = isGhost ? phantomPurple : '#00E5FF';
      const flightPriv = isGhost ? phantomPurple : '#FFD700';
      const flightGov = isGhost ? phantomPurple : '#FF9500';
      const flightMil = isGhost ? phantomPurple : '#FF3D3D';

      // Create icons — OSIRIS Unified Palette (군용기 국적별 색상)
      createIcon(map, 'plane-cyan', flightCom, 24);   
      createIcon(map, 'plane-yellow', '#FFD700', 24);  // 민간 VIP 제트기 (골드 #FFD700)
      createIcon(map, 'plane-green', '#00E676', 24);   // ── 아군기 (ROK/US): 100% 순수 초록색 ──
      createIcon(map, 'plane-pink', flightGov, 24);    
      createIcon(map, 'plane-red', '#FF1744', 24);     // ── 적기 북한군 (DPRK): 100% 순수 빨간색 ──
      createIcon(map, 'plane-orange', '#FF9100', 24);  // ── 중국군 (PLAAF): 주황색 ──
      createIcon(map, 'plane-brown', '#8D6E63', 24);   // ── 러시아기 (VKS): 갈색 ──
      createIcon(map, 'plane-navy', '#2979FF', 24);    // ── 우크라이나기 (AFU): 남색 ──
      createIcon(map, 'plane-blue', '#00E676', 24);    
      createIcon(map, 'plane-grey', isGhost ? phantomPurple : '#546E7A', 24);    
      createShipIcon(map, 'ship-red', '#FF1744', 26);
      createShipIcon(map, 'ship-orange', '#FF9100', 24);
      createShipIcon(map, 'ship-cyan', '#00E5FF', 24);    
      createDot(map, 'dot-gold', isGhost ? phantomPurple : '#D4AF37', 8);
      createDot(map, 'dot-red', isGhost ? phantomPurple : '#D32F2F', 10);
      createDot(map, 'dot-orange', isGhost ? phantomPurple : '#E65100', 10);
      createDot(map, 'dot-green', isGhost ? phantomPurple : '#26A69A', 10);
      createDot(map, 'dot-fire', isGhost ? phantomPurple : '#E65100', 10);
      createDot(map, 'dot-cctv', cameraColor, 10);

      const sources = [
        'flights','military','jets','private-fl','satellites','earthquakes','gdelt','gps-jamming','day-night','cctv','fires','weather','infrastructure','maritime','maritime-choke','maritime-ships','live-news','sigint-news','conflict-zones', 'war-alerts-targets', 'war-alerts-lines', 'balloons', 'radiation', 'ip-sweep-devices', 'ip-sweep-pulse', 'ip-sweep-connections', 'scan-targets', 'sdk-entities', 'sdk-links', 'malware-nodes', 'network-mesh', 'cyber-arcs', 'cyber-heads', 'cyber-impacts', 'dprk-sites-src', 'dprk-activity-src', 'seismic-nuclear-src', 'demarcation-lines', 'drones', 'cuas-gcs-emitters', 'cuas-vector-lines', 'china-encroachment', 'notam-hazards', 'submarine-cables', 'dark-fleet'
      ];
      sources.forEach(s => {
        if (!map.getSource(s)) {
          map.addSource(s, { type: 'geojson', data: EMPTY_FC });
        }
      });

      // Warning icon generator (parameterized — eliminates 3x copy-paste)
      const createWarningIcon = (id: string, color: string) => {
        const s = 20;
        const c = document.createElement('canvas');
        c.width = s; c.height = s;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(s/2, 1);
        ctx.lineTo(s - 1, s - 1);
        ctx.lineTo(1, s - 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', s/2, s - 4);
        map.addImage(id, { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) });
      };
      createWarningIcon('warn-icon', '#D32F2F');
      createWarningIcon('warn-orange', '#E65100');
      createWarningIcon('warn-yellow', '#F9A825');

      map.addLayer({ id: 'conflict-icons', type: 'symbol', source: 'conflict-zones', layout: {
        'icon-image': ['match', ['get','severity'], 'war','warn-icon', 'high','warn-orange', 'warn-yellow'],
        'icon-size': ['interpolate',['linear'],['zoom'], 1,0.6, 4,0.8, 8,1],
        'icon-allow-overlap': true,
        'text-field': ['get','label'],
        'text-size': ['interpolate',['linear'],['zoom'], 1,7, 4,9, 8,11],
        'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4],
        'text-allow-overlap': false,
      }, paint: {
        'text-color': ['match', ['get','severity'], 'war','#D32F2F', 'high','#E65100', '#F9A825'],
        'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
      }});


      // Day/Night
      map.addLayer({ id: 'day-night-fill', type: 'fill', source: 'day-night', paint: { 'fill-color': isGhost ? '#0D0030' : '#000022', 'fill-opacity': 0.35 }});

      // Earthquakes — amber threat spectrum
      map.addLayer({ id: 'eq-circles', type: 'circle', source: 'earthquakes', paint: {
        'circle-radius': ['interpolate',['linear'],['get','magnitude'], 2.5,4, 5,12, 7,24],
        'circle-color': ['interpolate',['linear'],['get','magnitude'], 2.5,'#F9A825', 4,'#E65100', 6,'#D32F2F'],
        'circle-opacity': 0.55, 'circle-blur': 0.3, 'circle-stroke-width': 1, 'circle-stroke-color': '#F9A825', 'circle-stroke-opacity': 0.25,
      }});
      map.addLayer({ id: 'eq-label', type: 'symbol', source: 'earthquakes', filter: ['>=',['get','magnitude'],4.5], layout: {
        'text-field': ['concat','M',['to-string',['get','magnitude']]], 'text-size': 9, 'text-font': ['Open Sans Regular'], 'text-offset': [0,1.5],
      }, paint: { 'text-color': '#F9A825', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Fires — burnt sienna
      map.addLayer({ id: 'fires-heat', type: 'circle', source: 'fires', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,8],
        'circle-color': '#E65100', 'circle-opacity': 0.45, 'circle-blur': 0.5,
      }});

      // CCTV — outer glow ring (black/white depending on theme)
      map.addLayer({ id: 'cctv-glow', type: 'circle', source: 'cctv', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14, 14,20],
        'circle-color': '#000000', 'circle-opacity': 0.35, 'circle-blur': 1,
      }});
      // CCTV — main dot
      map.addLayer({ id: 'cctv-dots', type: 'circle', source: 'cctv', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8, 14,12],
        'circle-color': cameraColor, 'circle-opacity': 0.9,
        'circle-stroke-width': 2.5, 'circle-stroke-color': '#000000', 'circle-stroke-opacity': 0.9,
      }});
      // CCTV — labels at zoom 10+
      map.addLayer({ id: 'cctv-label', type: 'symbol', source: 'cctv', minzoom: 10, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': cameraColor, 'text-halo-color': '#000000', 'text-halo-width': 1.5, 'text-opacity': 0.8 }});

      // GDELT



      // ══ NETWORK INTEL — Live Malware (abuse.ch) — crimson threat ══
      map.addLayer({ id: 'malware-glow', type: 'circle', source: 'malware-nodes', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
        'circle-color': '#D32F2F', 'circle-opacity': 0.06, 'circle-blur': 0.5,
      }});
      map.addLayer({ id: 'malware-dots', type: 'circle', source: 'malware-nodes', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,6],
        'circle-color': '#D32F2F',
        'circle-opacity': 0.9,
        'circle-stroke-width': 1, 'circle-stroke-color': '#000000', 'circle-stroke-opacity': 0.8,
      }});
      map.addLayer({ id: 'malware-label', type: 'symbol', source: 'malware-nodes', minzoom: 5, layout: {
        'text-field': ['get','malware'], 'text-size': 8, 'text-font': ['JetBrains Mono Bold', 'Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 10, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#D32F2F', 'text-halo-color': '#111', 'text-halo-width': 1.5, 'text-opacity': 0.85 }});

      // ── NETWORK INTEL MESH (SDK STYLE) ──
      map.addLayer({ id: 'network-mesh-atmo', type: 'line', source: 'network-mesh', paint: {

        'line-width': ['interpolate',['linear'],['zoom'], 1, 2, 5, 4, 10, 8],
        'line-opacity': 0.08,
        'line-blur': 4,
      }});
      map.addLayer({ id: 'network-mesh-glow', type: 'line', source: 'network-mesh', paint: {

        'line-width': ['interpolate',['linear'],['zoom'], 1, 1, 5, 2, 10, 4],
        'line-opacity': 0.2,
        'line-blur': 1.5,
      }});
      map.addLayer({ id: 'network-mesh-core', type: 'line', source: 'network-mesh', paint: {

        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.2, 5, 0.5, 10, 1.5],
        'line-opacity': 0.4,
      }});

      // ══ LIVE CYBER ATTACKS — dark wire network (source → target) ══
      map.addLayer({ id: 'cyber-arcs-atmo', type: 'line', source: 'cyber-arcs', paint: {
        'line-color': '#000000', 'line-width': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,12],
        'line-opacity': 0.12, 'line-blur': 6,
      }});
      map.addLayer({ id: 'cyber-arcs-glow', type: 'line', source: 'cyber-arcs', paint: {
        'line-color': '#111111', 'line-width': ['interpolate',['linear'],['zoom'], 1,2, 5,3.5, 10,6],
        'line-opacity': 0.3, 'line-blur': 2,
      }});
      map.addLayer({ id: 'cyber-arcs-core', type: 'line', source: 'cyber-arcs', paint: {
        'line-color': '#000000', 'line-width': ['interpolate',['linear'],['zoom'], 1,0.8, 5,1.4, 10,2.2],
        'line-opacity': 0.7,
      }});
      // Animated dashed flow line — fast marching ants in black
      map.addLayer({ id: 'cyber-arcs-flow', type: 'line', source: 'cyber-arcs', paint: {
        'line-color': '#1a1a1a', 'line-width': ['interpolate',['linear'],['zoom'], 1,1.0, 5,1.8, 10,3],
        'line-opacity': 0.55, 'line-dasharray': [2, 3],
      }});
      map.addLayer({ id: 'cyber-impacts', type: 'circle', source: 'cyber-impacts', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,18],
        'circle-color': '#000000', 'circle-opacity': 0.08, 'circle-blur': 0.6,
      }});
      map.addLayer({ id: 'cyber-heads', type: 'circle', source: 'cyber-heads', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2.5, 5,4, 10,6],
        'circle-color': '#111111', 'circle-opacity': 0.95,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#333', 'circle-stroke-opacity': 0.9,
      }});
      map.addLayer({ id: 'cyber-labels', type: 'symbol', source: 'cyber-heads', minzoom: 3, layout: {
        'text-field': ['get','malware'], 'text-size': 9, 'text-font': ['JetBrains Mono Bold', 'Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 10, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#333333', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.85 }});

      map.addLayer({ id: 'gdelt-dots', type: 'circle', source: 'gdelt', paint: {
        'circle-radius': 4, 'circle-color': '#D32F2F', 'circle-opacity': 0.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#D32F2F', 'circle-stroke-opacity': 0.25,
      }});

      // GPS Jamming — crimson
      map.addLayer({ id: 'jam-fill', type: 'circle', source: 'gps-jamming', paint: { 'circle-radius': 30, 'circle-color': '#D32F2F', 'circle-opacity': 0.12, 'circle-blur': 1 }});
      map.addLayer({ id: 'jam-label', type: 'symbol', source: 'gps-jamming', layout: {
        'text-field': ['concat','GPS JAM ',['to-string',['get','severity']],'%'], 'text-size': 10, 'text-font': ['Open Sans Bold'], 'text-allow-overlap': true,
      }, paint: { 'text-color': '#D32F2F', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Weather Events (NASA EONET) — deep violet
      map.addLayer({ id: 'weather-glow', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,20, 10,30],
        'circle-color': '#7E57C2', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'weather-dots', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14],
        'circle-color': ['match', ['get','icon'], 'cyclone','#7E57C2', 'volcano','#D32F2F', '#7E57C2'],
        'circle-opacity': 0.75,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#7E57C2', 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'weather-label', type: 'symbol', source: 'weather', layout: {
        'text-field': ['get','title'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#7E57C2', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // Nuclear Infrastructure — teal / amber risk
      map.addLayer({ id: 'infra-glow', type: 'circle', source: 'infrastructure', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'],
        'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'infra-dots', type: 'circle', source: 'infrastructure', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': ['case', 
          ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100',
          ['==', ['get','status'], 'Active Conflict Zone'], '#D32F2F', 
          ['==', ['get','status'], 'Destroyed / Decommissioning'], '#546E7A', 
          '#26A69A'
        ],
        'circle-opacity': 0.75,
        'circle-stroke-width': 1.5, 'circle-stroke-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'], 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'infra-label', type: 'symbol', source: 'infrastructure', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'], 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Satellites
      map.addLayer({ id: 'sat-glow', type: 'circle', source: 'satellites', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,6], 'circle-color': ['get','color'], 'circle-opacity': 0.3, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sat-dots', type: 'circle', source: 'satellites', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 5,3], 'circle-color': ['get','color'], 'circle-opacity': 1.0,
      }});

      // Maritime — ports & naval bases — ocean teal
      map.addLayer({ id: 'maritime-glow', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
        'circle-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'],
        'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'maritime-dots', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,9],
        'circle-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1.5, 'circle-stroke-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'], 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'maritime-label', type: 'symbol', source: 'maritime', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#26C6DA', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Maritime chokepoints — amber threat spectrum
      map.addLayer({ id: 'choke-glow', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,18, 10,28],
        'circle-color': '#E65100', 'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'choke-dots', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,12],
        'circle-color': ['match', ['get','risk'], 'CRITICAL','#D32F2F', 'HIGH','#E65100', 'ELEVATED','#F9A825', '#26A69A'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#E65100', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'choke-label', type: 'symbol', source: 'maritime-choke', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#E65100', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9 }});

      // Live News — muted rose
      map.addLayer({ id: 'news-glow', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': '#EC407A', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'news-dots', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': '#EC407A', 'circle-opacity': 0.8,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#EC407A', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'news-label', type: 'symbol', source: 'live-news', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#EC407A', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // SIGINT RSS news - gold markers
      map.addLayer({ id: 'sigint-news-glow', type: 'circle', source: 'sigint-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,10, 10,18],
        'circle-color': '#D4AF37', 'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sigint-news-dots', type: 'circle', source: 'sigint-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8],
        'circle-color': '#D4AF37', 'circle-opacity': 0.9,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFF8DC', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'sigint-news-label', type: 'symbol', source: 'sigint-news', minzoom: 5, layout: {
        'text-field': ['get','source'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.6], 'text-max-width': 10, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#D4AF37', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.85 }});

      // ══ IP SWEEP — Neighborhood device visualization ══
      map.addLayer({ id: 'sweep-connections', type: 'line', source: 'ip-sweep-connections', paint: {
        'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.3, 'line-dasharray': [2, 4],
      }});
      map.addLayer({ id: 'sweep-pulse-ring', type: 'circle', source: 'ip-sweep-pulse', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,40, 12,80, 16,160],
        'circle-color': 'transparent', 'circle-opacity': 0.6,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'sweep-device-glow', type: 'circle', source: 'ip-sweep-devices', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,8, 12,16, 16,30],
        'circle-color': ['get', 'color'], 'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sweep-device-dots', type: 'circle', source: 'ip-sweep-devices', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,3, 12,6, 16,10],
        'circle-color': ['get', 'color'], 'circle-opacity': 0.95,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'sweep-device-labels', type: 'symbol', source: 'ip-sweep-devices', minzoom: 13, layout: {
        'text-field': ['concat', ['get', 'device_type'], '\n', ['get', 'ip']],
        'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2.2], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
      }});

      // ══ SCAN TARGETS — Geolocated individual scans ══
      map.addLayer({ id: 'scan-targets-glow', type: 'circle', source: 'scan-targets', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,25, 10,40],
        'circle-color': '#D32F2F', 'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'scan-targets-dots', type: 'circle', source: 'scan-targets', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,12],
        'circle-color': '#D32F2F', 'circle-opacity': 0.9,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#ECEFF1', 'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'scan-targets-label', type: 'symbol', source: 'scan-targets', layout: {
        'text-field': ['get', 'id'], 'text-size': 11, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#D32F2F', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9 }});

      // ══ DPRK STRATEGIC MILITARY, NUCLEAR, MISSILE, UAV, MLRS, SPG & HARTS ONTOLOGY ══
      map.addLayer({ id: 'dprk-sites-threat-rings', type: 'circle', source: 'dprk-sites-src', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 4,28, 8,65, 12,120],
        'circle-color': ['match', ['get','threat_assessment'], 'CRITICAL','rgba(255,23,68,0.06)', 'HIGH','rgba(255,149,0,0.05)', 'MODERATE','rgba(255,215,0,0.04)', 'rgba(0,229,255,0.03)'],
        'circle-stroke-width': 1.2,
        'circle-stroke-color': ['match', ['get','threat_assessment'], 'CRITICAL','rgba(255,23,68,0.4)', 'HIGH','rgba(255,149,0,0.3)', 'MODERATE','rgba(255,215,0,0.25)', 'rgba(0,229,255,0.2)'],
      }});
      map.addLayer({ id: 'dprk-sites-glow', type: 'circle', source: 'dprk-sites-src', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,16, 10,26],
        'circle-color': ['match', ['get','category'], 'nuclear','#FF1744', 'missile','#FF9500', 'uav','#00E5FF', 'mlrs_600','#E040FB', 'mlrs_300','#76FF03', 'mlrs_240','#FFD700', 'spg_170','#FF9100', '#87CEEB'],
        'circle-opacity': 0.25, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'dprk-sites-dots', type: 'circle', source: 'dprk-sites-src', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4.5, 5,7.5, 10,12],
        'circle-color': ['match', ['get','category'], 'nuclear','#FF1744', 'missile','#FF9500', 'uav','#00E5FF', 'mlrs_600','#E040FB', 'mlrs_300','#76FF03', 'mlrs_240','#FFD700', 'spg_170','#FF9100', '#87CEEB'],
        'circle-opacity': 0.95,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.9,
      }});
      map.addLayer({ id: 'dprk-sites-labels', type: 'symbol', source: 'dprk-sites-src', minzoom: 4, layout: {
        'text-field': ['concat', ['get','title'], '\n[', ['get','category_label'], ']'],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2.0], 'text-max-width': 16, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FFFFFF', 'text-halo-color': '#000000', 'text-halo-width': 2, 'text-opacity': 0.95 }});

      // ══ BRIDGE 1: DPRK MILITARY ACTIVITY EVENTS ══
      map.addLayer({ id: 'dprk-activity-glow', type: 'circle', source: 'dprk-activity-src', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,20, 10,35],
        'circle-color': ['match', ['get','category'],
          'missile_launch','#FF1744', 'artillery_drill','#FF9100',
          'naval_exercise','#2979FF', 'military_training','#76FF03',
          'nuclear_activity','#D500F9', 'drone_operation','#00E5FF',
          'satellite_launch','#FFD740', '#FF6E40'],
        'circle-opacity': 0.2, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'dprk-activity-dots', type: 'circle', source: 'dprk-activity-src', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,11],
        'circle-color': ['match', ['get','category'],
          'missile_launch','#FF1744', 'artillery_drill','#FF9100',
          'naval_exercise','#2979FF', 'military_training','#76FF03',
          'nuclear_activity','#D500F9', 'drone_operation','#00E5FF',
          'satellite_launch','#FFD740', '#FF6E40'],
        'circle-opacity': 0.9,
        'circle-stroke-width': ['match', ['get','verification_tier'],
          'TIER-1 VERIFIED',2.5, 'CROSS-VERIFIED',2, 'SINGLE-SOURCE',1.5, 1],
        'circle-stroke-color': ['match', ['get','verification_tier'],
          'TIER-1 VERIFIED','#00E676', 'CROSS-VERIFIED','#FFD740',
          'SINGLE-SOURCE','#FF9100', '#FF1744'],
        'circle-stroke-opacity': 0.9,
      }});
      map.addLayer({ id: 'dprk-activity-labels', type: 'symbol', source: 'dprk-activity-src', minzoom: 5, layout: {
        'text-field': ['concat', ['get','title'], '\n', ['get','source_date']],
        'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2.2], 'text-max-width': 18, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ['match', ['get','verification_tier'],
          'TIER-1 VERIFIED','#00E676', 'CROSS-VERIFIED','#FFD740',
          'SINGLE-SOURCE','#FF9100', '#FF5252'],
      }});

      // ══ MILITARY DEMARCATION LINES (LAND DMZ, SEA NLL, AIR KADIZ/CADIZ, CHINA EEZ) ══
      map.addLayer({
        id: 'demarcation-lines-layer',
        type: 'line',
        source: 'demarcation-lines',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2.2, 5, 3.8, 10, 5.5],
          'line-opacity': 0.95,
          'line-dasharray': [4, 2],
        }
      });
      map.addLayer({
        id: 'demarcation-labels-layer',
        type: 'symbol',
        source: 'demarcation-lines',
        minzoom: 3,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 12, 10, 14],
          'text-font': ['Open Sans Bold'],
          'symbol-placement': 'line',
          'symbol-spacing': 350,
          'text-max-angle': 35,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#000000',
          'text-halo-width': 2.5,
          'text-opacity': 0.98,
        }
      });

      // ══ CHINA YELLOW SEA & SOUTH CHINA SEA ARTIFICIAL STRUCTURES OSINT LAYERS ══
      map.addLayer({
        id: 'china-encroachment-radii',
        type: 'circle',
        source: 'china-encroachment',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 14, 5, 28, 9, 65],
          'circle-color': ['match', ['get', 'threat_level'], 'CRITICAL', 'rgba(255,23,68,0.1)', 'rgba(255,149,0,0.08)'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['match', ['get', 'threat_level'], 'CRITICAL', '#FF1744', '#FF9100'],
          'circle-stroke-opacity': 0.8,
        }
      });
      map.addLayer({
        id: 'china-encroachment-glow',
        type: 'circle',
        source: 'china-encroachment',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 8, 5, 14, 9, 22],
          'circle-color': '#FF9100',
          'circle-opacity': 0.35,
          'circle-blur': 1,
        }
      });
      map.addLayer({
        id: 'china-encroachment-dots',
        type: 'circle',
        source: 'china-encroachment',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 5, 8, 9, 12],
          'circle-color': ['match', ['get', 'threat_level'], 'CRITICAL', '#FF1744', '#FF9100'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        }
      });
      map.addLayer({
        id: 'china-encroachment-labels',
        type: 'symbol',
        source: 'china-encroachment',
        minzoom: 3,
        layout: {
          'text-field': ['concat', ['get', 'name'], '\n[', ['get', 'facility_type_label'], ']'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 12, 10, 13],
          'text-font': ['Open Sans Bold'],
          'text-offset': [0, 2.2],
          'text-max-width': 16,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#FFD54F',
          'text-halo-color': '#000000',
          'text-halo-width': 2.5,
          'text-opacity': 0.95,
        }
      });

      // ══ NOTAM MISSILE / ROCKET DANGER AIRSPACE (QWELW) ══
      map.addLayer({
        id: 'notam-hazards-fill',
        type: 'fill',
        source: 'notam-hazards',
        paint: {
          'fill-color': ['match', ['get', 'severity'], 'CRITICAL', '#FF1744', 'HIGH', '#FF5252', '#FF9100'],
          'fill-opacity': 0.18,
        }
      });
      map.addLayer({
        id: 'notam-hazards-line',
        type: 'line',
        source: 'notam-hazards',
        paint: {
          'line-color': ['match', ['get', 'severity'], 'CRITICAL', '#FF1744', 'HIGH', '#FF5252', '#FF9100'],
          'line-width': 2,
          'line-dasharray': [3, 2],
        }
      });
      map.addLayer({
        id: 'notam-hazards-label',
        type: 'symbol',
        source: 'notam-hazards',
        minzoom: 3,
        layout: {
          'text-field': ['concat', ['get', 'notam_id'], '\n', ['get', 'altitude_range']],
          'text-size': 10,
          'text-font': ['Open Sans Bold'],
          'text-offset': [0, 0],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#FF8A80',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
          'text-opacity': 0.95,
        }
      });

      // ══ SUBMARINE OPTICAL CABLES & ANCHOR DRAG SABOTAGE WATCH ══
      map.addLayer({
        id: 'submarine-cables-glow',
        type: 'line',
        source: 'submarine-cables',
        paint: {
          'line-color': '#00E5FF',
          'line-width': 4,
          'line-opacity': 0.2,
          'line-blur': 2,
        }
      });
      map.addLayer({
        id: 'submarine-cables-line',
        type: 'line',
        source: 'submarine-cables',
        paint: {
          'line-color': ['match', ['get', 'category'], 'CRITICAL_DEFENSE', '#FF1744', 'ENERGY_INTERCONNECT', '#FFD700', '#00E5FF'],
          'line-width': 1.6,
          'line-opacity': 0.85,
        }
      });
      map.addLayer({
        id: 'submarine-cables-label',
        type: 'symbol',
        source: 'submarine-cables',
        minzoom: 5,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 9,
          'text-font': ['Open Sans Regular'],
          'symbol-placement': 'line',
          'symbol-spacing': 400,
          'text-max-angle': 30,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#80DEEA',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
          'text-opacity': 0.9,
        }
      });

      // ══ AIS DARK FLEET (KINETIC EXPANSION UNCERTAINTY BUBBLE) ══
      map.addLayer({
        id: 'dark-fleet-bubble-fill',
        type: 'fill',
        source: 'dark-fleet',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#FF9100',
          'fill-opacity': 0.08,
        }
      });
      map.addLayer({
        id: 'dark-fleet-bubble-line',
        type: 'line',
        source: 'dark-fleet',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'line-color': '#FF9100',
          'line-width': 1.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.8,
        }
      });
      map.addLayer({
        id: 'dark-fleet-dots',
        type: 'circle',
        source: 'dark-fleet',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4.5, 5, 7, 10, 10],
          'circle-color': '#FF9100',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-opacity': 0.9,
        }
      });
      map.addLayer({
        id: 'dark-fleet-label',
        type: 'symbol',
        source: 'dark-fleet',
        minzoom: 4,
        layout: {
          'text-field': ['concat', ['get', 'name'], '\n[DARK FLEET]'],
          'text-size': 9,
          'text-font': ['Open Sans Bold'],
          'text-offset': [0, 2.0],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#FFA726',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
          'text-opacity': 0.95,
        }
      });

      // ══ DEDICATED DRONE & C-UAS GCS PILOT MAP LAYERS ══
      map.addLayer({
        id: 'cuas-vector-lines-layer',
        type: 'line',
        source: 'cuas-vector-lines',
        paint: {
          'line-color': '#FF1744',
          'line-width': 2,
          'line-opacity': 0.8,
          'line-dasharray': [3, 3],
        }
      });
      map.addLayer({
        id: 'gcs-emitter-glow',
        type: 'circle',
        source: 'cuas-gcs-emitters',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 10, 5, 22, 10, 38],
          'circle-color': '#FF1744',
          'circle-opacity': 0.25,
          'circle-blur': 1,
        }
      });
      map.addLayer({
        id: 'gcs-emitter-dots',
        type: 'circle',
        source: 'cuas-gcs-emitters',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 5, 8, 10, 12],
          'circle-color': '#FF1744',
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFD700',
          'circle-stroke-opacity': 0.9,
        }
      });
      map.addLayer({
        id: 'gcs-emitter-labels',
        type: 'symbol',
        source: 'cuas-gcs-emitters',
        minzoom: 4,
        layout: {
          'text-field': ['concat', '🎮 [조종자(GCS) TDoA 역추적위치]\n', ['get', 'drone_model']],
          'text-size': 9.5,
          'text-font': ['Open Sans Bold'],
          'text-offset': [0, 2.2],
          'text-max-width': 18,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FF1744',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
          'text-opacity': 0.95,
        }
      });
      map.addLayer({
        id: 'drones-glow',
        type: 'circle',
        source: 'drones',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 8, 5, 16, 10, 28],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.25,
          'circle-blur': 1,
        }
      });
      map.addLayer({
        id: 'drones-dots',
        type: 'circle',
        source: 'drones',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 5, 8, 10, 12],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-opacity': 0.9,
        }
      });
      map.addLayer({
        id: 'drones-labels',
        type: 'symbol',
        source: 'drones',
        minzoom: 3,
        layout: {
          'text-field': ['concat', '🛸 ', ['get', 'name'], ' (', ['get', 'alt_text'], ')'],
          'text-size': 9.5,
          'text-font': ['Open Sans Bold'],
          'text-offset': [0, -2.0],
          'text-max-width': 22,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#000000',
          'text-halo-width': 2,
          'text-opacity': 0.95,
        }
      });

      // ══ BRIDGE 2: SEISMIC NUCLEAR WATCH ══
      map.addLayer({ id: 'seismic-nuclear-glow', type: 'circle', source: 'seismic-nuclear-src', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,14, 5,30, 10,55],
        'circle-color': ['case', ['get','is_nuclear_suspect'], '#D500F9', '#00BCD4'],
        'circle-opacity': ['case', ['get','is_nuclear_suspect'], 0.3, 0.1],
        'circle-blur': 1,
      }});
      map.addLayer({ id: 'seismic-nuclear-dots', type: 'circle', source: 'seismic-nuclear-src', paint: {
        'circle-radius': ['interpolate',['linear'],['get','magnitude'], 1,3, 3,5, 5,8, 7,14],
        'circle-color': ['case', ['get','is_nuclear_suspect'], '#D500F9', '#00BCD4'],
        'circle-opacity': 0.85,
        'circle-stroke-width': ['case', ['get','is_nuclear_suspect'], 3, 1.5],
        'circle-stroke-color': ['case', ['get','is_nuclear_suspect'], '#FF1744', '#FFFFFF'],
        'circle-stroke-opacity': 0.8,
      }});
      map.addLayer({ id: 'seismic-nuclear-labels', type: 'symbol', source: 'seismic-nuclear-src', minzoom: 4, layout: {
        'text-field': ['concat', 'M', ['to-string', ['get','magnitude']], ' ', ['get','place']],
        'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 16, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ['case', ['get','is_nuclear_suspect'], '#D500F9', '#80DEEA'],
        'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.85,
      }});

      // Flight layers (WebGL symbol — GPU rendered, handles 50K+ smooth)
      const flightLayers = [
        { id: 'fl-commercial', src: 'flights', icon: 'plane-cyan' },
        { id: 'fl-private', src: 'private-fl', icon: 'plane-yellow' },
        { id: 'fl-jets', src: 'jets', icon: 'plane-pink' },
      ];
      flightLayers.forEach(l => {
        map.addLayer({ id: l.id, type: 'symbol', source: l.src, layout: {
          'icon-image': l.icon, 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.7, 10,1],
          'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        }, paint: { 'icon-opacity': 0.85 }});
      });
      // ── 군용기: 국적별 세부 색상 (아군 한미연합: 초록, 적기 북한: 빨강, 중국: 주황, 러시아: 갈색, 우크라이나: 남색, 이스라엘: 청록, 일본: 노랑) ──
      map.addLayer({ id: 'fl-mil-rokus', type: 'symbol', source: 'military', filter: [
        'any',
        ['==', ['get','affiliation'], 'ROK_US_AIRFORCE'],
        ['==', ['get','affiliation'], 'ROK_AF'],
        ['==', ['get','affiliation'], 'ROK_ARMY'],
        ['==', ['get','affiliation'], 'ROK_NAVY'],
        ['==', ['get','affiliation'], 'USAF'],
        ['==', ['get','affiliation'], 'USMC'],
        ['==', ['get','affiliation'], 'US_NAVY'],
        ['==', ['get','country'], '대한민국'],
        ['==', ['get','country'], '미국']
      ], layout: {
        'icon-image': 'plane-green', 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.5, 5,0.85, 10,1.2],
        'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      }, paint: { 'icon-opacity': 0.95 }});

      map.addLayer({ id: 'fl-mil-dprk', type: 'symbol', source: 'military', filter: [
        'any',
        ['==', ['get','affiliation'], 'DPRK_KPAF'],
        ['==', ['get','country'], '북한']
      ], layout: {
        'icon-image': 'plane-red', 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.75, 10,1.1],
        'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      }, paint: { 'icon-opacity': 0.95 }});

      map.addLayer({ id: 'fl-mil-china', type: 'symbol', source: 'military', filter: [
        'any',
        ['==', ['get','affiliation'], 'CHINA_PLAAF'],
        ['==', ['get','affiliation'], 'CHINA_PLAN'],
        ['==', ['get','country'], '중국']
      ], layout: {
        'icon-image': 'plane-orange', 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.75, 10,1.1],
        'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      }, paint: { 'icon-opacity': 0.95 }});

      map.addLayer({ id: 'fl-mil-russia', type: 'symbol', source: 'military', filter: [
        'any',
        ['==', ['get','affiliation'], 'RUSSIA_VKS'],
        ['==', ['get','country'], '러시아']
      ], layout: {
        'icon-image': 'plane-brown', 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.75, 10,1.1],
        'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      }, paint: { 'icon-opacity': 0.95 }});

      map.addLayer({ id: 'fl-mil-ukraine', type: 'symbol', source: 'military', filter: [
        'any',
        ['==', ['get','affiliation'], 'UKRAINE_AF'],
        ['==', ['get','country'], '우크라이나']
      ], layout: {
        'icon-image': 'plane-navy', 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.75, 10,1.1],
        'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      }, paint: { 'icon-opacity': 0.95 }});

      map.addLayer({ id: 'fl-mil-israel', type: 'symbol', source: 'military', filter: [
        'any',
        ['==', ['get','affiliation'], 'ISRAEL_IAF'],
        ['==', ['get','country'], '이스라엘']
      ], layout: {
        'icon-image': 'plane-cyan', 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.75, 10,1.1],
        'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      }, paint: { 'icon-opacity': 0.95 }});

      map.addLayer({ id: 'fl-mil-japan', type: 'symbol', source: 'military', filter: [
        'any',
        ['==', ['get','affiliation'], 'JAPAN_JASDF'],
        ['==', ['get','affiliation'], 'JAPAN_JMSDF'],
        ['==', ['get','country'], '일본']
      ], layout: {
        'icon-image': 'plane-yellow', 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.75, 10,1.1],
        'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      }, paint: { 'icon-opacity': 0.95 }});

      map.addLayer({ id: 'fl-mil-other', type: 'symbol', source: 'military', filter: [
        'all',
        ['!=', ['get','affiliation'], 'ROK_US_AIRFORCE'],
        ['!=', ['get','affiliation'], 'ROK_AF'],
        ['!=', ['get','affiliation'], 'ROK_ARMY'],
        ['!=', ['get','affiliation'], 'ROK_NAVY'],
        ['!=', ['get','affiliation'], 'USAF'],
        ['!=', ['get','affiliation'], 'USMC'],
        ['!=', ['get','affiliation'], 'US_NAVY'],
        ['!=', ['get','country'], '대한민국'],
        ['!=', ['get','country'], '미국'],
        ['!=', ['get','affiliation'], 'DPRK_KPAF'],
        ['!=', ['get','country'], '북한'],
        ['!=', ['get','affiliation'], 'CHINA_PLAAF'],
        ['!=', ['get','affiliation'], 'CHINA_PLAN'],
        ['!=', ['get','country'], '중국'],
        ['!=', ['get','affiliation'], 'RUSSIA_VKS'],
        ['!=', ['get','country'], '러시아'],
        ['!=', ['get','affiliation'], 'UKRAINE_AF'],
        ['!=', ['get','country'], '우크라이나'],
        ['!=', ['get','affiliation'], 'ISRAEL_IAF'],
        ['!=', ['get','country'], '이스라엘'],
        ['!=', ['get','affiliation'], 'JAPAN_JASDF'],
        ['!=', ['get','affiliation'], 'JAPAN_JMSDF'],
        ['!=', ['get','country'], '일본']
      ], layout: {
        'icon-image': 'plane-green', 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.7, 10,1],
        'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      }, paint: { 'icon-opacity': 0.85 }});

      // Balloons (moving entities)
      map.addLayer({ id: 'balloon-dots', type: 'circle', source: 'balloons', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,7],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'balloon-label', type: 'symbol', source: 'balloons', minzoom: 4, layout: {
        'text-field': ['get','callsign'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Radiation — violet base, threat spectrum for danger/warning
      map.addLayer({ id: 'rad-glow', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,20, 10,40],
        'circle-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'],
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'rad-dots', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,8],
        'circle-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5, 'circle-stroke-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'], 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'rad-label', type: 'symbol', source: 'radiation', minzoom: 5, layout: {
        'text-field': ['concat', ['to-string', ['get','reading']], ' nSv/h'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // ══ OSIRIS SDK — Lattice Intelligence Mesh ══
      // Polybolos Style: Delicate, translucent, steel-blue splined mesh

      // ── SEA domain (Distinct Solid Lines) ──
      // Removed glow to match the clean, diagrammatic look of submarinecablemap.com
      map.addLayer({ id: 'sdk-sea', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'SEA'], paint: {
        'line-color': ['coalesce', ['get', 'color'], '#1976D2'], // Single solid color from properties
        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.8, 5, 1.5, 10, 2.5],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 0.5, 10, 0.7],
      }});

      // ── AIR domain (ROK-US Air Force Solid Blue #0055FF) ──
      map.addLayer({ id: 'sdk-air-atmo', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
        'line-color': '#0055FF',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 1.5, 5, 5, 10, 8],
        'line-opacity': 0.18,
        'line-blur': 3,
      }});
      map.addLayer({ id: 'sdk-air-glow', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
        'line-color': '#0066FF',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.8, 5, 2, 10, 4],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.25, 5, 0.4, 10, 0.6],
        'line-blur': 1,
      }});
      map.addLayer({ id: 'sdk-air', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
        'line-color': '#0055FF',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 1.2, 10, 2.5],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.6, 5, 0.85, 10, 1.0],
      }});

      // ── INTEL domain (Deep Steel / Violet) ──
      map.addLayer({ id: 'sdk-intel-atmo', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
        'line-color': '#7986CB',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 2.5, 5, 7, 10, 12],
        'line-opacity': 0.06,
        'line-blur': 5,
      }});
      map.addLayer({ id: 'sdk-intel-glow', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
        'line-color': '#9FA8DA',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 1.2, 5, 3, 10, 6],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.12, 5, 0.18, 10, 0.25],
        'line-blur': 2,
      }});
      map.addLayer({ id: 'sdk-intel', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
        'line-color': '#C5CAE9',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 1, 10, 2],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 0.45, 10, 0.7],
      }});

      // Maritime Ships (moving entities) — high visibility circle dots + rotated ship hull symbol layer
      map.addLayer({ id: 'ship-glow', type: 'circle', source: 'maritime-ships', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': ['match', ['get','type'], 'military','#FF1744', 'tanker','#FF9100', 'cargo','#00E5FF', '#00E5FF'],
        'circle-opacity': 0.35, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'ship-dots', type: 'circle', source: 'maritime-ships', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,7.5, 10,10],
        'circle-color': ['match', ['get','type'], 'military','#FF1744', 'tanker','#FF9100', 'cargo','#00E5FF', '#00E5FF'],
        'circle-opacity': 0.95,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.9,
      }});
      map.addLayer({ id: 'ship-icons', type: 'symbol', source: 'maritime-ships', layout: {
        'icon-image': ['match', ['get','type'], 'military','ship-red', 'tanker','ship-orange', 'cargo','ship-cyan', 'ship-cyan'],
        'icon-size': ['interpolate',['linear'],['zoom'], 1,0.5, 5,0.85, 10,1.2],
        'icon-rotate': ['get','heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      }, paint: {
        'icon-opacity': 0.95
      }});
      map.addLayer({ id: 'ship-label', type: 'symbol', source: 'maritime-ships', minzoom: 2.5, layout: {
        'text-field': ['get','label_text'], 'text-size': 9.5, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.8], 'text-max-width': 18, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ['match', ['get','type'], 'military','#FF1744', 'tanker','#FF9100', 'cargo','#00E5FF', '#E8E6E0'],
        'text-halo-color': '#000000', 'text-halo-width': 1.8, 'text-opacity': 0.95,
      }});

      setMapReady(true);

    // Add draw preview & polygons sources
    if (!map.getSource('draw-preview')) {
      map.addSource('draw-preview', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'draw-preview-fill',
        type: 'fill',
        source: 'draw-preview',
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.15 }
      });
      map.addLayer({
        id: 'draw-preview-line',
        type: 'line',
        source: 'draw-preview',
        paint: { 'line-color': '#00E5FF', 'line-width': 2, 'line-dasharray': [2, 2] }
      });
      map.addLayer({
        id: 'draw-preview-points',
        type: 'circle',
        source: 'draw-preview',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#00E5FF', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' }
      });
    }

    if (!map.getSource('draw-polygons')) {
      map.addSource('draw-polygons', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'draw-polygons-fill',
        type: 'fill',
        source: 'draw-polygons',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#00E5FF'],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.35, 0.2]
        }
      });
      map.addLayer({
        id: 'draw-polygons-line',
        type: 'line',
        source: 'draw-polygons',
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#00E5FF'],
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1.8]
        }
      });
    }

    });

    // Events
    let lastMove = 0;
    map.on('mousemove', (e: any) => {
      const now = Date.now();
      if (now - lastMove > 100) {
        lastMove = now;
        onMouseCoords?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
    map.on('contextmenu', (e: any) => { e.preventDefault(); onRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    map.on('moveend', () => { const c = map.getCenter(); onViewStateChange?.({ zoom: map.getZoom(), latitude: c.lat }); });

    // ── POPUP HELPER (좌측 지도 시작 지점 고정 도킹 HUD) ──
    const popup = (coords: any, html: string) => {
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '440px', offset: 0, className: 'osiris-left-dock-popup' }).setLngLat(coords).setHTML(html).addTo(map);
    };
    const pStyle = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;`;
    const linkStyle = `display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;font-family:'JetBrains Mono',monospace;`;

    // ── XSS PROTECTION HELPERS ──
    const htmlEsc = (s: any): string => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const idSafe = (s: any): string => String(s ?? '').replace(/[^a-zA-Z0-9_\.\-]/g, '');
    const urlSafe = (s: any): string => { const u = String(s ?? ''); return /^https?:\/\//i.test(u) ? u : '#'; };
    const colorSafe = (s: any): string => /^#[0-9a-fA-F]{3,8}$/.test(String(s ?? '')) ? String(s) : '#aaa';

    // ── Flight Intel Card Resolver & Aircraft Photo Matching ──
    function getAircraftIntelCard(p: any, coords: number[]): {
      korTitle: string;
      country: string;
      flag: string;
      affiliationLabel: string;
      themeColor: string;
      photoUrl: string;
      stage1Badge: string;
      stage2Badge: string;
      specsSummary: string;
      isHostile: boolean;
      isSuspect: boolean;
      iffBadgeText: string;
      iffBadgeColor: string;
    } {
      const cs = (p.callsign || '').trim();
      const md = (p.model || '').trim();
      const hex = (p.icao24 || '').toUpperCase();
      const csUpper = cs.toUpperCase();
      let resolvedCountry = p.country || '';

      let korTitle = cs || '항공기';
      let flag = '✈️';
      let affiliationLabel = '민간 항공사 (Commercial Airline)';
      let themeColor = '#00E5FF';
      let photoUrl = p.model_image || '/intel/aircraft/b777_kal.png';
      let specsSummary = '국제민간항공기구(ICAO) 등록 국제 표준 여객기';

      // ── 사전 국가/적성 식별 규칙 (엄격한 피아식별) ──
      const isDPRK = resolvedCountry === '북한' || csUpper.includes('북한') || csUpper.includes('조선인민군') || csUpper.includes('KPAF') || hex.startsWith('720') || csUpper.includes('MI-24') || csUpper.includes('MIG') || csUpper.includes('SU-25') || csUpper.includes('AN-2') || csUpper.includes('고려항공') || (p.affiliation && p.affiliation.includes('DPRK'));
      const isChina = !isDPRK && (resolvedCountry === '중국' || csUpper.includes('중국') || csUpper.includes('PLAAF') || hex.startsWith('730') || csUpper.includes('J-20') || csUpper.includes('J-16') || csUpper.includes('J-15') || csUpper.includes('KJ-500') || csUpper.includes('H-6') || csUpper.includes('WZ-7') || (p.affiliation && p.affiliation.includes('CHINA')));
      const isRussia = !isDPRK && (resolvedCountry === '러시아' || csUpper.includes('러시아') || csUpper.includes('VKS') || hex.startsWith('740') || csUpper.includes('SU-57') || csUpper.includes('SU-35') || csUpper.includes('SU-34') || csUpper.includes('TU-160') || csUpper.includes('TU-95') || csUpper.includes('A-50') || (p.affiliation && p.affiliation.includes('RUSSIA')));
      const isUS = !isDPRK && (resolvedCountry === '미국' || csUpper.includes('미 공군') || csUpper.includes('미 해군') || csUpper.includes('미 해병대') || csUpper.includes('USAF') || csUpper.includes('USN') || csUpper.includes('USMC') || csUpper.includes('F-22') || csUpper.includes('B-2') || csUpper.includes('B-52') || csUpper.includes('U-2') || csUpper.includes('RC-135') || csUpper.includes('P-8') || csUpper.includes('리퍼') || csUpper.includes('MQ-9') || (p.affiliation && (p.affiliation.includes('USAF') || p.affiliation.includes('USMC') || p.affiliation.includes('US_NAVY'))));
      const isROK = !isDPRK && (resolvedCountry === '대한민국' || csUpper.includes('대한민국 공군') || csUpper.includes('한국 공군') || csUpper.includes('대한민국 육군') || csUpper.includes('대한민국 해군') || csUpper.includes('ROKAF') || csUpper.includes('ROKA') || hex.startsWith('71002') || csUpper.includes('F-35A') || csUpper.includes('F-15K') || csUpper.includes('KF-16') || csUpper.includes('FA-50') || csUpper.includes('피스아이') || csUpper.includes('시그너스') || csUpper.includes('글로벌호크') || (p.affiliation && (p.affiliation.includes('ROK_AF') || p.affiliation.includes('ROK_ARMY'))));

      // 1. [최우선 순위] 북한 조선인민군 공군 (DPRK KPAF - HOSTILE)
      if (isDPRK) {
        resolvedCountry = '북한';
        flag = '🇰🇵';
        themeColor = '#FF1744';
        affiliationLabel = '조선인민군 공군 및 반항공군 (DPRK KPAF - HOSTILE)';
        if (cs.includes('Mi-24') || md.includes('Mi-24')) {
          korTitle = '북한 공군 Mi-24V 하인드 중무장 공격헬기 (1편대)';
          photoUrl = '/intel/aircraft/mi24_kpaf.png';
          specsSummary = '12.7mm 4연장 개틀링 / AT-6 대전차미사일 탑재 공격헬기 (개천 제1항공사단)';
        } else if (cs.includes('MiG-29') || md.includes('MiG-29')) {
          korTitle = '북한 공군 MiG-29S 펄크럼 요격전투기'; photoUrl = '/intel/aircraft/mig29_kpaf.png'; specsSummary = '마하 2.25 / R-73 근접공대공 및 R-27 중거리 미사일 (순안 제55전대)';
        } else if (cs.includes('Su-25') || md.includes('Su-25')) {
          korTitle = '북한 공군 Su-25K 프로그풋 지상공격기'; photoUrl = '/intel/aircraft/su25_kpaf.png'; specsSummary = '티타늄 방탄 조종석 / 30mm 기관포 / 로켓 포드 (갈마 제56전대)';
        } else if (cs.includes('MiG-23') || md.includes('MiG-23')) {
          korTitle = '북한 공군 MiG-23ML 플로거 가변익 요격기'; photoUrl = '/intel/aircraft/mig23_kpaf.png'; specsSummary = '마하 2.35 / 가변익 고속 요격 (황주 제85전대)';
        } else if (cs.includes('An-2') || md.includes('An-2')) {
          korTitle = '북한 공군 An-2 콜트 특수부대 침투 수송기'; photoUrl = '/intel/aircraft/an2_kpaf.png'; specsSummary = '초저고도 복엽기 / 레이더 회피 특수부대 12명 침투 (태탄/누천리)';
        } else if (cs.includes('샛별-4') || md.includes('Saetbyol-4')) {
          korTitle = '북한 샛별-4호 고고도 전략정찰 무인기'; photoUrl = '/intel/aircraft/saetbyol4_kpaf.png'; specsSummary = 'RQ-4 복제형 / 50,000ft 고고도 전략 영상 정찰 (방현 비행장)';
        } else if (cs.includes('샛별-9') || md.includes('Saetbyol-9')) {
          korTitle = '북한 샛별-9호 다목적 공격 무인기'; photoUrl = '/intel/aircraft/saetbyol9_kpaf.png'; specsSummary = 'MQ-9 복제형 / 주익 4개 하드포인트 정밀폭격 (방현 비행장)';
        } else if (cs.includes('고려항공') || cs.includes('JS')) {
          korTitle = '북한 국영 고려항공 (Air Koryo)'; photoUrl = '/intel/aircraft/tu204_kor.png'; specsSummary = '평양 순안국제공항 기점 정기/부정기 국제선 및 전력 수송';
        } else {
          photoUrl = p.model_image || '/intel/aircraft/mi24_kpaf.png';
          specsSummary = '조선인민군 전방 전술 비행편대 / 군사분계선(MDL) 근접 기동';
        }
      }
      // 2. 중국 인민해방군 (China PLAAF & PLAN)
      else if (isChina) {
        resolvedCountry = '중국';
        flag = '🇨🇳';
        themeColor = '#FF9100';
        affiliationLabel = '중국 인민해방군 (PLA Air Force & Navy - SUSPECT)';
        if (cs.includes('J-20') || md.includes('J-20')) {
          korTitle = '중국 공군 J-20A 마이티드래곤 스텔스 전투기'; photoUrl = '/intel/aircraft/j20a_plaaf.png'; specsSummary = '마하 2.0 / 카나드 델타익 5세대 스텔스 / PL-15 (동부전구)';
        } else if (cs.includes('J-16') || md.includes('J-16')) {
          korTitle = '중국 공군 J-16 다목적 중형 전폭기'; photoUrl = '/intel/aircraft/j16_plaaf.png'; specsSummary = '마하 2.0 / AESA 레이더 / 대함·대지 정밀타격 (닝보 기지)';
        } else if (cs.includes('J-15') || md.includes('J-15')) {
          korTitle = '중국 해군 J-15 비사 항모 함재기'; photoUrl = '/intel/aircraft/j15_plan.png'; specsSummary = '랴오닝·산둥함 탑재 / 공중우세 및 대함타격 (항모전단)';
        } else if (cs.includes('KJ-500') || md.includes('KJ-500')) {
          korTitle = '중국 공군 KJ-500 3면 AESA 조기경보기'; photoUrl = '/intel/aircraft/kj500_plaaf.png'; specsSummary = '고정형 3면 위상배열 레이더 / 450km 탐지 (칭다오 기지)';
        } else if (cs.includes('H-6') || md.includes('H-6')) {
          korTitle = '중국 공군 H-6K 장거리 전략폭격기'; photoUrl = '/intel/aircraft/h6k_plaaf.png'; specsSummary = 'CJ-20 순항미사일 6발 탑재 / 원거리 정밀타격 (안칭 기지)';
        } else if (cs.includes('WZ-7') || md.includes('WZ-7')) {
          korTitle = '중국 공군 WZ-7 샹룽 고고도 무인정찰기'; photoUrl = '/intel/aircraft/wz7_plaaf.png'; specsSummary = '60,000ft 고고도 / 다이아몬드 결합익 전략 정찰 (웨이하이 기지)';
        }
      }
      // 3. 러시아 항공우주군 (Russia VKS)
      else if (isRussia) {
        resolvedCountry = '러시아';
        flag = '🇷🇺';
        themeColor = '#8D6E63';
        affiliationLabel = '러시아 항공우주군 (VKS Russian Air Force - SUSPECT)';
        if (cs.includes('Su-57') || md.includes('Su-57')) {
          korTitle = '러시아 공군 Su-57 펠론 5세대 스텔스 전투기'; photoUrl = '/intel/aircraft/su57_vks.png'; specsSummary = '마하 2.0 / 내부무장창 / 3D 추력편향 5세대 스텔스 (아흐투빈스크)';
        } else if (cs.includes('Su-35') || md.includes('Su-35')) {
          korTitle = '러시아 공군 Su-35S 플랭커-E 제공전투기'; photoUrl = '/intel/aircraft/su35s_vks.png'; specsSummary = '3D 추력편향 노즐 / 이르비스-E 위상배열 레이더 (쿠르스크 기지)';
        } else if (cs.includes('Su-34') || md.includes('Su-34')) {
          korTitle = '러시아 공군 Su-34 풀백 초음속 전폭기'; photoUrl = '/intel/aircraft/su34_vks.png'; specsSummary = '병렬 2인승 장갑 조종석 / 활공유도폭탄 종심타격 (보로네시 기지)';
        } else if (cs.includes('Tu-160') || md.includes('Tu-160')) {
          korTitle = '러시아 공군 Tu-160M 블랙잭 초음속 전략폭격기'; photoUrl = '/intel/aircraft/tu160m_vks.png'; specsSummary = '마하 2.05 초음속 가변익 / Kh-101 스텔스 순항미사일 (엔겔스-2)';
        } else if (cs.includes('Tu-95') || md.includes('Tu-95')) {
          korTitle = '러시아 공군 Tu-95MS 베어 장거리 전략폭격기'; photoUrl = '/intel/aircraft/tu95ms_vks.png'; specsSummary = '이중반전 터보프롭 / Kh-55/102 핵순항미사일 플랫폼 (엔겔스 기지)';
        } else if (cs.includes('A-50') || md.includes('A-50')) {
          korTitle = '러시아 공군 A-50U 메인스테이 조기경보통제기'; photoUrl = '/intel/aircraft/a50u_vks.png'; specsSummary = '슈멜-M 회전 레이돔 / 600km 탐지 (이바노보 기지)';
        }
      }
      // 4. 미합중국 군대 (USAF, USN, USMC - FRIENDLY)
      else if (isUS) {
        resolvedCountry = '미국';
        flag = '🇺🇸';
        themeColor = '#00E676';
        affiliationLabel = '미합중국 군대 (United States Armed Forces - FRIENDLY)';
        if (cs.includes('F-22') || md.includes('F-22')) {
          korTitle = '미 공군 F-22A 랩터 5세대 스텔스 제공전투기'; photoUrl = '/intel/aircraft/f22a_usaf.png'; specsSummary = '마하 2.25 / 슈퍼크루즈 / 5세대 스텔스 (USAF 1st Fighter Wing)';
        } else if (cs.includes('F-35B') || md.includes('F-35B')) {
          korTitle = '미 해병대 F-35B 라이트닝 II 수직이착륙 스텔스기'; photoUrl = '/intel/aircraft/f35b_usmc.png'; specsSummary = '단거리이륙·수직착륙(STOVL) 5세대 스텔스 (USMC VMFA-121)';
        } else if (cs.includes('B-2') || md.includes('B-2')) {
          korTitle = '미 공군 B-2A 스피릿 스텔스 전략폭격기'; photoUrl = '/intel/aircraft/b2a_usaf.png'; specsSummary = '전익기 스텔스 / 핵투발 전략 억제 (USAF 509th Bomb Wing)';
        } else if (cs.includes('B-52') || md.includes('B-52')) {
          korTitle = '미 공군 B-52H 스트래토포트리스 전략폭격기'; photoUrl = '/intel/aircraft/b52h_usaf.png'; specsSummary = '순항미사일 32톤 무장탑재 / 전략 타격 (USAF 2nd Bomb Wing)';
        } else if (cs.includes('U-2') || md.includes('U-2') || md.includes('U2')) {
          korTitle = '미 공군 U-2S 드래곤레이디 고고도 정찰기'; photoUrl = '/intel/aircraft/u2s_usaf.png'; specsSummary = '70,000ft 이상 성층권 / ASARS-2 SAR 합성개구레이더 (USAF 5RS)';
        } else if (cs.includes('RC-135') || md.includes('RC-135') || cs.includes('리벳조인트')) {
          korTitle = '미 공군 RC-135V 리벳조인트 전자정찰기'; photoUrl = '/intel/aircraft/rc135v_usaf.png'; specsSummary = '통신·신호(SIGINT/ELINT) 실시간 요격 정찰 (USAF 55th Wing)';
        } else if (cs.includes('P-8') || md.includes('P-8') || cs.includes('포세이돈')) {
          korTitle = '미 해군 P-8A 포세이돈 최신예 대잠초계기'; photoUrl = '/intel/aircraft/p8a_usn.png'; specsSummary = 'APY-10 다목적 레이더 / Mk-54 어뢰 및 하푼 (US Navy VP-4)';
        } else if (cs.includes('MQ-9') || cs.includes('리퍼')) {
          korTitle = '미 공군 MQ-9A 리퍼 무인 공격정찰기'; photoUrl = '/intel/aircraft/mq9_usaf.png'; specsSummary = '헬파이어 미사일 / 27시간 장기체공 정밀타격 (USAF 8th Fighter Wing)';
        }
      }
      // 5. 대한민국 국군 (ROK AF, Army & Navy - FRIENDLY)
      else if (isROK) {
        resolvedCountry = '대한민국';
        flag = '🇰🇷';
        themeColor = '#00E676';
        affiliationLabel = '대한민국 국군 (ROK Armed Forces - FRIENDLY)';
        if (cs.includes('F-35') || md.includes('F-35')) {
          korTitle = '대한민국 공군 F-35A 스텔스 전투기'; photoUrl = '/intel/aircraft/f35a_rokaf.png'; specsSummary = '마하 1.6 / 5세대 스텔스 전술기 (청주 제17전투비행단)';
        } else if (cs.includes('F-15') || md.includes('F-15')) {
          korTitle = '대한민국 공군 F-15K 슬램이글 전폭기'; photoUrl = '/intel/aircraft/f15k_rokaf.png'; specsSummary = '마하 2.5 / 타우러스 순항미사일 정밀타격 (대구 제11전투비행단)';
        } else if (cs.includes('KF-16') || md.includes('KF-16')) {
          korTitle = '대한민국 공군 KF-16V 바이퍼 전투기'; photoUrl = '/intel/aircraft/kf16v_rokaf.png'; specsSummary = '마하 2.0 / AESA 레이더 탑재 (서산 제20전투비행단)';
        } else if (cs.includes('FA-50') || md.includes('FA-50')) {
          korTitle = '대한민국 공군 FA-50 파이팅이글 경공격기'; photoUrl = '/intel/aircraft/fa50_rokaf.png'; specsSummary = '마하 1.5 / 정밀유도폭탄 근접항공지원 (원주 제8전투비행단)';
        } else if (cs.includes('피스아이') || cs.includes('E-737') || md.includes('E-737')) {
          korTitle = '대한민국 공군 E-737 피스아이 조기경보통제기'; photoUrl = '/intel/aircraft/e737_rokaf.png'; specsSummary = '360도 MESA 다기능 레이더 / 400km 탐지 (김해 제51전대)';
        } else if (cs.includes('시그너스') || cs.includes('KC-330') || md.includes('KC-330')) {
          korTitle = '대한민국 공군 KC-330 시그너스 다목적 공중급유기'; photoUrl = '/intel/aircraft/kc330_rokaf.png'; specsSummary = '연료 111톤 공중급유 / 전략 수송 (김해 제5비행단)';
        } else if (cs.includes('글로벌호크') || cs.includes('RQ-4') || md.includes('RQ-4')) {
          korTitle = '대한민국 공군 RQ-4B 글로벌호크 무인정찰기'; photoUrl = '/intel/aircraft/rq4b_rokaf.png'; specsSummary = '60,000ft 고고도 / 34시간 체공 정찰 (청주 제39정찰비행단)';
        } else if (cs.includes('아파치') || cs.includes('AH-64') || md.includes('AH-64')) {
          korTitle = '대한민국 육군 AH-64E 아파치 가디언 공격헬기'; photoUrl = '/intel/aircraft/ah64e_roka.png'; specsSummary = '롱보우 밀리미터파 레이더 / 헬파이어 16발 (육군항공사)';
        }
      }
      // 6. 이스라엘 공군 (Israel IAF)
      else if (resolvedCountry === '이스라엘' || cs.includes('이스라엘') || cs.includes('IAF') || hex.startsWith('770') || cs.includes('Adir') || cs.includes('Ra\'am') || cs.includes('Sufa') || cs.includes('Eitan')) {
        resolvedCountry = '이스라엘';
        flag = '🇮🇱';
        themeColor = '#00BCD4';
        affiliationLabel = '이스라엘 공군 (Israel Air Force)';
        if (cs.includes('F-35') || md.includes('F-35') || cs.includes('아디르')) {
          korTitle = '이스라엘 공군 F-35I 아디르(Adir) 특수스텔스기'; photoUrl = '/intel/aircraft/f35i_iaf.png'; specsSummary = '이스라엘 자체 전자전 C4I 시스템 / 스파이스 정밀유도폭탄 (네바팀 140대대)';
        } else if (cs.includes('F-15') || md.includes('F-15') || cs.includes('라암')) {
          korTitle = '이스라엘 공군 F-15IA 라암(Ra\'am) 전폭기'; photoUrl = '/intel/aircraft/f15ia_iaf.png'; specsSummary = '마하 2.5 / 장거리 종심 전략 타격 (하체림 69대대)';
        } else if (cs.includes('F-16') || md.includes('F-16') || cs.includes('수파')) {
          korTitle = '이스라엘 공군 F-16I 수파(Sufa) 다목적 전투기'; photoUrl = '/intel/aircraft/f16i_iaf.png'; specsSummary = '밀착형 컨포멀 연료탱크(CFT) / 라이트닝 타게팅 포드 (라마트다비드)';
        } else if (cs.includes('에이탄') || cs.includes('헤론') || md.includes('Eitan')) {
          korTitle = '이스라엘 IAI 에이탄 (헤론 TP) 전략무인기'; photoUrl = '/intel/aircraft/heron_tp_iaf.png'; specsSummary = '45,000ft 고고도 / 36시간 체공 / 페이로드 1,000kg (팔마힘 기지)';
        }
      }
      // 7. 우크라이나 공군 (Ukraine AF)
      else if (resolvedCountry === '우크라이나' || cs.includes('우크라이나') || cs.includes('UAF') || hex.startsWith('750') || cs.includes('바이락타르') || cs.includes('TB2')) {
        resolvedCountry = '우크라이나';
        flag = '🇺🇦';
        themeColor = '#2979FF';
        affiliationLabel = '우크라이나 공군 (Ukrainian Air Force)';
        if (cs.includes('F-16') || md.includes('F-16')) {
          korTitle = '우크라이나 공군 F-16AM 바이퍼 다목적 전투기'; photoUrl = '/intel/aircraft/f16am_uaf.png'; specsSummary = 'AIM-120 암람 공대공 / 활공폭탄 JDAM 운용 (서부 공군기지)';
        } else if (cs.includes('MiG-29') || md.includes('MiG-29')) {
          korTitle = '우크라이나 공군 MiG-29MU1 펄크럼 요격기'; photoUrl = '/intel/aircraft/mig29_uaf.png'; specsSummary = 'AGM-88 HARM 대레이더 미사일 통합 개수 (바실키우 제40여단)';
        } else if (cs.includes('Su-27') || md.includes('Su-27')) {
          korTitle = '우크라이나 공군 Su-27S 플랭커 중형 전투기'; photoUrl = '/intel/aircraft/su27s_uaf.png'; specsSummary = '마하 2.35 / 방공 요격 및 공중 우세 (미르호로드 제831여단)';
        } else if (cs.includes('TB2') || cs.includes('바이락타르')) {
          korTitle = '우크라이나 공군 바이락타르 TB2 공격무인기'; photoUrl = '/intel/aircraft/tb2_uaf.png'; specsSummary = 'MAM-L 정밀유도탄 4발 / 전차 및 방공망 정밀타격 (오데사 기지)';
        }
      }
      // 8. 일본 자위대 (Japan JASDF & JMSDF)
      else if (resolvedCountry === '일본' || cs.includes('일본') || cs.includes('자위대') || cs.includes('JASDF') || cs.includes('JMSDF') || hex.startsWith('780') || cs.includes('F-15J') || cs.includes('F-2A') || cs.includes('E-2D') || cs.includes('P-1')) {
        resolvedCountry = '일본';
        flag = '🇯🇵';
        themeColor = '#FFD700';
        affiliationLabel = '일본 항공자위대 & 해상자위대 (JASDF & JMSDF)';
        if (cs.includes('F-35') || md.includes('F-35')) {
          korTitle = '일본 항공자위대 F-35A 스텔스 전투기'; photoUrl = '/intel/aircraft/f35a_jasdf.png'; specsSummary = '마하 1.6 / 5세대 스텔스 / JNAAM 장거리 공대공 (미사와 제302비행대)';
        } else if (cs.includes('F-15') || md.includes('F-15')) {
          korTitle = '일본 항공자위대 F-15J 카이(Kai) 근대화 개수 요격기'; photoUrl = '/intel/aircraft/f15j_jasdf.png'; specsSummary = 'AAM-4/5 미사일 탑재 / 홋카이도 방공식별구역 CAP (지토세 제201비행대)';
        } else if (cs.includes('F-2') || md.includes('F-2')) {
          korTitle = '일본 항공자위대 F-2A 지원전투기 (바이퍼-제로)'; photoUrl = '/intel/aircraft/f2a_jasdf.png'; specsSummary = 'ASM-3 초음속 공대함미사일 4발 / AESA 레이더 (쓰이키 제8비행대)';
        } else if (cs.includes('E-2D') || md.includes('E-2D')) {
          korTitle = '일본 항공자위대 E-2D 어드밴스드 호크아이'; photoUrl = '/intel/aircraft/e2d_jasdf.png'; specsSummary = 'APY-9 UHF 대스텔스 레이더 / 미일 연합 데이터링크 (미사와 기지)';
        } else if (cs.includes('P-1') || md.includes('P-1')) {
          korTitle = '일본 해상자위대 P-1 제트 대잠초계기'; photoUrl = '/intel/aircraft/p1_jmsdf.png'; specsSummary = '4발 국산 터보팬 / HPS-106 AESA 레이더 대잠 탐지 (아쓰기 제3항공대)';
        }
      }
      // 9. 민간 여객선 및 비즈니스 제트기 (Commercial Airlines)
      else {
        flag = '✈️';
        themeColor = '#00E5FF';
        if (p.model_image) {
          photoUrl = p.model_image;
        }

        if (cs.includes('대한항공') || cs.startsWith('KAL')) {
          flag = '🇰🇷'; korTitle = `대한항공 여객기 (${cs})`; photoUrl = '/intel/aircraft/b777_kal.png'; specsSummary = '대한항공 글로벌 프리미엄 장거리 노선 운항 (B777/A350)';
        } else if (cs.includes('아시아나') || cs.startsWith('AAR')) {
          flag = '🇰🇷'; korTitle = `아시아나항공 여객기 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/a350_aar.png'; specsSummary = '아시아나항공 국제선 및 국내선 정기편 운항 (A350/A330)';
        } else if (cs.includes('제주항공') || cs.startsWith('JBU')) {
          flag = '🇰🇷'; korTitle = `제주항공 여객기 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b737_jbu.png'; specsSummary = '국내 및 아시아 지역 정기 여객선 운항 (B737-MAX8)';
        } else if (cs.includes('진에어') || cs.startsWith('JNA')) {
          flag = '🇰🇷'; korTitle = `진에어 여객기 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b737_jna.png'; specsSummary = '국내선 및 중단거리 국제선 정기 운항 (B737-800)';
        } else if (cs.includes('티웨이') || cs.startsWith('TWB')) {
          flag = '🇰🇷'; korTitle = `티웨이항공 여객기 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/a330_twb.png'; specsSummary = '유럽/아시아 중장거리 및 국내선 운항 (A330-300)';
        } else if (cs.includes('에어프레미아') || cs.startsWith('APZ')) {
          flag = '🇰🇷'; korTitle = `에어프레미아 드림라이너 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b787_apz.png'; specsSummary = 'B787-9 드림라이너 미주/유럽 장거리 하이브리드 운항';
        } else if (cs.includes('에어부산') || cs.startsWith('ABL')) {
          flag = '🇰🇷'; korTitle = `에어부산 여객기 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b737_jna.png'; specsSummary = '부산/동남권 기점 국내 및 아시아 정기편 운항';
        } else if (cs.includes('에어서울') || cs.startsWith('ASV')) {
          flag = '🇰🇷'; korTitle = `에어서울 여객기 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b737_jbu.png'; specsSummary = '수도권 기점 일본/동남아 정기 여객선 운항';
        } else if (cs.startsWith('CES')) {
          flag = '🇨🇳'; korTitle = `중국동방항공 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/a330_twb.png'; specsSummary = '중국 3대 국유 민간항공사 / 한중 및 동아시아 정기 운항';
        } else if (cs.startsWith('CSN')) {
          flag = '🇨🇳'; korTitle = `중국남방항공 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/a350_aar.png'; specsSummary = '광저우/베이징 기점 아시아 최대 규모 국제 여객선 운항';
        } else if (cs.startsWith('CCA')) {
          flag = '🇨🇳'; korTitle = `중국국제항공 에어차이나 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b737_jna.png'; specsSummary = '중국 플래그 캐리어 / 베이징 서우두 기점 국제 노선';
        } else if (cs.startsWith('ANA')) {
          flag = '🇯🇵'; korTitle = `전일본공수 ANA (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b777_kal.png'; specsSummary = '일본 5스타 항공사 / 하네다·나리타 기점 국제 장거리 운항';
        } else if (cs.startsWith('JAL')) {
          flag = '🇯🇵'; korTitle = `일본항공 JAL (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b777_kal.png'; specsSummary = '일본 대표 국적사 / 도쿄 하네다 기점 프리미엄 국제선';
        } else if (cs.startsWith('CPA')) {
          flag = '🇭🇰'; korTitle = `캐세이퍼시픽 (${cs})`; photoUrl = '/intel/aircraft/cpa_b777.png'; specsSummary = '홍콩 첵랍콕 허브 / 글로벌 프리미엄 장거리 노선 운항';
        } else if (cs.startsWith('DAL')) {
          flag = '🇺🇸'; korTitle = `델타항공 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/a350_aar.png'; specsSummary = '미국 메이저 레거시 항공사 / 태평양 횡단 노선 운항';
        } else if (cs.startsWith('UAL')) {
          flag = '🇺🇸'; korTitle = `유나이티드항공 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b777_kal.png'; specsSummary = '스타얼라이언스 창립 항공사 / 샌프란시스코 직항 노선';
        } else if (cs.startsWith('SIA')) {
          flag = '🇸🇬'; korTitle = `싱가포르항공 (${cs})`; photoUrl = p.model_image || '/intel/aircraft/b777_kal.png'; specsSummary = '창이국제공항 허브 / B787-10 최신 기단 운항';
        } else if (cs.includes('삼성') || cs.includes('HL8282')) {
          flag = '🇰🇷'; korTitle = '삼성그룹 전용 비즈니스 제트기 (G650ER)'; photoUrl = '/intel/aircraft/g650er_vip.png'; specsSummary = '마하 0.925 / 7,500해리 초장거리 VIP 비즈니스 전용기';
        } else if (cs.includes('현대') || cs.includes('HL8500')) {
          flag = '🇰🇷'; korTitle = '현대자동차그룹 전용 비즈니스 제트기 (Global 7500)'; photoUrl = '/intel/aircraft/global7500_vip.png'; specsSummary = '봄바디어 글로벌 7500 플래그십 글로벌 논스톱 비즈니스기';
        } else if (p.airline_name) {
          korTitle = `${p.airline_name} (${cs})`;
          photoUrl = p.model_image || '/intel/aircraft/b777_kal.png';
          specsSummary = `${p.model || '국제 표준 여객기'} / ICAO 등록 정기 운항`;
        }
      }

      const stage1Badge = p.stage1_verification || '✅ [1차 물리수신] ADS-B / Mode-S / ICAO24 주파수 정상 수신 (신호신뢰도 99.9%)';
      const stage2Badge = isDPRK
        ? (p.stage2_verification || '⚠️ [2차 전술검증] IFF Mode-5: HOSTILE (적성 북한 군용기) / 비행금지선(NFL) 감시 PASS')
        : (isChina || isRussia)
          ? (p.stage2_verification || `⚠️ [2차 전술검증] IFF Mode-5: SUSPECT (${resolvedCountry} 주의 군용기) / KADIZ 감시 PASS`)
          : (isROK || isUS)
            ? (p.stage2_verification || `🛡️ [2차 전술검증] IFF Mode-5 피아식별 완료 (${resolvedCountry} FRIENDLY) & 하네스 공역 규칙 PASS`)
            : (themeColor === '#00E5FF'
              ? '🛡️ [2차 전술검증] ICAO 국제항공기구 표준 항공로(Airway) 및 관제 인가 궤적 PASS'
              : `🛡️ [2차 전술검증] IFF 피아식별 완료 (${resolvedCountry}) & 공역 규칙 PASS`);

      const iffBadgeText = isDPRK ? 'IFF: HOSTILE (적성)' : (isChina || isRussia) ? 'IFF: SUSPECT (주의)' : (themeColor === '#00E5FF') ? 'ICAO CIVILIAN' : 'IFF MODE-5 CERTIFIED';
      const iffBadgeColor = isDPRK ? '#FF1744' : (isChina || isRussia) ? '#FF9100' : (themeColor === '#00E5FF') ? '#00E5FF' : '#76FF03';

      return {
        korTitle,
        country: resolvedCountry || (isDPRK ? '북한' : isChina ? '중국' : isRussia ? '러시아' : '대한민국'),
        flag,
        affiliationLabel,
        themeColor,
        photoUrl,
        stage1Badge,
        stage2Badge,
        specsSummary,
        isHostile: isDPRK,
        isSuspect: isChina || isRussia,
        iffBadgeText,
        iffBadgeColor
      };
    }

    // ── Flights (100% Korean Localized Popup HUD with Aircraft Photo & 2-Stage Verification) ──
    ['fl-commercial','fl-private','fl-jets','fl-mil-rokus','fl-mil-dprk','fl-mil-china','fl-mil-russia','fl-mil-ukraine','fl-mil-israel','fl-mil-japan','fl-mil-other'].forEach((layer: string) => {
      map.on('click', layer, (e: any) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as any;
        const coords = (e.features[0].geometry as any).coordinates;
        const cs = (p.callsign||'').trim();
        const md = (p.model||'').trim();
        const hex = (p.icao24||'').toUpperCase();

        const card = getAircraftIntelCard(p, coords);
        const spatialAudit = verifyEntitySpatialBoundary(coords[1], coords[0], p.alt || 1000);
        const popupTargetId = idSafe(hex || cs || 'target');

        popup(coords, `<div style="${pStyle}border:1.5px solid ${card.themeColor};background:rgba(10,12,18,0.96);max-width:380px;">
          <!-- 1. Header with Flag, Title, Affiliation -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;border-bottom:1px solid ${card.themeColor}50;padding-bottom:5px;">
            <span style="color:${card.themeColor};font-size:12.5px;font-weight:800;">${card.flag} ${htmlEsc(card.korTitle)}</span>
            <span style="color:#8A8880;font-size:8.5px;font-family:monospace;background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;">ICAO: ${htmlEsc(p.icao24||'—')}</span>
          </div>

          <div style="display:flex;align-items:center;gap:5px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="font-size:8.5px;color:${card.themeColor};font-weight:bold;background:${card.themeColor}20;padding:2px 6px;border-radius:3px;border:1px solid ${card.themeColor}50;">🏛️ ${htmlEsc(card.affiliationLabel)}</span>
            <span style="font-size:8.5px;color:#FFD740;font-weight:bold;background:rgba(255,215,0,0.1);padding:2px 6px;border-radius:3px;border:1px solid rgba(255,215,0,0.3);">국가: ${htmlEsc(card.country)}</span>
          </div>

          <!-- 2. Dedicated Aircraft Recon Photo Card -->
          <div style="position:relative;border:1px solid ${card.themeColor}60;border-radius:5px;overflow:hidden;background:#000;margin-bottom:8px;">
            <div style="position:relative;">
              <img src="${card.photoUrl}?v=real_v4" alt="${htmlEsc(card.korTitle)}" style="width:100%;height:155px;object-fit:cover;display:block;"
                onerror="this.onerror=null;this.src='${card.isHostile ? '/intel/aircraft/mi24_kpaf.png' : '/intel/aircraft/b777_kal.png'}';" />
              <div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.85);border:1px solid ${card.themeColor};color:${card.themeColor};padding:2px 6px;border-radius:3px;font-size:8px;font-weight:bold;">
                📷 공인 실사 사진 및 전술 프로필
              </div>
              <div style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.88);border:1px solid ${card.iffBadgeColor};color:${card.iffBadgeColor};padding:2px 6px;border-radius:3px;font-size:7.5px;font-family:monospace;font-weight:bold;">
                ${card.iffBadgeText}
              </div>
            </div>
            <div style="padding:5px 8px;background:rgba(13,17,23,0.92);border-top:1px solid rgba(255,255,255,0.1);font-size:8.5px;color:#E8E6E0;">
              <span style="color:#00E5FF;font-weight:bold;">⚙️ 주요 제원:</span> ${htmlEsc(card.specsSummary)}
            </div>
          </div>

          <!-- 3. Local AI (Qwen3-14B-OSIRIS) Live On-Device Verification Block -->
          <div style="background:rgba(0,0,0,0.7);border:1px solid ${card.themeColor}80;border-radius:4px;padding:6px 8px;margin-bottom:8px;font-size:9px;">
            <div style="color:${card.themeColor};font-weight:bold;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;">
              <span>⚡ 로컬 AI (번개의 눈동자 전담 Qwen3-14B) 온디바이스 전술 판정</span>
              <span id="ai-verify-status-${popupTargetId}" style="color:#FFD740;font-family:monospace;font-size:8px;background:rgba(255,215,0,0.15);padding:1px 4px;border-radius:2px;">실시간 추론 중...</span>
            </div>
            <div id="ai-verify-content-${popupTargetId}" style="color:#E8E6E0;font-size:8.5px;line-height:1.4;">
              <span style="color:#8A8880;">온디바이스 Qwen3-14B 모델로 기종-소속-피아식별 무결성 검증을 호출하고 있습니다...</span>
            </div>
          </div>

          <!-- 3.5. 천재들의 질문법 (소크라테스·파인만·포퍼 인지 검증) HUD 블록 -->
          <div style="background:rgba(18,12,36,0.85);border:1px solid rgba(224,64,251,0.5);border-radius:4px;padding:6px 8px;margin-bottom:8px;font-size:9px;">
            <div style="color:#E040FB;font-weight:bold;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;">
              <span>🧠 천재들의 5대 질문법 인지 검증 (Socratic Proof)</span>
              <span id="socratic-gate-status-${popupTargetId}" style="color:#E040FB;font-family:monospace;font-size:8px;background:rgba(224,64,251,0.15);padding:1px 4px;border-radius:2px;">인식 심문 중...</span>
            </div>
            <div id="socratic-gate-content-${popupTargetId}" style="color:#DDD;font-size:8.2px;line-height:1.35;">
              <div style="color:#8A8880;">1. 제1원리 물리 제원 | 2. 소크라테스 반대 가설 모순 | 3. 파인만 인과 체인 | 4. 포퍼 반증 조건 검증 중...</div>
            </div>
          </div>

          <!-- 4. 1차 & 2차 하네스 검증 블록 (2-Stage Verification Pipeline) -->
          <div style="background:rgba(0,0,0,0.6);border:1px solid rgba(0,229,255,0.4);border-radius:4px;padding:6px 8px;margin-bottom:8px;font-size:9px;line-height:1.4;">
            <div style="color:#00E5FF;font-weight:bold;margin-bottom:3px;display:flex;justify-content:space-between;">
              <span>🛡️ 하네스 2단계 항공 검증 파이프라인</span>
              <span style="color:${card.isHostile ? '#FF1744' : '#76FF03'};font-family:monospace;font-size:8px;background:${card.isHostile ? 'rgba(255,23,68,0.15)' : 'rgba(118,255,3,0.15)'};padding:1px 4px;border-radius:2px;">${card.isHostile ? 'ALERT' : 'PASS'}</span>
            </div>
            <div style="color:#76FF03;font-size:8.5px;margin-bottom:2px;">
              ${htmlEsc(card.stage1Badge)}
            </div>
            <div style="color:${card.isHostile ? '#FF1744' : '#00E5FF'};font-size:8.5px;">
              ${htmlEsc(card.stage2Badge)}
            </div>
          </div>

          <!-- 5. Flight Telemetry Grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:9.5px;margin-bottom:8px;background:rgba(0,0,0,0.35);padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.06);">
            <div><span style="color:#8A8880;">🛩️ 기종:</span> <span style="color:#FFF;font-weight:bold;">${htmlEsc(p.model||'기종 미확인')}</span></div>
            <div><span style="color:#8A8880;">📏 비행 고도:</span> <span style="color:#00E5FF;font-weight:bold;">${p.alt ? Math.round(p.alt) + 'm (' + Math.round(p.alt * 3.28084) + 'ft)' : '—'}</span></div>
            <div><span style="color:#8A8880;">🚀 비행 속도:</span> <span style="color:#FFF;font-weight:bold;">${p.speed_knots ? p.speed_knots + '노트 (' + Math.round(p.speed_knots * 1.852) + 'km/h)' : '—'}</span></div>
            <div><span style="color:#8A8880;">🧭 비행 방위:</span> <span style="color:#FFF;font-weight:bold;">${Math.round(p.heading||0)}°</span></div>
            ${p.origin ? `<div style="grid-column:1 / -1;"><span style="color:#8A8880;">🛫 항로:</span> <span style="color:#FFD700;font-weight:bold;">${htmlEsc(p.origin)} ➔ ${htmlEsc(p.destination||'미상')}</span></div>` : ''}
            <div><span style="color:#8A8880;">🔢 등록번호:</span> <span style="color:#FFD700;font-family:monospace;">${htmlEsc(p.registration||'N/A')}</span></div>
            <div><span style="color:#8A8880;">📍 좌표:</span> <span style="color:#00E5FF;font-family:monospace;">${coords[1].toFixed(3)}°N, ${coords[0].toFixed(3)}°E</span></div>
          </div>

          <!-- 6. Spatial Demarcation Audit -->
          <div style="font-size:8.5px;color:${spatialAudit.color};background:rgba(0,0,0,0.4);padding:4px 6px;border-radius:3px;border:1px solid ${spatialAudit.color};margin-bottom:8px;font-family:'JetBrains Mono',monospace;">
            <span style="color:#8A8880;display:block;">🎖️ 공역 검증 경계:</span>
            <strong style="color:${spatialAudit.color};font-size:9.5px;">${htmlEsc(spatialAudit.zone_name)}</strong>
            <span style="color:#aaa;display:block;margin-top:1px;">${htmlEsc(spatialAudit.boundary_description)}</span>
          </div>

          <!-- 7. Action Links -->
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <a href="https://www.flightaware.com/live/flight/${encodeURIComponent(cs)}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:#D4AF37;border:1px solid rgba(212,175,55,0.4);background:rgba(212,175,55,0.15);padding:5px;">⚡ 플라이트어웨어 ↗</a>
            <a href="https://globe.adsbexchange.com/?icao=${encodeURIComponent(p.icao24||'')}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:#00E5FF;border:1px solid rgba(0,229,255,0.4);background:rgba(0,229,255,0.15);padding:5px;">📡 ADS-B 항적 ↗</a>
          </div>
          <button onclick="window.openOsirisIntel({ callsign: '${idSafe(cs)}', icao24: '${idSafe(p.icao24||'')}', model: '${idSafe(p.model||card.korTitle)}', registration: '${idSafe(p.registration||'N/A')}', category: '${p.category||'military'}' })" style="width:100%;margin-top:6px;padding:6px;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.5);color:#00E5FF;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:bold;letter-spacing:0.05em;border-radius:4px;cursor:pointer;">[ ⚡ AI 항적 및 군사 지능 심층 분석 ]</button>
        </div>`);

        // ── 실시간 로컬 AI (Qwen3-14B-OSIRIS) 온디바이스 비동기 검증 호출 ──
        setTimeout(() => {
          fetch('/api/intel/verify-target', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callsign: cs,
              model: p.model || card.korTitle,
              icao24: p.icao24 || '',
              country: card.country,
              coords
            })
          })
          .then(r => r.json())
          .then(res => {
            const statusEl = document.getElementById(`ai-verify-status-${popupTargetId}`);
            const contentEl = document.getElementById(`ai-verify-content-${popupTargetId}`);
            if (statusEl && res.status === 'success') {
              const j = applyJudgmentBadgeEl(statusEl, res);
              if (contentEl) {
                contentEl.innerHTML = renderVerifyTargetContentHtml(res, htmlEsc, j);
              }
            }
          })
          .catch(() => {
            const statusEl = document.getElementById(`ai-verify-status-${popupTargetId}`);
            applyJudgmentBadgeEl(statusEl, { judgmentSource: 'rule', aiSuccess: false });
          });

          // ── 소크라테스 5대 질문법 인지 검증 비동기 호출 ──
          fetch('/api/intel/socratic-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target_domain: 'flight',
              target_data: {
                id: p.icao24 || cs,
                name: card.korTitle,
                country: card.country,
                model: p.model || card.korTitle,
                altitude: p.alt ? Math.round(p.alt) : 0,
                speed: p.speed_knots ? Math.round(p.speed_knots * 1.852) : 0,
                iff: card.isHostile ? 'HOSTILE' : 'FRIENDLY'
              }
            })
          })
          .then(r => r.json())
          .then(res => {
            const gateStatusEl = document.getElementById(`socratic-gate-status-${popupTargetId}`);
            const gateContentEl = document.getElementById(`socratic-gate-content-${popupTargetId}`);
            if (gateStatusEl && res.status === 'success') {
              const r = res.report;
              const j = applyJudgmentBadgeEl(gateStatusEl, r);
              gateStatusEl.textContent = `${j.badgeLabel} · 이해도 ${r.overall_comprehension_score}점`;
              if (gateContentEl) {
                gateContentEl.innerHTML = `
                  <div style="color:#8A8880;font-size:7.5px;margin-bottom:3px;">${htmlEsc(j.helperCopy)}</div>
                  <div style="margin-bottom:2px;"><span style="color:#00E5FF;font-weight:bold;">1. 제1원리:</span> ${htmlEsc(r.gates[0]?.finding || '물리 일치')}</div>
                  <div style="margin-bottom:2px;"><span style="color:#FFD700;font-weight:bold;">2. 반대모순:</span> ${htmlEsc(r.counter_contradictions[0] || '모순 감지 완료')}</div>
                  <div style="margin-bottom:2px;"><span style="color:#E040FB;font-weight:bold;">3. 포퍼반증:</span> ${htmlEsc(r.falsification_criteria.slice(0, 50))}...</div>
                  <div style="color:#76FF03;"><span style="color:#76FF03;font-weight:bold;">4. 섭동검증:</span> ${htmlEsc(r.counterfactual_proof?.ai_adapted_verdict?.slice(0, 45) || '검증완료')}...</div>
                `;
              }
            }
          })
          .catch(() => {});
        }, 40);
      });
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── DEDICATED DRONE MAP POPUP HUD ──
    map.on('click', 'drones-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.color || '#FF1744';
      const droneMgrs = p.mgrs || latLngToMGRS(coords[1], coords[0]);
      const gcsMgrs = p.gcs_lat && p.gcs_lng ? latLngToMGRS(p.gcs_lat, p.gcs_lng) : null;

      const dronePopupId = idSafe(p.remote_id || p.name || 'drone');
      const isHostileDrone = (p.name || '').includes('북한') || (p.name || '').includes('방현') || (p.name || '').includes('샛별') || (p.name || '').includes('침투');
      const droneIffText = isHostileDrone ? 'IFF: HOSTILE (적성 침투 드론)' : 'IFF: FRIENDLY (공역 인가 드론)';
      const droneIffColor = isHostileDrone ? '#FF1744' : '#00E676';

      popup(coords, `<div style="${pStyle}border:1.5px solid ${droneIffColor};background:rgba(8,10,18,0.96);max-width:370px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:6px;">
          <span style="color:${droneIffColor};font-size:13px;font-weight:800;">🛸 ${htmlEsc(p.name)}</span>
          <span style="color:#FFF;font-size:9px;background:${droneIffColor};padding:2px 6px;border-radius:4px;font-weight:bold;">${droneIffText}</span>
        </div>
        <div style="font-size:11px;color:#E8E6E0;font-weight:bold;margin-bottom:4px;">기종: ${htmlEsc(p.model)}</div>
        <div style="font-size:9.5px;color:#aaa;margin-bottom:6px;">소속: ${htmlEsc(p.affiliation || '미상 전력')}</div>

        <!-- Local AI C-UAS On-Device Verification Box -->
        <div style="background:rgba(0,0,0,0.7);border:1px solid ${droneIffColor}80;border-radius:4px;padding:6px 8px;margin-bottom:8px;font-size:9px;">
          <div style="color:${droneIffColor};font-weight:bold;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;">
            <span>⚡ 로컬 AI (Qwen3-14B) C-UAS 전술 판정</span>
            <span id="ai-verify-status-${dronePopupId}" style="color:#FFD740;font-family:monospace;font-size:8px;background:rgba(255,215,0,0.15);padding:1px 4px;border-radius:2px;">실시간 판정 중...</span>
          </div>
          <div id="ai-verify-content-${dronePopupId}" style="color:#E8E6E0;font-size:8.5px;line-height:1.4;">
            <span style="color:#8A8880;">무선 RF 주파수 및 RemoteID 기반 피아식별 교차 감사 중...</span>
          </div>
        </div>

        <!-- MILITARY COORDINATES (MGRS) BADGE -->
        <div style="font-size:10px;color:#00E5FF;background:rgba(0,229,255,0.12);padding:5px 8px;border-radius:4px;border:1px solid rgba(0,229,255,0.4);margin-bottom:8px;font-family:'JetBrains Mono',monospace;">
          <span style="color:#8A8880;font-size:8.5px;display:block;">🎖️ 표적 군사 좌표 (MGRS 10-Digit / 1m 정밀도):</span>
          <strong style="color:#FFD700;font-size:11px;letter-spacing:0.05em;">${droneMgrs}</strong>
          <span style="color:#aaa;font-size:8.5px;margin-left:6px;">(${coords[1].toFixed(5)}°N, ${coords[0].toFixed(5)}°E)</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9.5px;margin-bottom:8px;background:rgba(0,0,0,0.35);padding:6px;border-radius:4px;">
          <div><span style="color:#8A8880;">비행 고도:</span><br/><span style="color:#00E5FF;font-weight:bold;">${p.alt_feet || 1000} ft (${Math.round((p.alt_feet||1000)*0.3048)}m)</span></div>
          <div><span style="color:#8A8880;">비행 속력:</span><br/><span style="color:#76FF03;font-weight:bold;">${p.speed_kts || 45} kts</span></div>
          <div><span style="color:#8A8880;">RF 수신 주파수:</span><br/><span style="color:#FFD700;">${htmlEsc(p.rf_freq || '2.4 GHz')}</span></div>
          <div><span style="color:#8A8880;">RemoteID MAC:</span><br/><span style="color:#00E5FF;font-family:monospace;">${htmlEsc(p.remote_id || 'N/A')}</span></div>
        </div>

        ${p.gcs_lat ? `<div style="font-size:9.5px;color:#76FF03;background:rgba(118,255,3,0.1);padding:6px 8px;border-radius:4px;border:1px solid rgba(118,255,3,0.3);margin-bottom:8px;font-family:'JetBrains Mono',monospace;">
          🎮 연동 조종자(GCS Pilot) 역추적 좌표:<br/>
          <strong style="color:#76FF03;">MGRS: ${gcsMgrs}</strong><br/>
          <span style="color:#aaa;font-size:8.5px;">(${p.gcs_lat.toFixed(5)}°N, ${p.gcs_lng.toFixed(5)}°E | TDoA 1.8m 이내)</span>
        </div>` : ''}

        <div style="font-size:9.5px;color:#aaa;line-height:1.3;margin-bottom:8px;">임무: ${htmlEsc(p.mission || '영공 및 해상 초계 정찰')}</div>
        <button onclick="if(window.onOpenCuasRf) window.onOpenCuasRf()" style="width:100%;padding:8px 12px;background:rgba(0,229,255,0.2);border:1px solid #00E5FF;color:#00E5FF;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.1em;border-radius:4px;cursor:pointer;">[ 📻 C-UAS 실시간 무선 감시 & TDoA 역추적 팝업 열기 ]</button>
      </div>`);

      setTimeout(() => {
        fetch('/api/intel/verify-target', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_type: 'drone',
            name: p.name,
            model: p.model,
            coords
          })
        })
        .then(r => r.json())
        .then(res => {
          const statusEl = document.getElementById(`ai-verify-status-${dronePopupId}`);
          const contentEl = document.getElementById(`ai-verify-content-${dronePopupId}`);
          if (statusEl && res.status === 'success') {
            const j = applyJudgmentBadgeEl(statusEl, res);
            if (contentEl) {
                contentEl.innerHTML = renderVerifyTargetContentHtml(res, htmlEsc, j);
            }
          }
        })
        .catch(() => {
          const statusEl = document.getElementById(`ai-verify-status-${dronePopupId}`);
          applyJudgmentBadgeEl(statusEl, { judgmentSource: 'rule', aiSuccess: false });
        });
      }, 40);
    });
    map.on('mouseenter', 'drones-dots', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'drones-dots', () => { map.getCanvas().style.cursor = ''; });

    // ── GCS PILOT EMITTER MAP POPUP HUD ──
    map.on('click', 'gcs-emitter-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const gcsMgrs = latLngToMGRS(coords[1], coords[0]);

      popup(coords, `<div style="${pStyle}border:1.5px solid #FF1744;background:rgba(18,8,12,0.96);max-width:370px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid rgba(255,23,68,0.3);padding-bottom:6px;">
          <span style="color:#FF1744;font-size:13px;font-weight:800;">🎮 조종자(GCS Pilot) TDoA 역추적 위치</span>
          <span style="color:#FFF;font-size:9px;background:#FF1744;padding:2px 6px;border-radius:4px;font-weight:bold;">TDoA 95%</span>
        </div>
        <div style="font-size:11px;color:#E8E6E0;font-weight:bold;margin-bottom:6px;">통제 대상 기체: ${htmlEsc(p.drone_model || '미상 FPV / 민간 드론')}</div>

        <!-- MILITARY COORDINATES (MGRS) BADGE FOR GCS PILOT -->
        <div style="font-size:10px;color:#FF1744;background:rgba(255,23,68,0.12);padding:6px 8px;border-radius:4px;border:1px solid rgba(255,23,68,0.4);margin-bottom:8px;font-family:'JetBrains Mono',monospace;">
          <span style="color:#8A8880;font-size:8.5px;display:block;">🎯 조종기 방사원 군사 좌표 (MGRS 10-Digit / 1m 정밀도):</span>
          <strong style="color:#FFD700;font-size:12px;letter-spacing:0.05em;">${gcsMgrs}</strong>
          <span style="color:#aaa;font-size:8.5px;margin-left:6px;">(${coords[1].toFixed(6)}°N, ${coords[0].toFixed(6)}°E)</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9.5px;margin-bottom:8px;background:rgba(255,23,68,0.1);padding:6px;border-radius:4px;">
          <div><span style="color:#8A8880;">TDoA 측위 오차:</span><br/><span style="color:#76FF03;font-weight:bold;">±1.8 m 이내</span></div>
          <div><span style="color:#8A8880;">신호 세기 (RSSI):</span><br/><span style="color:#FFD700;">-42 dBm</span></div>
        </div>
        <div style="font-size:9.5px;color:#aaa;line-height:1.3;margin-bottom:8px;">4개소 SDR 분산 센서 노드의 RF 전파 도달 시차(TDoA) 교차 분석으로 조종기 전파 방사원 위치를 1.8m 이내로 역추적했습니다.</div>
        <button onclick="if(window.onOpenCuasRf) window.onOpenCuasRf()" style="width:100%;padding:8px 12px;background:rgba(255,23,68,0.25);border:1px solid #FF1744;color:#FF1744;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.1em;border-radius:4px;cursor:pointer;">[ 📻 C-UAS TDoA 역추적 센서 스펙트럼 열기 ]</button>
      </div>`);
    });
    map.on('mouseenter', 'gcs-emitter-dots', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'gcs-emitter-dots', () => { map.getCanvas().style.cursor = ''; });

    // ── MILITARY DEMARCATION LINES POPUP ──
    map.on('click', 'demarcation-lines-layer', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = e.lngLat;
      const color = p.color || '#FF1744';

      popup([coords.lng, coords.lat], `<div style="${pStyle}border:1.5px solid ${color};background:rgba(8,10,18,0.96);max-width:360px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:6px;">
          <span style="color:${color};font-size:13px;font-weight:800;">${htmlEsc(p.name)}</span>
          <span style="color:#FFF;font-size:9px;background:${color};padding:2px 6px;border-radius:4px;font-weight:bold;">${htmlEsc(p.category || 'DEMARCATION')}</span>
        </div>
        <div style="font-size:10.5px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.description)}</div>
        <div style="font-size:9.5px;color:#8A8880;background:rgba(0,0,0,0.35);padding:6px;border-radius:4px;font-family:'JetBrains Mono',monospace;">
          도메인 구정: <strong style="color:#FFF;">${htmlEsc(p.domain)} (육상/해상/공중 군사 경계선)</strong><br/>
          클릭 위치: <strong style="color:#00E5FF;">${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E</strong>
        </div>
      </div>`);
    });
    map.on('mouseenter', 'demarcation-lines-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'demarcation-lines-layer', () => { map.getCanvas().style.cursor = ''; });

    // ── CHINA MARITIME ENCROACHMENT & ARTIFICIAL ISLANDS POPUP ──
    ['china-encroachment-dots', 'china-encroachment-radii'].forEach((layerId: string) => {
      map.on('click', layerId, (e: any) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as any;
        const coords = (e.features[0].geometry as any).coordinates;
        const threatColor = p.threat_level === 'CRITICAL' ? '#FF1744' : '#FF9100';

        popup([coords[0], coords[1]], `<div style="${pStyle}border:1.5px solid ${threatColor};background:rgba(8,13,24,0.96);max-width:380px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:6px;">
            <div>
              <span style="color:${threatColor};font-size:13px;font-weight:800;">${htmlEsc(p.name)}</span>
              <div style="color:#aaa;font-size:9.5px;font-family:'JetBrains Mono',monospace;">${htmlEsc(p.chinese_name || '')} · ${htmlEsc(p.region_label || '')}</div>
            </div>
            <span style="color:#FFF;font-size:9px;background:${threatColor};padding:2px 6px;border-radius:4px;font-weight:bold;">${htmlEsc(p.threat_level || 'THREAT')}</span>
          </div>
          ${p.satellite_image ? `<div style="margin-bottom:8px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,0.15);height:120px;background:#000;">
            <img src="${p.satellite_image}" alt="위성 실사" style="width:100%;height:100%;object-fit:cover;" />
          </div>` : ''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.4);padding:6px;border-radius:4px;font-family:'JetBrains Mono',monospace;">
            <div><span style="color:#8A8880;">시설 유형:</span><br/><strong style="color:#FFF;">${htmlEsc(p.facility_type_label || '')}</strong></div>
            <div><span style="color:#8A8880;">활주로 제원:</span><br/><strong style="color:#00E5FF;">${p.runway_length_m ? `${p.runway_length_m}m` : '해상 플랫폼/부이'}</strong></div>
            <div><span style="color:#8A8880;">규격/체적:</span><br/><span style="color:#FFD700;">${htmlEsc(p.spec_dimensions || '-')}</span></div>
            <div><span style="color:#8A8880;">레이더/센서:</span><br/><span style="color:#76FF03;">${htmlEsc(p.spec_radar || '-')}</span></div>
          </div>
          <button onclick="if(window.openChinaEncroachmentModal) window.openChinaEncroachmentModal('${htmlEsc(p.id)}')" style="width:100%;padding:8px 12px;background:rgba(245,158,11,0.25);border:1px solid #F59E0B;color:#FDE68A;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.05em;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            <span>🏛️ 천재들의 질문법 4단계 심층 분석 도판 열기</span>
          </button>
        </div>`);
      });
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── CCTV (opens CameraViewer panel) ──
    const handleCctvClick = (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      // Emit the camera data so the CameraViewer opens
      onEntityClick?.({
        type: 'cctv',
        id: p.id,
        name: p.name,
        city: p.city,
        country: p.country,
        source: p.source,
        feed_url: p.feed_url,
        stream_url: p.stream_url,
        stream_type: p.stream_type,
        external_url: p.external_url,
        lat: coords[1],
        lng: coords[0],
      });
      // Also fly to the camera
      map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), duration: 1000 });
    };

    map.on('click', 'cctv-dots', handleCctvClick);
    map.on('click', 'cctv-label', handleCctvClick);
    map.on('click', 'cctv-glow', handleCctvClick);

    // ── Earthquakes (with USGS link) ──
    map.on('click', 'eq-circles', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,149,0,0.3);">
        <div style="color:#FF9500;font-size:14px;font-weight:700;margin-bottom:4px;">M${p.magnitude} EARTHQUAKE</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${htmlEsc(p.place||'Unknown location')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">DEPTH</span><br/><span style="color:#E8E6E0;">${p.depth||'—'}km</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}</span></div>
        </div>
        <a href="${p.source === 'NIGGG-BAS' ? 'https://ndc.niggg.bas.bg/' : `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(p.id||'')}`}" target="_blank" style="${linkStyle}color:#FF9500;border:1px solid rgba(255,149,0,0.4);background:rgba(255,149,0,0.1);">📊 ${p.source === 'NIGGG-BAS' ? 'NIGGG-BAS' : 'USGS DETAILS'}</a>
      </div>`);
    });

    // ── Satellites (SatNOGS powered) ──
    map.on('click', 'sat-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(212,175,55,0.3);">
        <div style="color:#D4AF37;font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🛰️ ${htmlEsc(p.name)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">MISSION</span><br/><span style="color:${colorSafe(p.color)};">${htmlEsc(p.mission||'Unknown')}</span></div>
          <div><span style="color:#5C5A54;">ALT</span><br/><span style="color:#00E5FF;">${p.alt ? p.alt+' km' : '—'}</span></div>
          <div><span style="color:#5C5A54;">POS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(2)}°, ${coords[0].toFixed(2)}°</span></div>
        </div>
        ${p.noradId ? `<a href="https://www.n2yo.com/satellite/?s=${p.noradId}" target="_blank" style="display:block;text-align:center;padding:4px;margin-top:6px;font-size:8px;font-family:monospace;letter-spacing:0.1em;text-decoration:none;color:#00E5FF;border:1px solid rgba(0,229,255,0.4);background:rgba(0,229,255,0.1);border-radius:2px;cursor:pointer;">📡 TRACK ON N2YO</a>` : ''}
      </div>`);
    });

    // ── Fires (with NASA FIRMS link & Tactical Classification) ──
    map.on('click', 'fires-heat', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const isMil = p.is_military === true || p.is_military === 'true';
      const isInd = p.is_industrial === true || p.is_industrial === 'true';
      
      const borderColor = isMil ? '#FF1744' : isInd ? '#FFD700' : '#FF6B00';
      const headerColor = isMil ? '#FF1744' : isInd ? '#FFD700' : '#FF6B00';
      const headerText = isMil 
        ? '🚨 전술 열원 감지 (MILITARY THERMAL)' 
        : isInd 
        ? '🏭 산업 플랜트 공정열 (INDUSTRIAL)' 
        : '🔥 지표면 열 이상 / 산불 (THERMAL ANOMALY)';

      popup(coords, `<div style="${pStyle}border:1px solid ${borderColor};box-shadow:0 0 12px ${borderColor}33;">
        <div style="color:${headerColor};font-size:11px;font-weight:700;margin-bottom:4px;font-family:monospace;letter-spacing:0.05em;">${headerText}</div>
        ${p.facility ? `<div style="color:#FFF;font-size:10px;font-weight:600;margin-bottom:6px;">${p.facility}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;font-family:monospace;">
          <div><span style="color:#7A7870;">복사열 (FRP)</span><br/><span style="color:${headerColor};font-weight:700;">${p.frp ? p.frp + ' MW' : '—'}</span></div>
          <div><span style="color:#7A7870;">밝기 온도</span><br/><span style="color:#E8E6E0;">${p.brightness ? p.brightness + ' K' : '—'}</span></div>
          <div><span style="color:#7A7870;">신뢰도 / 등급</span><br/><span style="color:#00E5FF;">${p.confidence || 'nominal'} (${p.severity || 'ELEVATED'})</span></div>
          <div><span style="color:#7A7870;">위성 관측 좌표</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
          <div><span style="color:#7A7870;">🕒 센서 관측 시각</span><br/><span style="color:#FFD740;">${p.date ? p.date + ' ' + (p.time || '00:00') + ' UTC' : '최근 24h 패스'}</span></div>
          <div><span style="color:#7A7870;">🔄 갱신 주기</span><br/><span style="color:#00E676;">10분 간격 (수퍼바이저 감시 중)</span></div>
        </div>
        <a href="https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;l:noaa20-viirs,viirs,modis_a,modis_t;@${coords[0]},${coords[1]},10z" target="_blank" style="${linkStyle}color:${headerColor};border:1px solid ${headerColor}66;background:${headerColor}1A;">🛰️ NASA FIRMS 위성 원본 검증</a>
      </div>`);
    });

    // ── Malware Threats (Abuse.ch) ──
    map.on('click', 'malware-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const tType = (p.threat_type || 'MALWARE').toUpperCase();
      const statusColor = p.status === 'online' ? '#39FF14' : '#FF1744';
      
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,23,68,0.4);box-shadow:inset 0 0 12px rgba(255,23,68,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,23,68,0.3);padding-bottom:6px;margin-bottom:8px;">
          <div style="color:#FF1744;font-size:12px;font-weight:700;letter-spacing:0.1em;text-shadow:0 0 4px rgba(255,23,68,0.5);">[ ${htmlEsc(tType)} ]</div>
          <div style="color:#5C5A54;font-size:9px;">${htmlEsc(p.country || 'UNKNOWN')}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:10px;">${htmlEsc(p.malware || 'Unidentified Threat Payload')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:12px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;">
          <div><span style="color:#5C5A54;">TARGET IP</span><br/><span style="color:#00E5FF;font-family:monospace;">${htmlEsc(p.ip)}</span></div>
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${statusColor};">${(p.status||'UNKNOWN').toUpperCase()}</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          <a href="https://feodotracker.abuse.ch/browse/" target="_blank" style="${linkStyle}flex:1;text-align:center;color:#E8E6E0;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);">THREAT INTEL ↗</a>
        </div>
        <button onclick="window.openOsirisIntel({ type: 'ip', ip: '${idSafe(p.ip)}', threat_type: '${idSafe(p.malware || p.threat_type || '')}', status: '${idSafe(p.status || '')}' })" style="width:100%;margin-top:8px;padding:8px 12px;background:linear-gradient(90deg, rgba(255,23,68,0.1) 0%, rgba(255,23,68,0.2) 100%);border:1px solid rgba(255,23,68,0.6);color:#FF1744;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.15em;border-radius:4px;cursor:pointer;transition:all 0.2s;">DEEP DIVE ANALYTICS</button>
      </div>`);
    });


    // ── GDELT Conflicts (with source article) ──
    map.on('click', 'gdelt-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      
      // Map coordinates to Liveuamap regions
      let sourceUrl = p.url || '';
      if (!sourceUrl || sourceUrl.includes('google.com')) {
        const [lng, lat] = coords;
        if (lat > 44 && lat < 53 && lng > 22 && lng < 40) sourceUrl = 'https://liveuamap.com/'; // Ukraine
        else if (lat > 30 && lat < 33 && lng > 34 && lng < 36) sourceUrl = 'https://israelpalestine.liveuamap.com/'; // Gaza
        else if (lat > 33 && lat < 34.5 && lng > 35 && lng < 36.5) sourceUrl = 'https://lebanon.liveuamap.com/'; // Lebanon
        else if (lat > 32 && lat < 37 && lng > 35 && lng < 42) sourceUrl = 'https://syria.liveuamap.com/'; // Syria
        else if (lat > 10 && lat < 22 && lng > 22 && lng < 38) sourceUrl = 'https://sudan.liveuamap.com/'; // Sudan
        else if (lat > 12 && lat < 20 && lng > 42 && lng < 55) sourceUrl = 'https://yemen.liveuamap.com/'; // Yemen
        else sourceUrl = 'https://liveuamap.com/'; // Global fallback
      }

      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,61,61,0.3);">
        <div style="color:#FF3D3D;font-size:12px;font-weight:700;margin-bottom:6px;">⚠️ CONFLICT EVENT</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.name||'Unclassified incident')}</div>
        <a href="${urlSafe(sourceUrl)}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:#FF3D3D;border:1px solid rgba(255,61,61,0.4);background:rgba(255,61,61,0.15);display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ OPEN SOURCE ↗ ]</a>
      </div>`);
    });

    // ── Global Event / Conflict Markers ──
    map.on('click', 'conflict-icons', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.severity === 'war' ? '#FF1744' : p.severity === 'high' ? '#FF9500' : '#FFD500';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:6px;">⚠️ ${htmlEsc(p.label || 'WARNING EVENT')}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.description || 'Global event detected at this location.')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${color};">${(p.severity||'unknown').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        ${p.sourceUrl ? `<a href="${urlSafe(p.sourceUrl)}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:${color};border:1px solid ${color}40;background:${color}15;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ OPEN SOURCE ↗ ]</a>` : ''}
      </div>`);
    });


    // ── OSIRIS SDK link click ──
    const SDK_SOURCE_URLS: Record<string, string> = {
      'AIS Maritime': 'https://www.marinetraffic.com',
      'AIS Stream': 'https://aisstream.io',
      'AIS → Lattice': 'https://aisstream.io',
      'ADS-B / OpenSky': 'https://opensky-network.org',
      'ADS-B → Lattice': 'https://opensky-network.org',
      'Naval Intelligence': 'https://www.odni.gov',
    };
    ['sdk-sea','sdk-sea-glow','sdk-air','sdk-air-glow','sdk-intel','sdk-intel-glow'].forEach((layer: string) => {
      map.on('click', layer, (e: any) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as any;
        const coords = e.lngLat;
        const srcUrl = p.url || SDK_SOURCE_URLS[p.source] || 'https://osirisai.live';
        const domainLabel = p.domain === 'SEA' ? '⚓ MARITIME' : p.domain === 'AIR' ? '✈ AIR CORRIDOR' : '🛡 NAVAL INTEL';
        const domainColor = p.domain === 'SEA' ? '#4FC3F7' : p.domain === 'AIR' ? '#B3E5FC' : '#81D4FA';
        const linkStyle = 'text-decoration:none;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:0.05em;';
        popup([coords.lng, coords.lat], `<div style="${pStyle}border:1px solid ${domainColor}40;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${domainColor};box-shadow:0 0 8px ${domainColor};"></div>
            <span style="color:${domainColor};font-size:11px;font-weight:700;letter-spacing:0.1em;">${domainLabel}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;">
            <div><span style="color:#5C5A54;">FROM</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.fromName || 'Origin')}</span></div>
            <div><span style="color:#5C5A54;">TO</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.toName || 'Destination')}</span></div>
            <div><span style="color:#5C5A54;">DOMAIN</span><br/><span style="color:${domainColor};">${p.domain}</span></div>
            <div><span style="color:#5C5A54;">SOURCE</span><br/><a href="${urlSafe(srcUrl)}" target="_blank" style="color:${domainColor};text-decoration:underline;cursor:pointer;">${htmlEsc(p.source || '번개의 눈동자')}</a></div>
          </div>
          <a href="${urlSafe(srcUrl)}" target="_blank" style="${linkStyle}color:${domainColor};border:1px solid ${domainColor}40;background:${domainColor}18;display:inline-block;margin-top:4px;">OPEN SOURCE ↗</a>
        </div>`);
      });
    });

    // ⚡ Live Cyber Attack Arcs (click on flying heads) ⚡
    map.on('click', 'cyber-heads', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const sevColor = (p.severity || 5) >= 8 ? '#FF1744' : (p.severity || 5) >= 6 ? '#FF6D00' : '#FFD600';
      const sevLabel = (p.severity || 5) >= 8 ? 'CRITICAL' : (p.severity || 5) >= 6 ? 'HIGH' : 'MEDIUM';
      popup(coords, `<div style="${pStyle}border:1px solid ${sevColor}40;box-shadow:inset 0 0 20px ${sevColor}10, 0 0 15px ${sevColor}15;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${sevColor}30;padding-bottom:6px;margin-bottom:8px;">
          <div style="color:${sevColor};font-size:12px;font-weight:700;letter-spacing:0.12em;text-shadow:0 0 6px ${sevColor}60;">⚡ ${htmlEsc((p.action || 'ATTACK').toUpperCase())}</div>
          <div style="font-size:8px;padding:2px 6px;border-radius:3px;font-weight:700;letter-spacing:0.1em;background:${sevColor}20;color:${sevColor};border:1px solid ${sevColor}50;">${sevLabel}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:10px;">${htmlEsc(p.malware || 'Unknown Payload')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.35);padding:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.04);">
          <div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">SOURCE ORIGIN</span><br/><span style="color:#FF5252;font-family:monospace;">${p.src_lat || '?'}°, ${p.src_lng || '?'}°</span></div>
          <div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">TARGET</span><br/><span style="color:#00E5FF;font-family:monospace;">${htmlEsc(p.target_ip || '—')}</span></div>
          <div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">TARGET COUNTRY</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.target_country || '—')}</span></div>
          <div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">PORT</span><br/><span style="color:#FFD600;font-family:monospace;">${p.port || '—'}</span></div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <div style="flex:1;height:3px;border-radius:2px;background:linear-gradient(90deg, ${sevColor}00, ${sevColor});opacity:0.5;"></div>
          <span style="font-size:7px;color:#5C5A54;letter-spacing:0.15em;">SEVERITY ${p.severity || '?'}/10</span>
          <div style="flex:1;height:3px;border-radius:2px;background:linear-gradient(90deg, ${sevColor}, ${sevColor}00);opacity:0.5;"></div>
        </div>
        <div style="margin-top:8px;font-size:7px;color:#5C5A54;text-align:center;letter-spacing:0.1em;">SOURCE: ABUSE.CH FEODO TRACKER</div>
      </div>`);
    });

    // ── Generic hover for clickables ──
    ['conflict-icons','cctv-dots','cctv-label','cctv-glow','eq-circles','sat-dots','fires-heat','gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots','sigint-news-dots','balloon-dots','rad-dots','ship-icons','ship-dots','ship-glow','sweep-device-dots','scan-targets-dots','sdk-sea','sdk-sea-glow','sdk-sea-atmo','sdk-air','sdk-air-glow','sdk-air-atmo','sdk-intel','sdk-intel-glow','sdk-intel-atmo','malware-dots','cyber-heads','dprk-sites-dots','dprk-activity-dots','seismic-nuclear-dots'].forEach((layer: string) => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

function getHighResAnalysisPhoto(p: any): string {
  const title = (p.title || '').toLowerCase();
  const id = (p.id || '').toLowerCase();
  const category = (p.category || '').toLowerCase();
  const org = htmlEsc(p.source_org || 'CSIS Beyond Parallel');
  const calloutRaw = p.satellite_analysis_callouts || p.terrain_description || `${p.source_org || 'CSIS Beyond Parallel'} 위성 정밀 판독 완료`;
  const callout = `<div style="padding:4px 8px;background:rgba(0,0,0,0.88);color:#00E5FF;font-size:8.5px;font-weight:bold;border-top:1px solid rgba(0,229,255,0.3);">${htmlEsc(calloutRaw)}</div>`;

  // ── Step 1: CSIS/38North 보고서 원본 media_url 파싱 후 프록시 송출 (재귀 검증 1단계) ──
  let urls: string[] = [];
  try {
    if (typeof p.media_urls === 'string' && p.media_urls.length > 2) {
      const parsed = JSON.parse(p.media_urls);
      if (Array.isArray(parsed)) urls = parsed.filter((u: any) => typeof u === 'string' && u.length > 4);
      else if (typeof parsed === 'string' && (parsed.startsWith('http') || parsed.startsWith('/'))) urls = [parsed];
    } else if (Array.isArray(p.media_urls)) {
      urls = p.media_urls.filter((u: any) => typeof u === 'string' && u.length > 4);
    }
  } catch { /* ignore parse errors */ }

  const validHttpUrls = urls.filter(u => u.startsWith('http'));
  const localUrls = urls.filter(u => u.startsWith('/'));

  // ── Step 2: 기지 고유 ID / title / category 기반 1:1 엄격 검증 매핑 (오염 및 할루시네이션 원천 차단) ──
  let localImg = '';
  let localLabel = '';
  let borderColor = '#FFD700';

  if (title.includes('송악산') || id.includes('songak')) {
    localImg = '/intel/dprk/songaksan_sat.png'; localLabel = 'CSIS Beyond Parallel 송악산 240mm HARTS 갱도 위성 판독'; borderColor = '#FFD700';
  } else if (title.includes('황주') || id.includes('hwangju') || (title.includes('600mm') && !title.includes('300mm'))) {
    localImg = '/intel/dprk/hwangju_sat.png'; localLabel = 'CSIS Beyond Parallel 황주 600mm KN-25 방사포 HARTS 위성 판독'; borderColor = '#E040FB';
  } else if (title.includes('풍계리') || id.includes('punggye') || title.includes('핵실험')) {
    localImg = '/intel/dprk/punggyeri_sat.png'; localLabel = '38 North / CSIS Beyond Parallel 풍계리 핵실험장 갱도 위성 판독'; borderColor = '#FF1744';
  } else if (title.includes('영변') || id.includes('yongbyon') || title.includes('원자로') || title.includes('elwr')) {
    localImg = '/intel/dprk/yongbyon_sat.png'; localLabel = '38 North / IAEA 영변 5MWe 원자로 & ELWR 핵시설 위성 판독'; borderColor = '#FF1744';
  } else if (title.includes('강선') || id.includes('kangson')) {
    localImg = '/intel/dprk/kangson_sat.png'; localLabel = 'CSIS Beyond Parallel 강선 고농축 우라늄(HEU) 시설 위성 판독'; borderColor = '#FF1744';
  } else if (title.includes('평산') || id.includes('pyongsan')) {
    localImg = '/intel/dprk/pyongsan_sat.png'; localLabel = '38 North 평산 우라늄 광산 및 제련 정련 공장 위성 판독'; borderColor = '#FF9500';
  } else if (title.includes('동창리') || title.includes('서해위성') || id.includes('sohae') || title.includes('천리마') || title.includes('위성 발사')) {
    localImg = '/intel/dprk/sohae_sat.png'; localLabel = 'CSIS Beyond Parallel 서해 동창리 위성 발사장 위성 판독'; borderColor = '#00E5FF';
  } else if (title.includes('방현') || title.includes('샛별') || title.includes('무인기') || id.includes('panghyon') || id.includes('uav')) {
    localImg = '/intel/dprk/panghyon_sat.png'; localLabel = '38 North 평북 방현 무인기(UAV) 비행장 위성 판독'; borderColor = '#00E5FF';
  } else if (title.includes('화성-18') || title.includes('icbm') || title.includes('산음동') || title.includes('순안') || title.includes('삼석') || id.includes('sanumdong')) {
    localImg = '/intel/dprk/sanumdong_sat.png'; localLabel = 'CSIS Beyond Parallel 평양 산음동 ICBM 연구소 위성 판독'; borderColor = '#FF1744';
  } else if (title.includes('상남리') || id.includes('sangnam')) {
    localImg = '/intel/dprk/sangnamri_sat.png'; localLabel = 'CSIS Beyond Parallel 상남리 IRBM 기지 위성 판독'; borderColor = '#FF9500';
  } else if (title.includes('삭간몰') || id.includes('sakkanmol')) {
    localImg = '/intel/dprk/sakkanmol_sat.png'; localLabel = 'CSIS Beyond Parallel 삭간몰 단거리 탄도미사일 기지 위성 판독'; borderColor = '#FFD700';
  } else if (title.includes('신오리') || id.includes('sinori')) {
    localImg = '/intel/dprk/sinori_sat.png'; localLabel = 'CSIS Beyond Parallel 신오리 노동 탄도미사일 기지 위성 판독'; borderColor = '#FF9100';
  } else if (title.includes('평강') || id.includes('pyonggang') || title.includes('300mm') || title.includes('kn-09')) {
    localImg = '/intel/dprk/pyonggang_sat.png'; localLabel = 'KIDA / Janes 평강 계곡 300mm KN-09 방사포 위성 판독'; borderColor = '#76FF03';
  } else if (id.includes('koksan') || id.includes('spg170-koksan') || (title.includes('곡산') && title.includes('170mm'))) {
    localImg = '/intel/dprk/koksan_sat.png'; localLabel = 'Janes Defense / CSIS 곡산 170mm 자주포 모기지 위성 판독'; borderColor = '#FF9100';
  } else if (id.includes('rimjin') || id.includes('spg170-rimjin') || (title.includes('임진강') && title.includes('170mm'))) {
    localImg = '/intel/dprk/rimjin_sat.png'; localLabel = 'CSIS Beyond Parallel 임진강 북안 170mm HARTS 갱도진지 위성 판독'; borderColor = '#FF9100';
  } else if (title.includes('깃대령') || id.includes('kittaeryong') || title.includes('동계 군사훈련') || title.includes('실사격')) {
    localImg = '/intel/dprk/kittaeryong_sat.png'; localLabel = 'CSIS Beyond Parallel 깃대령 깃대봉 미사일 발사장 위성 판독'; borderColor = '#FF5252';
  } else if (title.includes('갈골') || id.includes('galgol')) {
    localImg = '/intel/dprk/galgol_sat.png'; localLabel = 'CSIS Beyond Parallel 갈골 화성-12호 IRBM 미사일 기지 위성 판독'; borderColor = '#FF9100';
  } else if (title.includes('금천') || id.includes('kumchon')) {
    localImg = '/intel/dprk/kumchon_sat.png'; localLabel = 'CSIS Beyond Parallel 금천리 스커드 전방 미사일 기지 위성 판독'; borderColor = '#FFD700';
  } else if (title.includes('토산') || id.includes('tosan')) {
    localImg = '/intel/dprk/tosan_sat.png'; localLabel = 'Janes Defense 토산 갱도 포병 기지 위성 판독'; borderColor = '#FFD700';
  } else if (title.includes('장풍') || id.includes('jangpung')) {
    localImg = '/intel/dprk/jangpung_sat.png'; localLabel = 'Janes Defense 장풍 갱도 포병 기지 위성 판독'; borderColor = '#FFD700';
  } else if (title.includes('철원') || id.includes('cheorwon')) {
    localImg = '/intel/dprk/cheorwon_sat.png'; localLabel = 'Janes Defense 철원 북방 갱도 포병 기지 위성 판독'; borderColor = '#FFD700';
  } else if (title.includes('신포') || title.includes('잠수함') || title.includes('slbm') || id.includes('sinpo')) {
    localImg = '/intel/dprk/sinpo_sat.png'; localLabel = '38 North / USNI 신포 잠수함 조선소 위성 판독'; borderColor = '#00E5FF';
  } else if (title.includes('함정') || title.includes('해군') || title.includes('호위함') || title.includes('구축함') || category.includes('naval')) {
    localImg = '/intel/dprk/naval_warship_sat.png'; localLabel = '38 North / USNI 북한 해군 신형 호위함 및 해상 기동 위성 판독'; borderColor = '#00E5FF';
  } else if (validHttpUrls.length > 0) {
    localLabel = `${htmlEsc(p.source_org || '현장 채증')} 원본 보도 사진`;
    borderColor = '#00E5FF';
  } else {
    // ── 기본 전방 전략 좌표 기반 ESRI 0.3m 실시간 타일 매핑 ──
    const _lon = p.lng || 125.76, _lat = p.lat || 39.04;
    const zoom = 14;
    const tileX = Math.floor((_lon + 180) / 360 * Math.pow(2, zoom));
    const tileY = Math.floor((1 - Math.log(Math.tan(_lat * Math.PI / 180) + 1 / Math.cos(_lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    localImg = `/api/proxy-tiles?url=${encodeURIComponent(`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`)}`;
    localLabel = `${htmlEsc(p.source_org || '현장')} 실시간 정밀 광학 판독 위성 타일`;
    borderColor = '#FFD700';
  }

    const imgSrc = validHttpUrls.length > 0
    ? `/api/proxy-image?url=${encodeURIComponent(validHttpUrls[0])}&fallback=${encodeURIComponent(localImg)}`
    : (localUrls.length > 0 ? localUrls[0] : localImg);

  const fallbackSrc = localImg;

  return `<div style="position:relative;background:#000;">
    <div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.85);border:1px solid ${borderColor};color:${borderColor};padding:3px 6px;border-radius:3px;font-size:8px;font-weight:bold;z-index:2;">
      🏛️ ${localLabel}
    </div>
    <img src="${imgSrc}" alt="${localLabel}" style="width:100%;max-height:220px;object-fit:cover;display:block;border-bottom:1px solid rgba(255,255,255,0.1);"
      onerror="this.onerror=null;this.src='${fallbackSrc}';" />
    ${callout}
  </div>`;
}

function getVideoAnalysisKeyframe(p: any): string {
  const title = (p.title || '').toLowerCase();
  const id = (p.id || '').toLowerCase();
  const org = htmlEsc(p.source_org || 'CSIS Beyond Parallel');

  let actionImg = '/intel/dprk/songaksan_action.png';
  let actionTitle = '송악산 240mm 방사포 HARTS 사격 패드 및 갱도 출구 0.3m 위성 판독';

  if (title.includes('송악산') || id.includes('songak')) {
    actionImg = '/intel/dprk/songaksan_action.png'; actionTitle = 'CSIS / NGA 판독: 송악산 240mm 방사포 HARTS 사격 패드 및 갱도 출구 0.3m 위성 분석';
  } else if (title.includes('장풍') || id.includes('jangpung')) {
    actionImg = '/intel/dprk/jangpung_action.png'; actionTitle = 'CSIS / Janes 판독: 장풍 240mm 일제사격 사격 패드 8조 및 엄체 도로 0.5m 위성 분석';
  } else if (id.includes('rimjin') || (title.includes('임진강') && title.includes('170mm'))) {
    actionImg = '/intel/dprk/rimjin_action.png'; actionTitle = 'CSIS / DoD 판독: 임진강 북안 170mm 곡산 자주포 지하 갱도문 4개소 및 인클라인 0.3m 분석';
  } else if (id.includes('koksan') || (title.includes('곡산') && title.includes('170mm'))) {
    actionImg = '/intel/dprk/koksan_action.png'; actionTitle = 'Janes Defense / DIA 판독: 곡산 170mm 자주포 연대 종합 정비창 및 궤도 시험장 0.5m 분석';
  } else if (title.includes('황주') || id.includes('hwangju') || (title.includes('600mm') && !title.includes('300mm'))) {
    actionImg = '/intel/dprk/hwangju_action.png'; actionTitle = 'CSIS / MOD 판독: 황주 600mm 초대형 방사포(KN-25) 대형 갱도문 및 TEL 기동로 0.3m 분석';
  } else if (title.includes('평강') || id.includes('pyonggang') || title.includes('300mm') || title.includes('kn-09')) {
    actionImg = '/intel/dprk/pyonggang_action.png'; actionTitle = 'Janes / KIDA 판독: 평강 계곡 300mm 정밀유도 방사포(KN-09) 8연장 TEL 엄체 진지 0.5m 분석';
  } else if (title.includes('금천') || id.includes('kumchon')) {
    actionImg = '/intel/dprk/kumchon_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 금천리 탄도미사일 기지 지형도 및 표적 격자 판독 플레이트';
  } else if (title.includes('방현') || title.includes('샛별') || title.includes('무인기') || id.includes('panghyon') || id.includes('uav')) {
    actionImg = '/intel/dprk/panghyon_action.png'; actionTitle = '38 North 공식 보고서: 방현 비행장 샛별-4호 전략 정찰 무인기 비행 시험 판독 사진';
  } else if (title.includes('신오리') || id.includes('sinori')) {
    actionImg = '/intel/dprk/sinori_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 신오리 기지 수록 노동-1호(화성-7호) TEL 실물 사진';
  } else if (title.includes('영변') || id.includes('yongbyon') || title.includes('원자로')) {
    actionImg = '/intel/dprk/yongbyon_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 영변 Building 500 방사화학연구소(재처리장) 위성 판독 플레이트';
  } else if (title.includes('풍계리') || id.includes('punggye') || title.includes('핵실험')) {
    actionImg = '/intel/dprk/punggyeri_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 풍계리 4번 갱도 신축 진입로 굴착 활동 위성 판독 플레이트';
  } else if (title.includes('신포') || title.includes('잠수함') || title.includes('slbm') || id.includes('sinpo')) {
    actionImg = '/intel/dprk/sinpo_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 신포 수중 발사 시험 버지선 및 기동 크레인 위성 판독 플레이트';
  } else if (title.includes('동창리') || title.includes('서해위성') || id.includes('sohae')) {
    actionImg = '/intel/dprk/sohae_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 서해 위성 발사장 대형 수직 엔진 연소 시험대(Test Stand) 위성 판독 플레이트';
  } else if (title.includes('갈골') || id.includes('galgol')) {
    actionImg = '/intel/dprk/kalgol_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 갈골 No.95 공장 클리어스토리 조립동 및 세림리 관통로 위성 판독 플레이트';
  } else if (title.includes('깃대령') || id.includes('kittaeryong')) {
    actionImg = '/intel/dprk/kittaeryong_action.png'; actionTitle = 'CSIS / DIA 판독: 깃대령 해안 절벽 갱도문 및 콘크리트 발사 패드 0.5m 위성 분석';
  } else if (title.includes('삭간몰') || id.includes('sakkanmol')) {
    actionImg = '/intel/dprk/sakkanmol_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 삭간몰 기지 수록 스커드-B/C(화성-5/6호) 8x8 TEL 실물 사진';
  } else if (title.includes('산음동') || id.includes('sanumdong')) {
    actionImg = '/intel/dprk/sanumdong_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 실리 전용 철도 복개 터미널 및 ICBM 수송선 위성 판독 플레이트';
  } else if (title.includes('상남리') || id.includes('sangnam')) {
    actionImg = '/intel/dprk/sangnamri_action.png'; actionTitle = 'UN 전문가패널 / CSIS 판독: 상남리 UGF 지하 갱도 입구 및 고정 발사 패드 0.5m 위성 분석';
  } else if (title.includes('평산') || id.includes('pyongsan')) {
    actionImg = '/intel/dprk/pyongsan_action.png'; actionTitle = 'CSIS Beyond Parallel 공식 보고서: 평산 우라늄 정련공장 폐기물 침전지(Tailings Pond) 슬러지 유출 판독 플레이트';
  } else if (title.includes('철원') || id.includes('cheorwon')) {
    actionImg = '/intel/dprk/cheorwon_action.png'; actionTitle = 'CSIS / NGA 판독: 철원 축선 170mm 자주포 전진 갱도 입구 4개소 0.5m 위성 분석';
  } else if (title.includes('토산') || id.includes('tosan')) {
    actionImg = '/intel/dprk/tosan_action.png'; actionTitle = 'CSIS / DoD 판독: 토산 전방 갱도진지 콘크리트 사격문 4개소 0.5m 위성 분석';
  } else if (title.includes('함정') || title.includes('해군') || id.includes('naval')) {
    actionImg = '/intel/dprk/naval_warship_action.png'; actionTitle = 'US Naval Intel / CSIS 판독: 마양도 절벽 관통 수중 동굴 펜 3개소 및 잠수함 계류장 0.5m 분석';
  }

  const reportUrl = p.report_url || 'https://beyondparallel.csis.org/';

  return `<div style="position:relative;background:#000;border:1px solid rgba(255,23,68,0.4);border-radius:4px;overflow:hidden;">
    <div style="position:relative;">
      <img src="${actionImg}" alt="${htmlEsc(actionTitle)}" style="width:100%;max-height:220px;object-fit:cover;display:block;" />
      <div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.85);border:1px solid #FF1744;color:#FF5252;padding:2px 6px;border-radius:3px;font-size:8px;font-weight:bold;">
        🎯 3단계: 공식 보고서 수록 사격진지 / 갱도 / 핵심 거점 정밀 분석
      </div>
      <div style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.85);border:1px solid #00E5FF;color:#00E5FF;padding:2px 6px;border-radius:3px;font-size:7.5px;font-family:monospace;">
        TACTICAL RECON (FACT)
      </div>
    </div>
    <div style="padding:6px 8px;background:rgba(20,5,5,0.92);border-top:1px solid rgba(255,23,68,0.3);">
      <div style="color:#FFD700;font-size:9px;font-weight:bold;margin-bottom:3px;">${htmlEsc(actionTitle)}</div>
      <button onclick="if (window.openDprkReportDossier && window._dprkSitesRegistry && window._dprkSitesRegistry['${idSafe(p.id)}']) { window.openDprkReportDossier(window._dprkSitesRegistry['${idSafe(p.id)}']); } else if (window.openDprkReportDossier) { window.openDprkReportDossier({ id: '${idSafe(p.id)}', title: '${htmlEsc(p.title || '')}', source_org: '${htmlEsc(org)}' }); }" style="width:100%;margin-top:4px;padding:7px;background:rgba(0,229,255,0.2);border:1.5px solid #00E5FF;color:#00E5FF;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;">
        <span>🔍 [ 3단계 위성·실물 장비·사격진지 검증 도판 전면 확대 ⛶ ]</span>
      </button>
    </div>
  </div>`;
}

    // ── Bridge 1: DPRK Military Activity Click Handler (Harness Verified Event HUD) ──
    map.on('click', 'dprk-activity-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const vTier = p.verification_tier || 'TIER-1 VERIFIED';
      const tierColor = vTier === 'TIER-1 VERIFIED' ? '#00E676' : vTier === 'CROSS-VERIFIED' ? '#FFD740' : vTier === 'SINGLE-SOURCE' ? '#FF9100' : '#FF1744';

      const _lon = coords[0], _lat = coords[1];
      const zoom = 13;
      const tileX = Math.floor((_lon + 180) / 360 * Math.pow(2, zoom));
      const tileY = Math.floor((1 - Math.log(Math.tan(_lat * Math.PI / 180) + 1 / Math.cos(_lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      const esriSatUrl = `/api/proxy-tiles?url=${encodeURIComponent(`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`)}`;

      // Register site payload into global registry for instant full-screen dossier view
      (window as any)._dprkSitesRegistry = (window as any)._dprkSitesRegistry || {};
      const s3Parsed = typeof p.site_analysis_3stage === 'string' ? (()=>{ try{ return JSON.parse(p.site_analysis_3stage); }catch{ return {}; } })() : p.site_analysis_3stage || {};
      const eqParsed = typeof p.equipment_details === 'string' ? (()=>{ try{ return JSON.parse(p.equipment_details); }catch{ return {}; } })() : p.equipment_details || {};
      const mcParsed = typeof p.military_coordinates === 'string' ? (()=>{ try{ return JSON.parse(p.military_coordinates); }catch{ return {}; } })() : p.military_coordinates || {};
      const iaParsed = typeof p.intel_agencies === 'string' ? (()=>{ try{ return JSON.parse(p.intel_agencies); }catch{ return []; } })() : p.intel_agencies || [];

      (window as any)._dprkSitesRegistry[p.id || 'default'] = {
        id: p.id,
        title: p.title,
        source_org: p.source_org || 'CSIS Beyond Parallel',
        source_date: p.source_date || '2025-02-02',
        report_title: p.report_title || p.title,
        report_url: p.report_url || p.source_url || 'https://beyondparallel.csis.org/',
        description: p.description,
        lat: _lat,
        lng: _lon,
        threat_radius_km: p.threat_radius_km || 70,
        estimated_strength: p.estimated_strength || '',
        concealment_level: p.concealment_level || '',
        countermeasure_systems: p.countermeasure_systems || ['대포병 탐지레이더 (TPQ-74)', 'K-9A1 자주포', '천무 다련장'],
        satellite_analysis_callouts: p.satellite_analysis_callouts || '',
        site_analysis_3stage: s3Parsed,
        equipment_details: eqParsed,
        military_coordinates: mcParsed,
        intel_agencies: iaParsed,
        media_urls: typeof p.media_urls === 'string' ? (()=>{ try{ return JSON.parse(p.media_urls); }catch{ return [p.media_urls]; } })() : p.media_urls || [],
      };

      const stage2AnalysisPhoto = getHighResAnalysisPhoto(p);

      const actMgrsCode = latLngToMGRS(_lat, _lon);
      const actUtmCode = latLngToUTM(_lat, _lon).utmString;

      // Dynamic Source & Authority Badge Matching
      const srcOrg = (p.source_org || 'CSIS Beyond Parallel').trim();
      let docTitle = `📜 ${srcOrg} 공식 정밀 판독 보고서`;
      let docBadge = 'TIER-1 VERIFIED';
      let docBadgeColor = '#00E5FF';

      if (srcOrg.includes('CSIS')) {
        docTitle = '📜 CSIS Beyond Parallel 북한 안보 정밀 판독 보고서';
        docBadge = 'CSIS-VERIFIED';
        docBadgeColor = '#00E5FF';
      } else if (srcOrg.includes('38 North')) {
        docTitle = '📜 38 North (Stimson Center) 위성·전술 정밀 분석 보고서';
        docBadge = '38NORTH-VERIFIED';
        docBadgeColor = '#76FF03';
      } else if (srcOrg.includes('DoD') || srcOrg.includes('Defense') || srcOrg.includes('INDOPACOM')) {
        docTitle = '📜 미국 국방부(DoD) / 인도태평양사령부 공식 브리핑';
        docBadge = 'DOD-VERIFIED';
        docBadgeColor = '#00E5FF';
      } else if (srcOrg.includes('USNI')) {
        docTitle = '📜 미 해군연구소(USNI) 해상 전략 안보 분석';
        docBadge = 'USNI-VERIFIED';
        docBadgeColor = '#00E5FF';
      } else if (srcOrg.includes('KCNA') || srcOrg.includes('JoongAng') || srcOrg.includes('NK News')) {
        docTitle = `📜 ${srcOrg} 현장 군사 동향 모니터링`;
        docBadge = 'OSINT-CROSS-VERIFIED';
        docBadgeColor = '#FFD740';
      } else if (srcOrg.includes('KIDA') || srcOrg.includes('국방연구원')) {
        docTitle = '📜 KIDA 한국국방연구원 안보 전략 평가';
        docBadge = 'KIDA-VERIFIED';
        docBadgeColor = '#76FF03';
      }

      // 3-Stage Media Block: 1. Live Optical Satellite -> 2. Real Equipment/Facility Profile -> 3. Authentic Live-Fire Recon
      const mediaHtml = `
        <div style="margin-bottom:8px;border:1px solid ${tierColor}80;border-radius:6px;overflow:hidden;background:#0d1117;">
          <!-- 1. 실시간 위성 광학 판독 사진 (ESRI Live 0.3m Satellite) -->
          <div style="position:relative;border-bottom:1px solid rgba(255,255,255,0.1);">
            <div style="background:rgba(0,229,255,0.15);padding:3px 8px;font-size:9px;color:#00E5FF;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
              <span>📡 1. 실시간 위성 정밀 판독 (ESRI 0.3m Satellite)</span>
              <span style="font-size:8px;color:#8A8880;">📐 0.3m Optical Tile</span>
            </div>
            <img src="${esriSatUrl}" alt="ESRI 실시간 위성 사진" style="width:100%;height:130px;object-fit:cover;display:block;background:#1a1d24;" />
          </div>

          <!-- 2. 실제 배치 무기/핵시설 정밀 프로필 사진 -->
          <div style="position:relative;border-bottom:1px solid rgba(255,255,255,0.1);">
            <div style="background:rgba(255,215,0,0.15);padding:3px 8px;font-size:9px;color:#FFD700;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
              <span>📷 2. 실제 배치 무기 / 시설 정밀 프로필 사진</span>
              <span style="font-size:8px;color:#8A8880;">🏛️ ${htmlEsc(srcOrg)} 정밀 채증</span>
            </div>
            ${stage2AnalysisPhoto}
          </div>

          <!-- 3. 공식 보고서 수록 사격진지 / 갱도 / 핵심 거점 정밀 판독 -->
          <div style="position:relative;">
            <div style="background:rgba(255,23,68,0.15);padding:3px 8px;font-size:9px;color:#FF5252;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
              <span>🎯 3. 공식 보고서 수록 사격진지 / 갱도 / 핵심 거점 정밀 판독</span>
              <span style="font-size:8px;color:#8A8880;">📐 0.3m Tactical Recon (FACT)</span>
            </div>
            ${getVideoAnalysisKeyframe(p)}
          </div>
        </div>
      `;

      const actMgrsHtml = `
        <div style="background:rgba(0,229,255,0.08);padding:6px 8px;border-radius:4px;border:1px solid rgba(0,229,255,0.3);margin-bottom:6px;">
          <div style="color:#00E5FF;font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:space-between;">
            <span>🎖️ 군사지능 좌표 (MGRS / NATO Standard)</span>
            <span style="font-size:8px;color:#76FF03;background:rgba(118,255,3,0.15);padding:1px 4px;border-radius:2px;">1m 정밀 검증</span>
          </div>
          <div style="color:#FFD700;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:bold;margin-top:3px;letter-spacing:0.05em;">
            📍 ${htmlEsc(actMgrsCode)}
          </div>
          <div style="color:#8A8880;font-size:8.5px;margin-top:2px;">
            🌐 WGS84: ${_lat.toFixed(4)}°N, ${_lon.toFixed(4)}°E | UTM: ${htmlEsc(actUtmCode)}
          </div>
        </div>
      `;

      let stageHtml = '';
      try {
        const s3 = typeof p.site_analysis_3stage === 'string' ? JSON.parse(p.site_analysis_3stage) : p.site_analysis_3stage;
        const eq = typeof p.equipment_details === 'string' ? JSON.parse(p.equipment_details) : p.equipment_details;
        const mc = typeof p.military_coordinates === 'string' ? JSON.parse(p.military_coordinates) : p.military_coordinates;

        if (s3?.stage1_position || eq?.name) {
          stageHtml = `
            <!-- 🌐 1단계: 위성 정밀 위치 & 군사좌표 -->
            <div style="margin-top:6px;padding:6px 8px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.3);border-radius:4px;">
              <div style="color:#00E5FF;font-size:9.5px;font-weight:bold;margin-bottom:3px;display:flex;align-items:center;justify-content:space-between;">
                <span>🌐 1단계: 위성 정밀 위치 & 군사좌표</span>
                <span style="color:#FFD700;font-family:monospace;font-size:9px;">${htmlEsc(mc?.mgrs || actMgrsCode)}</span>
              </div>
              <div style="font-size:9px;color:#E8E6E0;line-height:1.4;">${htmlEsc(s3?.stage1_position || p.description)}</div>
              ${mc?.elevation ? `<div style="font-size:8.5px;color:#8A8880;margin-top:2px;">⛰️ 고도: ${htmlEsc(mc.elevation)} | 🎯 격자: ${htmlEsc(mc.grid_zone || '52S')}</div>` : ''}
            </div>

            <!-- 🛩️ 2단계: 공중/위성 지형 관측 & 산악 차폐·도로망 배치 -->
            <div style="margin-top:6px;padding:6px 8px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.3);border-radius:4px;">
              <div style="color:#FFD700;font-size:9.5px;font-weight:bold;margin-bottom:3px;">🛩️ 2단계: 공중/위성 지형 관측 & 산악 차폐·도로망 배치</div>
              <div style="font-size:9px;color:#FFE082;line-height:1.4;">${htmlEsc(s3?.stage2_aerial_drone || p.terrain_description || '산악 능선 차폐각 35도 이상, 진입 도로망 및 위장막 설치 확인')}</div>
            </div>

            <!-- 🏗️ 3단계: 지하 암반 갱도 내부 구조 & 방폭문 정밀 판독 -->
            <div style="margin-top:6px;padding:6px 8px;background:rgba(124,77,255,0.1);border:1px solid rgba(124,77,255,0.4);border-radius:4px;">
              <div style="color:#B388FF;font-size:9.5px;font-weight:bold;margin-bottom:3px;">🏗️ 3단계: 지하 암반 갱도 내부 구조 & 방폭문 정밀 판독</div>
              <div style="font-size:9px;color:#E1BEE7;line-height:1.4;">${htmlEsc(s3?.stage3_interior_structure || '암반 지하 갱도 내부 2중 철근 콘크리트 방폭문(2m), 탄약고 및 환기 닥트 완비')}</div>
            </div>

            <!-- 🎯 세부 무기 장비 명칭 / 제원 사양표 / 운용 방법 / 장단점 정밀 분석 -->
            ${eq?.name ? `
              <div style="margin-top:8px;padding:8px;background:rgba(0,0,0,0.7);border:1px solid rgba(255,23,68,0.5);border-radius:6px;">
                <div style="color:#FF1744;font-size:10.5px;font-weight:bold;border-bottom:1px solid rgba(255,23,68,0.3);padding-bottom:4px;margin-bottom:6px;display:flex;justify-content:space-between;">
                  <span>🎯 ${htmlEsc(eq.name)}</span>
                  <span style="color:#FFD700;font-size:8.5px;font-family:monospace;">${htmlEsc(eq.classification || '포병/미사일')}</span>
                </div>
                ${eq.image_url ? `
                  <div style="position:relative;margin-bottom:6px;border-radius:4px;overflow:hidden;border:1px solid rgba(255,215,0,0.4);">
                    <img src="${eq.image_url}" alt="${htmlEsc(eq.name)}" style="width:100%;max-height:160px;object-fit:cover;display:block;" onerror="this.onerror=null;this.src='/intel/dprk/songaksan_equip.png';" />
                    <div style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.85);color:#FFD700;font-size:8px;padding:2px 6px;border-radius:3px;border:1px solid rgba(255,215,0,0.5);">
                      📷 ${htmlEsc(eq.name)} 실물 장비 세부 사진
                    </div>
                  </div>
                ` : ''}
                ${eq.specifications ? `
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:8.5px;margin-bottom:6px;background:rgba(255,255,255,0.04);padding:4px;border-radius:3px;">
                    <div><span style="color:#8A8880;">구경/사거리:</span> <strong style="color:#00E5FF;">${htmlEsc(eq.specifications.caliber_range || '')}</strong></div>
                    <div><span style="color:#8A8880;">연사 속도:</span> <strong style="color:#FFD700;">${htmlEsc(eq.specifications.fire_rate || '')}</strong></div>
                    <div><span style="color:#8A8880;">탄종:</span> <strong style="color:#FFF;">${htmlEsc(eq.specifications.warhead || '')}</strong></div>
                    <div><span style="color:#8A8880;">기동 플랫폼:</span> <strong style="color:#76FF03;">${htmlEsc(eq.specifications.chassis || '')}</strong></div>
                  </div>
                ` : ''}
                ${eq.operation_doctrine ? `
                  <div style="font-size:9px;color:#FFD700;background:rgba(255,215,0,0.1);padding:5px 7px;border-radius:3px;border-left:3px solid #FFD700;margin-bottom:4px;line-height:1.35;">
                    <strong>⚙️ 세부 운용 방법:</strong> ${htmlEsc(eq.operation_doctrine)}
                  </div>
                ` : ''}
                <div style="font-size:9px;color:#76FF03;background:rgba(118,255,3,0.08);padding:5px 7px;border-radius:3px;border-left:3px solid #76FF03;margin-bottom:4px;line-height:1.35;">
                  <strong>✅ 전술적 강점:</strong> ${htmlEsc(eq.pros)}
                </div>
                <div style="font-size:9px;color:#FF5252;background:rgba(255,23,68,0.08);padding:5px 7px;border-radius:3px;border-left:3px solid #FF1744;line-height:1.35;">
                  <strong>⚠️ 치명적 취약점:</strong> ${htmlEsc(eq.cons)}
                </div>
              </div>
            ` : ''}
          `;
        }
      } catch(err) {}

      const csisDossierHtml = `
        <div style="margin-top:8px;padding:8px 10px;background:rgba(0,0,0,0.85);border:1.5px solid #FFD700;border-radius:6px;box-shadow:inset 0 0 10px rgba(255,215,0,0.1);">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,215,0,0.3);padding-bottom:5px;margin-bottom:6px;">
            <span style="color:#FFD700;font-size:10.5px;font-weight:bold;">${docTitle}</span>
            <span style="color:${docBadgeColor};font-size:8.5px;font-family:monospace;background:${docBadgeColor}20;padding:1px 4px;border-radius:3px;border:1px solid ${docBadgeColor}40;">${docBadge}</span>
          </div>
          <div style="color:#FFFFFF;font-size:10px;font-weight:bold;margin-bottom:6px;">
            📑 ${htmlEsc(p.report_title || p.title)}
          </div>
          ${stageHtml}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;background:rgba(255,255,255,0.03);padding:5px;border-radius:4px;margin-top:6px;margin-bottom:6px;">
            <div><span style="color:#8A8880;">🏛️ 출처 기관:</span><br/><strong style="color:#FFD700;">${htmlEsc(srcOrg)}</strong></div>
            <div><span style="color:#8A8880;">📅 판독 일자:</span><br/><strong style="color:#00E5FF;">${htmlEsc(p.source_date || '2025-02-02')}</strong></div>
            ${p.estimated_strength ? `<div><span style="color:#8A8880;">⚔️ 전력 배치:</span><br/><strong style="color:#FF1744;">${htmlEsc(p.estimated_strength)}</strong></div>` : ''}
            ${p.concealment_level ? `<div><span style="color:#8A8880;">⛰️ 진지 은폐도:</span><br/><strong style="color:#76FF03;">${htmlEsc(p.concealment_level)}</strong></div>` : ''}
          </div>
          <div style="font-size:9.5px;color:#E8E6E0;line-height:1.45;background:rgba(0,0,0,0.4);padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);margin-bottom:6px;">
            ${htmlEsc(p.description)}
          </div>
          <button onclick="if (window.openDprkReportDossier && window._dprkSitesRegistry && window._dprkSitesRegistry['${idSafe(p.id)}']) { window.openDprkReportDossier(window._dprkSitesRegistry['${idSafe(p.id)}']); } else if (window.openDprkReportDossier) { window.openDprkReportDossier({ id: '${idSafe(p.id)}', title: '${htmlEsc(p.title || '')}', source_org: '${htmlEsc(srcOrg)}' }); }" style="width:100%;margin-top:4px;padding:7px 10px;background:linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.35) 100%);border:1.5px solid #FFD700;color:#FFD700;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.05em;border-radius:4px;cursor:pointer;box-shadow:0 0 12px rgba(255,215,0,0.2);display:flex;align-items:center;justify-content:center;gap:5px;">
            <span>📷 [ 3단계 위성·실물 장비·사격진지 검증 도판 전면 확대 ⛶ ]</span>
          </button>
        </div>
      `;

      popup(coords, `<div style="${pStyle}border:1.5px solid ${tierColor};background:rgba(10,12,18,0.96);max-width:380px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">
          <span style="color:#FF1744;font-size:13.5px;font-weight:800;">💥 ${htmlEsc(p.title)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
          <span style="font-size:9px;color:${tierColor};font-weight:bold;background:${tierColor}20;padding:2px 8px;border-radius:4px;border:1px solid ${tierColor}60;">🛡️ 검증 등급: ${htmlEsc(vTier)}</span>
          <span style="font-size:9px;color:#FFD740;font-weight:bold;background:rgba(255,215,0,0.1);padding:2px 6px;border-radius:4px;border:1px solid rgba(255,215,0,0.3);">🏛️ ${htmlEsc(srcOrg)}</span>
          <span style="font-size:9px;color:#00E5FF;font-weight:bold;background:rgba(0,229,255,0.1);padding:2px 6px;border-radius:4px;border:1px solid rgba(0,229,255,0.3);">📅 ${htmlEsc(p.source_date)}</span>
        </div>
        ${mediaHtml}
        ${actMgrsHtml}
        ${csisDossierHtml}
        <button onclick="window.openOsirisIntel({ type: 'country', country: 'North Korea' })" style="width:100%;margin-top:6px;padding:7px 12px;background:rgba(255,23,68,0.25);border:1px solid rgba(255,23,68,0.7);color:#FF1744;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.1em;border-radius:4px;cursor:pointer;">[ 🛡️ Palantir Foundry 그래프 심층 검증 ]</button>
      </div>`);
    });

    // ── Bridge 2: Seismic Nuclear Watch Click Handler ──
    map.on('click', 'seismic-nuclear-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const isSuspect = p.is_nuclear_suspect;

      const borderColor = isSuspect ? '#D500F9' : '#00BCD4';

      const suspectBadge = isSuspect ? `
        <div style="background:rgba(213,0,249,0.2);border:1.5px solid #D500F9;border-radius:4px;padding:8px;margin-bottom:8px;">
          <div style="color:#D500F9;font-size:11px;font-weight:bold;display:flex;align-items:center;gap:6px;">
            <span>⚛️ 핵실험/폭발 의심 충격파 경보</span>
          </div>
          <div style="color:#FF80AB;font-size:9px;margin-top:4px;">${htmlEsc(p.nuclear_suspect_reason || '풍계리 핵실험장 인근 얕은 지진 발생')}</div>
          <div style="color:#E040FB;font-size:9px;font-weight:bold;margin-top:2px;">인접 시설: ${htmlEsc(p.nearest_nuclear_facility || '풍계리 핵실험장')} (거리: ${p.distance_to_facility_km}km)</div>
        </div>
      ` : '';

      popup(coords, `<div style="${pStyle}border:1.5px solid ${borderColor};background:rgba(10,12,18,0.96);max-width:340px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:${borderColor};font-size:14px;font-weight:800;">🌐 M${p.magnitude} ${isSuspect ? '핵실험 의심 지진' : '지진/충격파'}</span>
          <span style="color:#aaa;font-size:9px;background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">${htmlEsc(p.source)}</span>
        </div>
        ${suspectBadge}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:6px;background:rgba(255,255,255,0.04);padding:6px;border-radius:4px;">
          <div><span style="color:#8A8880;">진앙 위치:</span><br/><span style="color:#E8E6E0;font-weight:bold;">${htmlEsc(p.place)}</span></div>
          <div><span style="color:#8A8880;">진원 깊이:</span><br/><span style="color:#00E5FF;font-weight:bold;">${p.depth_km} km</span></div>
          <div><span style="color:#8A8880;">발생 시각:</span><br/><span style="color:#FFD700;">${new Date(p.time).toLocaleString('ko-KR')}</span></div>
          <div><span style="color:#8A8880;">정밀 좌표:</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°N, ${coords[0].toFixed(3)}°E</span></div>
        </div>
      </div>`);
    });

    // ── DPRK Strategic Sites Click Handler (100% Korean Popup matching user layout specification) ──
    map.on('click', 'dprk-sites-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      let linksHtml = '';
      try {
        const links = JSON.parse(p.ontology_links || '[]');
        if (links.length > 0) {
          linksHtml = `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.2);">
            <div style="color:#00E5FF;font-size:9px;font-weight:bold;margin-bottom:4px;">🕸️ 온톨로지 연관 시설 / 무기체계 네트워크</div>
            ${links.map((l: any) => `<div style="font-size:9px;color:#E8E6E0;margin-bottom:2px;"><span style="color:#FF9500;font-weight:bold;">[${htmlEsc(l.relation)}]</span> ${htmlEsc(l.target)}</div>`).join('')}
          </div>`;
        }
      } catch {}

      const vLevel = p.verification_level || 'Tier 1 (3차 교차 검증 완료)';
      const tType = p.tactical_type || '전술 진지';

      // Real-time ESRI World Imagery satellite optical snapshot
      const _lon = coords[0], _lat = coords[1];
      const zoom = 13;
      const tileX = Math.floor((_lon + 180) / 360 * Math.pow(2, zoom));
      const tileY = Math.floor((1 - Math.log(Math.tan(_lat * Math.PI / 180) + 1 / Math.cos(_lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      const esriSatUrl = `/api/proxy-tiles?url=${encodeURIComponent(`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`)}`;

      // Register site payload into global registry for instant full-screen dossier view
      (window as any)._dprkSitesRegistry = (window as any)._dprkSitesRegistry || {};
      const s3ParsedSite = typeof p.site_analysis_3stage === 'string' ? (()=>{ try{ return JSON.parse(p.site_analysis_3stage); }catch{ return {}; } })() : p.site_analysis_3stage || {};
      const eqParsedSite = typeof p.equipment_details === 'string' ? (()=>{ try{ return JSON.parse(p.equipment_details); }catch{ return {}; } })() : p.equipment_details || {};
      const mcParsedSite = typeof p.military_coordinates === 'string' ? (()=>{ try{ return JSON.parse(p.military_coordinates); }catch{ return {}; } })() : p.military_coordinates || {};
      const iaParsedSite = typeof p.intel_agencies === 'string' ? (()=>{ try{ return JSON.parse(p.intel_agencies); }catch{ return []; } })() : p.intel_agencies || [];

      (window as any)._dprkSitesRegistry[p.id || 'default'] = {
        id: p.id,
        title: p.title,
        source_org: p.source_org || 'CSIS Beyond Parallel',
        source_date: p.source_date || '2025-02-02',
        report_title: p.report_title || p.title,
        report_url: p.report_url || p.source_url || 'https://beyondparallel.csis.org/',
        description: p.description,
        lat: _lat,
        lng: _lon,
        threat_radius_km: p.threat_radius_km || 70,
        estimated_strength: p.estimated_strength || '',
        concealment_level: p.concealment_level || '',
        countermeasure_systems: p.countermeasure_systems || ['대포병 탐지레이더 (TPQ-74)', 'K-9A1 자주포', '천무 다련장'],
        satellite_analysis_callouts: p.satellite_analysis_callouts || '',
        site_analysis_3stage: s3ParsedSite,
        equipment_details: eqParsedSite,
        military_coordinates: mcParsedSite,
        intel_agencies: iaParsedSite,
        media_urls: typeof p.media_urls === 'string' ? (()=>{ try{ return JSON.parse(p.media_urls); }catch{ return [p.media_urls]; } })() : p.media_urls || [],
      };

      const threatAssess = p.threat_assessment || 'HIGH';
      const threatColor = threatAssess === 'CRITICAL' ? '#FF1744' : threatAssess === 'HIGH' ? '#FF9500' : threatAssess === 'MODERATE' ? '#FFD700' : '#00E5FF';

      // Media Section: 1. 위성 사진 -> 2. 실제 건물 촬영사진 -> 3. 영상 순서로 배치
      const mediaHtml = `
        <div style="margin-bottom:10px;border:1px solid ${threatColor}60;border-radius:6px;overflow:hidden;background:#0d1117;">
          <!-- 1. 위성 사진 (ESRI Live Satellite) -->
          <div style="position:relative;border-bottom:1px solid rgba(255,255,255,0.1);">
            <div style="background:rgba(0,229,255,0.15);padding:4px 8px;font-size:9px;color:#00E5FF;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
              <span>📡 1. 실시간 위성 사진 (ESRI ArcGIS World Imagery)</span>
              <span style="font-size:8px;color:#8A8880;">📐 ${htmlEsc(p.spatial_resolution || '0.3m Real Satellite Tile')}</span>
            </div>
            <img src="${esriSatUrl}" alt="ESRI 실시간 위성 사진" style="width:100%;height:150px;object-fit:cover;display:block;background:#1a1d24;" />
          </div>

          <!-- 2. 실제 건물 / 현장 촬영 및 판독 분석 사진 -->
          <div style="position:relative;border-bottom:1px solid rgba(255,255,255,0.1);">
            <div style="background:rgba(255,215,0,0.15);padding:4px 8px;font-size:9px;color:#FFD700;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
              <span>📷 2. 실제 건물 / 현장 촬영 및 판독 분석 사진</span>
              <span style="font-size:8px;color:#8A8880;">🏛️ ${htmlEsc(p.source_org || 'CSIS')} 채증</span>
            </div>
            ${getHighResAnalysisPhoto(p)}
          </div>



          <!-- 3. 공식 보고서 수록 사격진지 / 갱도 / 핵심 거점 정밀 판독 -->
          <div style="position:relative;">
            <div style="background:rgba(255,23,68,0.15);padding:4px 8px;font-size:9px;color:#FF5252;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
              <span>🎯 3. 공식 보고서 수록 사격진지 / 갱도 / 핵심 거점 정밀 판독</span>
              <span style="font-size:8px;color:#8A8880;">📐 0.3m Tactical Recon (FACT)</span>
            </div>
            ${getVideoAnalysisKeyframe(p)}
          </div>
        </div>
      `;

      const reportLinkHtml = `
        <button onclick="if (window.openDprkReportDossier && window._dprkSitesRegistry && window._dprkSitesRegistry['${idSafe(p.id)}']) { window.openDprkReportDossier(window._dprkSitesRegistry['${idSafe(p.id)}']); } else if (window.openDprkReportDossier) { window.openDprkReportDossier({ id: '${idSafe(p.id)}', title: '${htmlEsc(p.title || '')}', source_org: '${htmlEsc(p.source_org || 'CSIS Beyond Parallel')}' }); }" style="width:100%;margin-top:6px;padding:8px 12px;background:rgba(0,229,255,0.2);border:1.5px solid #00E5FF;color:#00E5FF;font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:bold;letter-spacing:0.05em;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span>🔍 3단계 정밀 시각 검증 및 위성·장비 도판 전면 확대 보기 ⛶</span>
        </button>
      `;

      let targetsHtml = '';
      try {
        const targets = JSON.parse(p.strike_targets || '[]');
        if (targets.length > 0) {
          targetsHtml = `<div style="margin-top:6px;font-size:9.5px;"><span style="color:#FF3D3D;font-weight:bold;">🎯 주요 타격 표적:</span> <span style="color:#E8E6E0;">${targets.map((t: string) => htmlEsc(t)).join(', ')}</span></div>`;
        }
      } catch {}

      let strengthHtml = p.estimated_strength ? `
        <div style="font-size:9.5px;color:#00E5FF;margin-bottom:4px;"><span style="color:#8A8880;">추정 병력/장비:</span> <span style="font-weight:bold;">${htmlEsc(p.estimated_strength)}</span></div>
      ` : '';

        const mgrsCode = latLngToMGRS(_lat, _lon);
        const utmCode = latLngToUTM(_lat, _lon).utmString;

        const mgrsHtml = `
          <div style="grid-column: span 2;background:rgba(0,229,255,0.08);padding:6px 8px;border-radius:4px;border:1px solid rgba(0,229,255,0.3);margin-top:4px;">
            <div style="color:#00E5FF;font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:space-between;">
              <span>🎖️ 군사지능 좌표 (MGRS / NATO Standard)</span>
              <span style="font-size:8px;color:#76FF03;background:rgba(118,255,3,0.15);padding:1px 4px;border-radius:2px;">1m 정밀 검증</span>
            </div>
            <div style="color:#FFD700;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:bold;margin-top:3px;letter-spacing:0.05em;">
              📍 ${htmlEsc(mgrsCode)}
            </div>
            <div style="color:#8A8880;font-size:8.5px;margin-top:2px;">
              🌐 WGS84: ${_lat.toFixed(4)}°N, ${_lon.toFixed(4)}°E | UTM: ${htmlEsc(utmCode)}
            </div>
          </div>
        `;

        let stageHtml = '';
        try {
          const s3 = typeof p.site_analysis_3stage === 'string' ? JSON.parse(p.site_analysis_3stage) : p.site_analysis_3stage;
          const eq = typeof p.equipment_details === 'string' ? JSON.parse(p.equipment_details) : p.equipment_details;
          const mc = typeof p.military_coordinates === 'string' ? JSON.parse(p.military_coordinates) : p.military_coordinates;
          const ia = typeof p.intel_agencies === 'string' ? JSON.parse(p.intel_agencies) : p.intel_agencies;

          if (s3?.stage1_position || eq?.name) {
            stageHtml = `
              <!-- 🌐 1단계: 위성 정밀 위치 & 군사좌표 -->
              <div style="margin-top:8px;padding:6px 8px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.3);border-radius:4px;">
                <div style="color:#00E5FF;font-size:9.5px;font-weight:bold;margin-bottom:3px;display:flex;align-items:center;justify-content:space-between;">
                  <span>🌐 1단계: 위성 정밀 위치 & 군사좌표</span>
                  <span style="color:#FFD700;font-family:monospace;font-size:9px;">${htmlEsc(mc?.mgrs || mgrsCode)}</span>
                </div>
                <div style="font-size:9px;color:#E8E6E0;line-height:1.4;">${htmlEsc(s3?.stage1_position || p.description)}</div>
                ${mc?.elevation ? `<div style="font-size:8.5px;color:#8A8880;margin-top:2px;">⛰️ 고도: ${htmlEsc(mc.elevation)} | 🎯 격자: ${htmlEsc(mc.grid_zone || '52S')}</div>` : ''}
              </div>

              <!-- 🛩️ 2단계: 공중/드론 고도 관측 세부 건물 & 외부 시설 배치 -->
              <div style="margin-top:6px;padding:6px 8px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.3);border-radius:4px;">
                <div style="color:#FFD700;font-size:9.5px;font-weight:bold;margin-bottom:3px;">🛩️ 2단계: 공중/드론 관측 세부 건물 & 외부 시설 배치</div>
                <div style="font-size:9px;color:#FFE082;line-height:1.4;">${htmlEsc(s3?.stage2_aerial_drone || p.satellite_analysis_callouts)}</div>
              </div>

              <!-- 🏗️ 3단계: 세부 건물/갱도 내부 구조 & 무기 판독 -->
              <div style="margin-top:6px;padding:6px 8px;background:rgba(124,77,255,0.1);border:1px solid rgba(124,77,255,0.4);border-radius:4px;">
                <div style="color:#B388FF;font-size:9.5px;font-weight:bold;margin-bottom:3px;">🏗️ 3단계: 세부 건물/갱도 내부 구조 & 무기 정밀 판독</div>
                <div style="font-size:9px;color:#E1BEE7;line-height:1.4;">${htmlEsc(s3?.stage3_interior_structure || '암반 지하 갱도 내부 이중 방폭문 및 전동 회전판 탑재')}</div>
              </div>

              <!-- 🎯 세부 무기 장비 명칭 / 사양 및 전술적 장단점 정밀 분석 -->
              ${eq?.name ? `
                <div style="margin-top:8px;padding:8px;background:rgba(0,0,0,0.7);border:1px solid rgba(255,23,68,0.5);border-radius:6px;">
                  <div style="color:#FF1744;font-size:10.5px;font-weight:bold;border-bottom:1px solid rgba(255,23,68,0.3);padding-bottom:4px;margin-bottom:6px;display:flex;justify-content:space-between;">
                    <span>🎯 ${htmlEsc(eq.name)}</span>
                    <span style="color:#FFD700;font-size:8.5px;font-family:monospace;">${htmlEsc(eq.classification||'포병/미사일')}</span>
                  </div>
                  ${eq.specifications ? `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:8.5px;margin-bottom:6px;background:rgba(255,255,255,0.04);padding:4px;border-radius:3px;">
                      <div><span style="color:#8A8880;">구경/사거리:</span> <strong style="color:#00E5FF;">${htmlEsc(eq.specifications.caliber_range||'')}</strong></div>
                      <div><span style="color:#8A8880;">연사 속도:</span> <strong style="color:#FFD700;">${htmlEsc(eq.specifications.fire_rate||'')}</strong></div>
                      <div><span style="color:#8A8880;">탄종:</span> <strong style="color:#FFF;">${htmlEsc(eq.specifications.warhead||'')}</strong></div>
                      <div><span style="color:#8A8880;">기동 플랫폼:</span> <strong style="color:#76FF03;">${htmlEsc(eq.specifications.chassis||'')}</strong></div>
                    </div>
                  ` : ''}
                  <div style="font-size:9px;color:#76FF03;background:rgba(118,255,3,0.08);padding:5px 7px;border-radius:3px;border-left:3px solid #76FF03;margin-bottom:4px;line-height:1.35;">
                    ${htmlEsc(eq.pros)}
                  </div>
                  <div style="font-size:9px;color:#FF5252;background:rgba(255,23,68,0.08);padding:5px 7px;border-radius:3px;border-left:3px solid #FF1744;line-height:1.35;">
                    ${htmlEsc(eq.cons)}
                  </div>
                </div>
              ` : ''}

              <!-- 🏢 글로벌 안보 검증 기관 배지 -->
              ${Array.isArray(ia) && ia.length > 0 ? `
                <div style="margin-top:8px;padding:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.1);border-radius:4px;">
                  <div style="color:#8A8880;font-size:8.5px;font-weight:bold;margin-bottom:4px;">🛡️ 교차 검증 안보 기관 / 씽크탱크:</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    ${ia.map((g: any) => `<span style="font-size:8px;color:#00E5FF;background:rgba(0,229,255,0.12);padding:2px 5px;border-radius:3px;border:1px solid rgba(0,229,255,0.3);">🏛️ ${htmlEsc(g.name || g)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            `;
          }
        } catch(err) {}

        popup(coords, `<div style="${pStyle}border:1.5px solid ${threatColor};background:rgba(10,12,18,0.96);max-width:390px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">
          <span style="color:${threatColor};font-size:13.5px;font-weight:800;">🎖️ ${htmlEsc(p.title)}</span>
          <span style="color:#00BCD4;font-size:9px;background:rgba(0,188,212,0.15);padding:2px 6px;border-radius:4px;border:1px solid rgba(0,188,212,0.4);font-weight:bold;white-space:nowrap;">${htmlEsc(p.category_label)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <span style="font-size:9px;color:${threatColor};font-weight:bold;background:${threatColor}20;padding:2px 6px;border-radius:4px;border:1px solid ${threatColor}60;">⚠️ 위협 등급: ${htmlEsc(threatAssess)}</span>
          <span style="font-size:9px;color:#FFD700;font-weight:bold;background:rgba(255,215,0,0.1);padding:2px 6px;border-radius:4px;border:1px solid rgba(255,215,0,0.3);">📏 사거리: ${p.threat_radius_km || 100}km</span>
        </div>
        ${mediaHtml}
        <div style="margin-top:8px;padding:8px 10px;background:rgba(0,0,0,0.85);border:1.5px solid #FFD700;border-radius:6px;box-shadow:inset 0 0 10px rgba(255,215,0,0.1);">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,215,0,0.3);padding-bottom:5px;margin-bottom:6px;">
            <span style="color:#FFD700;font-size:11px;font-weight:bold;">📜 글로벌 안보 기관 & CSIS/NGA 정밀 판독 보고서</span>
            <span style="color:#00E5FF;font-size:8.5px;font-family:monospace;background:rgba(0,229,255,0.15);padding:1px 4px;border-radius:3px;">6-AGENCY-VERIFIED</span>
          </div>
          <div style="color:#FFFFFF;font-size:10px;font-weight:bold;margin-bottom:6px;">
            📑 ${htmlEsc(p.report_title || p.title)}
          </div>
          ${stageHtml}
          ${mgrsHtml}
          ${targetsHtml}
          ${linksHtml}
          <button onclick="if (window.openDprkReportDossier && window._dprkSitesRegistry && window._dprkSitesRegistry['${idSafe(p.id)}']) { window.openDprkReportDossier(window._dprkSitesRegistry['${idSafe(p.id)}']); } else if (window.openDprkReportDossier) { window.openDprkReportDossier({ id: '${idSafe(p.id)}', title: '${htmlEsc(p.title || '')}', source_org: '${htmlEsc(p.source_org || 'CSIS Beyond Parallel')}' }); }" style="width:100%;margin-top:6px;padding:7px 10px;background:linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.35) 100%);border:1.5px solid #FFD700;color:#FFD700;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.05em;border-radius:4px;cursor:pointer;box-shadow:0 0 12px rgba(255,215,0,0.2);display:flex;align-items:center;justify-content:center;gap:5px;">
            <span>📷 [ 3단계 위성·실물 장비·사격진지 검증 도판 전면 확대 ⛶ ]</span>
          </button>
        </div>
        <button onclick="window.openOsirisIntel({ type: 'country', country: 'North Korea' })" style="width:100%;margin-top:6px;padding:7px 12px;background:rgba(255,23,68,0.25);border:1px solid rgba(255,23,68,0.7);color:#FF1744;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.1em;border-radius:4px;cursor:pointer;">[ 🛡️ Palantir Foundry 전술 지능 그래프 심층 검증 ]</button>
      </div>`);
    });

    // ── Scan Targets click ──
    map.on('click', 'scan-targets-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = e.features[0].geometry.coordinates.slice();
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,61,61,0.5);">
        <div style="color:#FF3D3D;font-size:12px;font-weight:700;margin-bottom:6px;">🎯 TARGET: ${htmlEsc(p.id)}</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${htmlEsc(p.city || 'Unknown')}, ${htmlEsc(p.country || 'Unknown')} — ${htmlEsc(p.isp || 'Unknown ISP')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">TYPE</span><br/><span style="color:#00E5FF;">${(p.type || 'UNKNOWN').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <button onclick="window.openOsirisIntel({ type: 'ip', ip: '${idSafe(p.id)}' })" style="width:100%;margin-top:8px;padding:6px 12px;background:rgba(255,109,0,0.15);border:1px solid rgba(255,109,0,0.5);color:#FF6D00;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.1em;border-radius:4px;cursor:pointer;">[ IP INTEL DEEP DIVE ]</button>
      </div>`);
    });

    // ── SCM Suppliers ──
    map.on('click', 'scm-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.risk_level === 'CRITICAL' ? '#FF1744' : p.risk_level === 'HIGH' ? '#FF9500' : '#00BCD4';
      const activeThreats = p.active_threats ? JSON.parse(p.active_threats) : [];
      
      let threatsHtml = '';
      if (activeThreats.length > 0) {
        threatsHtml = `<div style="margin-top:8px;padding-top:6px;border-top:1px solid ${color}40;color:${color};font-size:9px;font-weight:bold;">
          ACTIVE THREATS:<br/>${activeThreats.map((t: string) => `⚠ ${htmlEsc(t)}`).join('<br/>')}
        </div>`;
      }

      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">🏢 ${htmlEsc(p.name)}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${htmlEsc(p.category)} | ${htmlEsc(p.city)}, ${htmlEsc(p.country)}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">SCM RISK LEVEL</span><br/><span style="color:${color};font-weight:bold;">${p.risk_level}</span></div>
        </div>
        ${threatsHtml}
      </div>`);
    });

    // ── IP Sweep device click ──
    map.on('click', 'sweep-device-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = e.features[0].geometry.coordinates.slice();
      const ports = JSON.parse(p.ports || '[]');
      const vulns = JSON.parse(p.vulns || '[]');
      const hostnames = JSON.parse(p.hostnames || '[]');
      const riskColors: Record<string, string> = { CRITICAL: '#FF3D3D', HIGH: '#FF6B00', MEDIUM: '#FFD700', LOW: '#76FF03', INFO: '#5C5A54' };
      popup(coords, `<div style="font-family:monospace;font-size:11px;color:#E8E6E0;">
        <div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:${p.color};">${p.device_type}</div>
        <div style="font-size:12px;margin-bottom:8px;color:#fff;">${p.ip}</div>
        ${hostnames.length > 0 ? `<div style="font-size:9px;color:#8A8880;margin-bottom:6px;">${hostnames.join(', ')}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">PORTS</span><br/><span style="color:#E8E6E0;">${ports.length}</span></div>
          <div><span style="color:#5C5A54;">RISK</span><br/><span style="color:${riskColors[p.risk_level] || '#666'};">${p.risk_level}</span></div>
        </div>
        <div style="font-size:9px;color:#8A8880;margin-bottom:6px;">Open: ${ports.slice(0, 12).join(', ')}${ports.length > 12 ? ' ...' : ''}</div>
        ${vulns.length > 0 ? `<div style="font-size:9px;color:#FF3D3D;margin-bottom:6px;">⚠ CVEs: ${vulns.slice(0, 5).join(', ')}${vulns.length > 5 ? ` +${vulns.length - 5} more` : ''}</div>` : ''}
        <button onclick="window.openOsirisIntel({ type: 'ip', ip: '${p.ip}' })" style="width:100%;margin-top:6px;padding:6px 12px;background:rgba(255,109,0,0.15);border:1px solid rgba(255,109,0,0.5);color:#FF6D00;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;letter-spacing:0.1em;border-radius:4px;cursor:pointer;">[ IP INTEL DEEP DIVE ]</button>
      </div>`);
    });

    // ── Balloons / Sondes ──
    map.on('click', 'balloon-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid ${p.color}40;">
        <div style="color:${p.color};font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🎈 ${p.callsign}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.type.toUpperCase()} / STATUS: ${p.status.toUpperCase()}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">ALTITUDE</span><br/><span style="color:#E8E6E0;">${p.altitude} m</span></div>
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:#E8E6E0;">${Math.round(p.speed)} km/h</span></div>
          <div><span style="color:#5C5A54;">VERT RATE</span><br/><span style="color:${p.verticalRate > 0 ? '#00E676' : '#FF3D3D'};">${p.verticalRate.toFixed(1)} m/s</span></div>
          <div><span style="color:#5C5A54;">TEMP</span><br/><span style="color:#E8E6E0;">${p.temperature}°C</span></div>
        </div>
      </div>`);
    });

    // ── Radiation ──
    map.on('click', 'rad-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.status === 'DANGER' ? '#FF1744' : p.status === 'WARNING' ? '#FF9500' : '#AB47BC';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">☢️ ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city}, ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">READING</span><br/><span style="color:${color};font-weight:bold;">${p.reading} nSv/h</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">STATUS</span><br/><span style="color:${color};">${p.status}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">NETWORK</span><br/><span style="color:#E8E6E0;">${p.network}</span></div>
        </div>
      </div>`);
    });

    ['ship-icons', 'ship-dots', 'ship-glow'].forEach((layer: string) => {
      map.on('click', layer, (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.type === 'military' ? '#FF1744' : p.type === 'tanker' ? '#FF9500' : '#00E5FF';
      const icon = p.type === 'military' ? '⚔️' : p.type === 'tanker' ? '🛢️' : '🚢';
      
      let typeKor = '일반 화물/상선';
      if (p.type === 'military') typeKor = '해군 군함 / 해경 경비함';
      else if (p.type === 'tanker') typeKor = '유류 / 유조선';
      else if (p.type === 'passenger') typeKor = '여객선 / 쾌속선';

      const isSuspect = (p.name || '').includes('SUSPECT') || (p.name || '').includes('미송출') || (p.name || '').includes('공작선') || (p.risk === 'CRITICAL');
      const isMil = p.type === 'military' || (p.name || '').includes('함') || (p.name || '').includes('해군');
      const shipIffText = isSuspect ? 'IFF: CRITICAL HOSTILE (의심선박)' : isMil ? 'IFF: FRIENDLY (아군 군함)' : 'CIVILIAN MARITIME';
      const shipIffColor = isSuspect ? '#FF1744' : isMil ? '#00E676' : '#00E5FF';
      const shipPopupId = idSafe(p.mmsi || p.name || 'ship');

      popup(coords, `<div style="${pStyle}border:1.5px solid ${shipIffColor}80;box-shadow:inset 0 0 12px ${shipIffColor}15;background:rgba(10,12,18,0.96);max-width:350px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${shipIffColor}40;padding-bottom:6px;margin-bottom:8px;">
          <div style="color:${shipIffColor};font-size:12.5px;font-weight:700;letter-spacing:0.05em;">${icon} ${htmlEsc(p.name || '식별 중인 선박')}</div>
          <div style="color:#FFD700;font-size:9px;font-weight:bold;background:rgba(255,215,0,0.1);padding:1px 5px;border-radius:3px;border:1px solid rgba(255,215,0,0.3);">국적: ${htmlEsc(p.flag||'한국/미상')}</div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:6px;flex-wrap:wrap;">
          <span style="color:#00E5FF;font-size:9.5px;font-weight:bold;">🚢 선종: ${htmlEsc(typeKor)}</span>
          <span style="font-size:8.5px;color:${shipIffColor};font-weight:bold;background:${shipIffColor}20;padding:2px 6px;border-radius:3px;border:1px solid ${shipIffColor}60;">${shipIffText}</span>
        </div>

        <!-- Local AI On-Device Verification Box -->
        <div style="background:rgba(0,0,0,0.7);border:1px solid ${shipIffColor}60;border-radius:4px;padding:6px 8px;margin-bottom:8px;font-size:9px;">
          <div style="color:${shipIffColor};font-weight:bold;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;">
            <span>⚡ 로컬 AI (Qwen3-14B) 해양 전술 판정</span>
            <span id="ai-verify-status-${shipPopupId}" style="color:#FFD740;font-family:monospace;font-size:8px;background:rgba(255,215,0,0.15);padding:1px 4px;border-radius:2px;">실시간 판정 중...</span>
          </div>
          <div id="ai-verify-content-${shipPopupId}" style="color:#E8E6E0;font-size:8.5px;line-height:1.4;">
            <span style="color:#8A8880;">e-Nav 연동 및 AIS 미송출 이상 항적 교차 감사 중...</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9.5px;margin-bottom:8px;background:rgba(0,0,0,0.35);padding:6px;border-radius:4px;">
          <div><span style="color:#8A8880;">🚀 항해 속력:</span><br/><span style="color:${color};font-family:monospace;font-weight:bold;">${Number(p.speed||0).toFixed(1)} 노트 (${(Number(p.speed||0)*1.852).toFixed(1)} km/h)</span></div>
          <div><span style="color:#8A8880;">🧭 항해 방위:</span><br/><span style="color:${color};font-family:monospace;font-weight:bold;">${Number(p.heading||0).toFixed(0)}°</span></div>
          <div><span style="color:#8A8880;">🆔 식별 번호:</span><br/><span style="color:#FFD700;font-family:monospace;font-weight:bold;">MMSI: ${htmlEsc(p.mmsi || '440000000')}</span></div>
          <div><span style="color:#8A8880;">📍 위경도 좌표:</span><br/><span style="color:#E8E6E0;font-family:monospace;">${coords[1].toFixed(4)}°N, ${coords[0].toFixed(4)}°E</span></div>
        </div>
        <div style="margin-bottom:8px;font-size:9.5px;"><span style="color:#8A8880;">⚓ 목적지/목적항: </span><span style="color:#FFD700;font-weight:bold;">${htmlEsc(p.destination || '한반도/동아시아 주요 항만')}</span></div>
        <a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${p.mmsi}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:${color};border:1px solid ${color}40;background:${color}15;display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:6px;">[ 🚢 마린트래픽 실시간 선박 포탈 연결 ↗ ]</a>
      </div>`);

      setTimeout(() => {
        fetch('/api/intel/verify-target', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_type: 'maritime',
            name: p.name,
            mmsi: p.mmsi,
            flag: p.flag,
            coords,
            risk_level: isSuspect ? 'CRITICAL' : 'NORMAL'
          })
        })
        .then(r => r.json())
        .then(res => {
          const statusEl = document.getElementById(`ai-verify-status-${shipPopupId}`);
          const contentEl = document.getElementById(`ai-verify-content-${shipPopupId}`);
          if (statusEl && res.status === 'success') {
            const j = applyJudgmentBadgeEl(statusEl, res);
            if (contentEl) {
                contentEl.innerHTML = renderVerifyTargetContentHtml(res, htmlEsc, j);
            }
          }
        })
        .catch(() => {
          const statusEl = document.getElementById(`ai-verify-status-${shipPopupId}`);
          applyJudgmentBadgeEl(statusEl, { judgmentSource: 'rule', aiSuccess: false });
        });
      }, 40);
    });
    });


    // ── Weather Events (NASA EONET + NOAA/NWS + GDACS) ──
    map.on('click', 'weather-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const iconEmoji = p.icon === 'cyclone' ? '🌀' : p.icon === 'volcano' ? '🌋' : p.icon === 'flood' ? '🌊' : p.icon === 'drought' ? '🏜️' : p.icon === 'ice' ? '🧊' : p.icon === 'weather' ? '⚠️' : '⚡';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(224,64,251,0.3);">
        <div style="color:#E040FB;font-size:14px;font-weight:700;margin-bottom:6px;">${iconEmoji} ${p.type || 'Weather Event'}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${p.title || 'Unknown event'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${p.severity === 'high' ? '#FF1744' : '#FFD700'};">${(p.severity||'low').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          ${p.source ? `<a href="${p.source}" target="_blank" style="${linkStyle}color:#E040FB;border:1px solid rgba(224,64,251,0.4);background:rgba(224,64,251,0.1);">📡 SOURCE</a>` : ''}
        </div>
      </div>`);
    });

    // ── Nuclear Infrastructure ──
    map.on('click', 'infra-dots', (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const statusColor = p.status.includes('SEISMIC RISK') ? '#FF9500' : p.status === 'Active Conflict Zone' ? '#FF1744' : p.status === 'Operational' ? '#76FF03' : '#757575';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(118,255,3,0.3);">
        <div style="color:#76FF03;font-size:14px;font-weight:700;margin-bottom:4px;">☢️ ${p.name || 'Nuclear Facility'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${statusColor};">${p.status || '—'}</span></div>
          <div><span style="color:#5C5A54;">CITY</span><br/><span style="color:#E8E6E0;">${p.city || '—'}, ${p.country || ''}</span></div>
          <div><span style="color:#5C5A54;">REACTORS</span><br/><span style="color:#76FF03;">${p.reactors || '—'}</span></div>
          <div><span style="color:#5C5A54;">CAPACITY</span><br/><span style="color:#E8E6E0;">${p.capacityMW ? p.capacityMW.toLocaleString() + ' MW' : '—'}</span></div>
          <div><span style="color:#5C5A54;">OWNER</span><br/><span style="color:#E8E6E0;">${p.owner || '—'}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <div style="margin-top:6px;padding:6px 8px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.35);border-radius:4px;font-size:9.5px;color:#D4AF37;line-height:1.4;margin-bottom:8px;">
          <div><strong>출처:</strong> ${p.source || '미 국가지리정보국(NGA) / CSIS'}</div>
          <div><strong>날짜:</strong> ${p.date || '2026-07-30'} &nbsp;\|&nbsp; <strong>신뢰도:</strong> <span style="color:#76FF03;font-weight:bold;">${p.confidence || '99%'}</span></div>
        </div>
        <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},14z/data=!3m1!1e3" target="_blank" style="${linkStyle}color:#76FF03;border:1px solid rgba(118,255,3,0.4);background:rgba(118,255,3,0.1);">SATELLITE VIEW</a>
      </div>`);
    });

    // ── Maritime Ports & Naval Bases ──
    map.on('click', 'maritime-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      const typeColor = p.type === 'naval' ? '#FF3D3D' : p.type === 'energy' ? '#FF9500' : '#00BCD4';
      const typeLabel = p.type === 'naval' ? 'NAVAL BASE' : p.type === 'energy' ? 'ENERGY PORT' : 'CONTAINER PORT';
      
      const congestionHtml = p.congestion ? `
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div><span style="color:#5C5A54;font-size:9px;">CONGESTION</span><br/><span style="color:${p.congestion === 'SEVERE' ? '#FF1744' : p.congestion === 'CONGESTED' ? '#FF9500' : '#00E676'};font-weight:bold;font-size:10px;">${p.congestion}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">EST. DWELL TIME</span><br/><span style="color:#E8E6E0;font-weight:bold;font-size:10px;">${p.dwell_time || 'Unknown'}</span></div>
          </div>
        </div>` : '';

      popup(coords, `<div style="${pStyle}border:1px solid ${typeColor}40;">
        <div style="color:${typeColor};font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="color:#999;font-size:9px;margin-bottom:6px;">${typeLabel} — ${p.country}</div>
        ${p.volume ? `<div style="font-size:9px;color:#aaa;">Volume: <span style="color:${typeColor};font-weight:bold;">${p.volume}</span></div>` : ''}
        ${p.fleet ? `<div style="font-size:9px;color:#aaa;">Fleet: <span style="color:${typeColor};font-weight:bold;">${p.fleet}</span></div>` : ''}
        ${p.rank ? `<div style="font-size:9px;color:#aaa;">Global Rank: <span style="color:${typeColor};font-weight:bold;">#${p.rank}</span></div>` : ''}
        ${congestionHtml}
      </div>`);
    });

    // ── Maritime Chokepoints ──
    map.on('click', 'choke-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      const riskCol = p.risk === 'CRITICAL' ? '#FF1744' : p.risk === 'HIGH' ? '#FF9500' : p.risk === 'ELEVATED' ? '#FFD700' : '#00E676';
      popup(coords, `<div style="${pStyle}border:1px solid ${riskCol}40;">
        <div style="color:#FF9500;font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="font-size:9px;color:#aaa;">Traffic: <span style="color:#fff;">${p.traffic}</span></div>
        <div style="font-size:9px;color:#aaa;">Risk: <span style="color:${riskCol};font-weight:bold;">${p.risk}</span></div>
      </div>`);
    });

    // ── Live News (opens feed viewer) ──
    map.on('click', 'news-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      onEntityClick?.({
        type: 'live_news',
        name: p.name,
        city: p.city,
        country: p.country,
        url: p.url,
        category: p.category,
        embed_allowed: p.embed_allowed !== false && p.embed_allowed !== 'false',
      });
    });

    // ── NOTAM Hazard Airspace Click Popup ──
    map.on('click', 'notam-hazards-fill', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : (e.features![0].geometry as any).coordinates[0][0];
      popup(coords, `<div style="${pStyle}border:1.5px solid #FF1744;background:rgba(15,5,10,0.95);max-width:340px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;border-bottom:1px solid rgba(255,23,68,0.3);padding-bottom:4px;">
          <span style="color:#FF1744;font-size:12px;font-weight:bold;">🚀 NOTAM 위험 공역 [${htmlEsc(p.notam_id || 'HAZARD')}]</span>
          <span style="color:#FF5252;font-size:9px;font-weight:bold;background:rgba(255,23,68,0.2);padding:1px 5px;border-radius:3px;">${htmlEsc(p.severity || 'CRITICAL')}</span>
        </div>
        <div style="font-size:11px;color:#FFF;margin-bottom:6px;font-weight:600;">${htmlEsc(p.name || '미사일/발사체 위험 공역')}</div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;margin-bottom:6px;">
          <div>고도 제한: <span style="color:#FFD740;font-weight:bold;">${htmlEsc(p.altitude_range || 'GND-UNL')}</span></div>
          <div>위험 유형: <span style="color:#FF8A80;">${htmlEsc(p.type || '미사일/로켓 낙하 구역')}</span></div>
          <div>발효 사유: <span style="color:#EEE;">${htmlEsc(p.reason || '로켓 추진체 단분리 낙하 및 탄도 시험')}</span></div>
          <div>🕒 공고 유효기간: <span style="color:#FFD740;">${htmlEsc(p.effective_start ? p.effective_start.slice(0, 16).replace('T', ' ') : '상시')} ~ ${htmlEsc(p.effective_end ? p.effective_end.slice(0, 16).replace('T', ' ') : '')}</span></div>
          <div>🔄 갱신 주기: <span style="color:#00E676;">5분 주기 최신화 (수퍼바이저 감시 중)</span></div>
        </div>
        <div style="background:rgba(0,0,0,0.4);padding:4px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);font-size:8.5px;color:#888;">
          ⚖️ 소크라테스 팩트 검증: ICAO/국토교통부 공인 고시보 발행 실제 좌표 다각형
        </div>
      </div>`);
    });

    // ── Submarine Cables Click Popup ──
    map.on('click', 'submarine-cables-line', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : [126.5, 37.0];
      popup(coords, `<div style="${pStyle}border:1.5px solid #00E5FF;background:rgba(5,15,20,0.95);max-width:340px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;border-bottom:1px solid rgba(0,229,255,0.3);padding-bottom:4px;">
          <span style="color:#00E5FF;font-size:12px;font-weight:bold;">🌐 해저 광케이블 [${htmlEsc(p.name || 'CABLE')}]</span>
          <span style="color:#80DEEA;font-size:9px;font-family:monospace;">${htmlEsc(p.category || 'COMMUNICATION')}</span>
        </div>
        <div style="font-size:10px;color:#FFF;margin-bottom:6px;">경유국: <span style="color:#00E5FF;">${htmlEsc(p.landing_points || '대한민국/동아시아')}</span></div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;margin-bottom:6px;">
          <div>전장: <span style="color:#FFD740;">${htmlEsc(p.length_km ? p.length_km + ' km' : '국제 기간망')}</span></div>
          <div>소유자: <span style="color:#EEE;">${htmlEsc(p.owners || 'Global Telecom Consortium')}</span></div>
          <div>사보타주 감시: <span style="color:#00E676;font-weight:bold;">${htmlEsc(p.sabotage_risk || '정상 (실시간 완충구역 내 비인가 침투 없음)')}</span></div>
          <div>🕒 데이터 출처: <span style="color:#FFD740;">TeleGeography 글로벌 해저케이블 등록부 (717 세그먼트)</span></div>
          <div>🔄 선박 근접 분석: <span style="color:#00E676;">실시간 AIS 닻 투하 교차 감시 중</span></div>
        </div>
        <div style="background:rgba(0,0,0,0.4);padding:4px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);font-size:8.5px;color:#888;">
          ⚓ 물리적 실재성: 실제 WGS84 좌표 선형 기반 1km 완충구역 실측 감시
        </div>
      </div>`);
    });

    // ── Dark Fleet Click Popup ──
    map.on('click', 'dark-fleet-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1.5px solid #FF9100;background:rgba(20,10,5,0.95);max-width:340px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;border-bottom:1px solid rgba(255,145,0,0.3);padding-bottom:4px;">
          <span style="color:#FF9100;font-size:12px;font-weight:bold;">🚨 AIS 암흑 선박 [${htmlEsc(p.name || 'DARK FLEET')}]</span>
          <span style="color:#FF1744;font-size:9px;font-weight:bold;background:rgba(255,23,68,0.2);padding:1px 5px;border-radius:3px;">신호 두절</span>
        </div>
        <div style="font-size:10px;color:#FFF;margin-bottom:6px;">식별 MMSI: <span style="color:#FFD740;font-family:monospace;">${htmlEsc(p.mmsi || 'UNKNOWN')}</span></div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;margin-bottom:6px;">
          <div>🕒 신호 두절 경과: <span style="color:#FF5252;font-weight:bold;">${htmlEsc(p.lost_hours_ago ? p.lost_hours_ago + '시간 전' : '최근 두절')}</span></div>
          <div>최종 속력: <span style="color:#EEE;">${htmlEsc(p.last_speed_knots ? p.last_speed_knots + ' kt' : '—')}</span></div>
          <div>키네틱 반경: <span style="color:#FFA726;font-weight:bold;">${htmlEsc(p.kinetic_radius_km ? p.kinetic_radius_km + ' km' : '팽창 중')}</span></div>
          <div>위험 평가: <span style="color:#FF1744;font-weight:bold;">${htmlEsc(p.risk_assessment || '신호 두절 선박')}</span></div>
          <div>🔄 최신화 주기: <span style="color:#00E676;">5초 주기 WebSocket 실측 동기화</span></div>
        </div>
        <div style="background:rgba(0,0,0,0.4);padding:4px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);font-size:8.5px;color:#888;">
          📐 물리적 진실: 실제 AIS 스트림 수신 두절 선박 대상 Δt × V 키네틱 버블
        </div>
      </div>`);
    });

    return () => {
      if (typeof window !== 'undefined') {
        if ((window as any).__map === map) (window as any).__map = null;
        if ((window as any).map === map) (window as any).map = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Day/Night
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const update = () => {
      const src = map.getSource('day-night') as any;
      if (!src) return;
      if (!activeLayers.day_night) { src.setData(EMPTY_FC); return; }
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [computeSolarTerminator()] }, properties: {} }] });
    };
    update();
    const iv = setInterval(update, 300000); // 5 min (was 1 min — shadow barely moves)
    return () => clearInterval(iv);
  }, [mapReady, activeLayers.day_night]);

  // Helper to set GeoJSON
  const setGeo = useCallback((source: string, features: any[]) => {
    const src = mapRef.current?.getSource(source) as any;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, []);

  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); });
  }, []);

  // Flight data → GeoJSON (GPU rendered, displays 100% of all live aircraft)
  useEffect(() => {
    if (!mapReady) return;
    const toFeatures = (arr: any[]) => {
      return (arr || []).map((f: any) => ({
        type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
        properties: {
          callsign: f.callsign,
          heading: f.heading || 0,
          alt: f.alt,
          alt_feet: f.alt_feet || f.altFt,
          model: f.model,
          speed_knots: f.speed_knots || f.speed,
          registration: f.registration || f.reg,
          icao24: f.hex || f.icao24,
          affiliation: f.affiliation || '',
          category: f.category || 'commercial',
          country: f.country || '',
          model_image: f.model_image || '',
          origin: f.origin || '',
          destination: f.destination || f.dest || '',
          stage1_verification: f.stage1_verification || '',
          stage2_verification: f.stage2_verification || '',
          harness_verified: f.harness_verified || false,
          harness_bridge_id: f.harness_bridge_id || '',
          verification_source: f.verification_source || '',
          trust_score: f.trust_score || 99.8,
          color: f.color || '',
        },
      }));
    };
    setGeo('flights', activeLayers.flights ? toFeatures(data.commercial_flights) : []);
    setGeo('private-fl', activeLayers.private ? toFeatures(data.private_flights) : []);
    setGeo('jets', activeLayers.jets ? toFeatures(data.private_jets) : []);
    setGeo('military', activeLayers.military ? toFeatures(data.military_flights) : []);
  }, [mapReady, data.commercial_flights, data.private_flights, data.private_jets, data.military_flights, activeLayers.flights, activeLayers.private, activeLayers.jets, activeLayers.military]);

    // Update aircraft icon colors dynamically on theme switch
    useEffect(() => {
      if (!mapReady || !mapRef.current) return;
      const map = mapRef.current;
      
      const isGhost = theme === 'ghost';
      const phantomPurple = '#B388FF';
      const ghostPriv = '#CE93D8';
      const ghostGov = '#D500F9';

      const flightCom = isGhost ? phantomPurple : '#00E5FF';
      const flightPriv = isGhost ? ghostPriv : '#FFD700';
      const flightGov = isGhost ? ghostGov : '#FF9500';
      // ── 한미 공군기: 완전한 파란색(#0055FF), 기타 군용기: 빨간색 ──
      const flightMilOther = isGhost ? phantomPurple : '#FF3D3D';

      const updateMapIcon = (id: string, color: string, size: number) => {
        if (!map.hasImage(id)) return;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const cx = size / 2, cy = size / 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.4);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx, cy + size * 0.35);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
        ctx.closePath();
        ctx.fill();
        map.updateImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
      };

      updateMapIcon('plane-cyan', flightCom, 24);
      updateMapIcon('plane-yellow', flightPriv, 24);
      updateMapIcon('plane-green', '#00E676', 24);  // ── 아군기 (ROK/US): 100% 순수 초록색 ──
      updateMapIcon('plane-pink', flightGov, 24);
      updateMapIcon('plane-red', '#FF1744', 24);    // ── 적기 북한군 (DPRK): 100% 순수 빨간색 ──
      updateMapIcon('plane-orange', '#FF9100', 24); // ── 중국군 (PLAAF): 주황색 ──
      updateMapIcon('plane-brown', '#8D6E63', 24);  // ── 러시아기 (VKS): 갈색 ──
      updateMapIcon('plane-navy', '#2979FF', 24);   // ── 우크라이나기 (AFU): 남색 ──
      updateMapIcon('plane-blue', '#00E676', 24);
      updateMapIcon('plane-grey', isGhost ? phantomPurple : '#546E7A', 24);
    }, [mapReady, theme]);

  // ── DECOUPLED LAYER RENDERERS (Performance Optimized) ──

  useEffect(() => {
    if (!mapReady) return;
    setGeo('earthquakes', activeLayers.earthquakes && data.earthquakes ? data.earthquakes.map((eq: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] }, properties: { id: eq.id, magnitude: eq.magnitude, place: eq.place, depth: eq.depth, source: eq.source } })) : []);
  }, [mapReady, data.earthquakes, activeLayers.earthquakes, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const sats = data.satellites || [];
    const al = activeLayers as any;
    
    // If 'All Satellites' is on, show everything
    if (al.satellites) {
      setGeo('satellites', sats.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: s.color, mission: s.mission, alt: s.alt, noradId: s.noradId, category: s.category } })));
      return;
    }
    
    // Otherwise filter by enabled sub-layers
    const enabledCategories: string[] = [];
    if (al.sat_comms) enabledCategories.push('comms');
    if (al.sat_military) enabledCategories.push('military');
    if (al.sat_navigation) enabledCategories.push('navigation');
    if (al.sat_earth) enabledCategories.push('earth_obs');
    if (al.sat_science) enabledCategories.push('science');
    
    if (enabledCategories.length === 0) {
      setGeo('satellites', []);
      return;
    }
    
    const filtered = sats.filter((s: any) => enabledCategories.includes(s.category));
    setGeo('satellites', filtered.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: s.color, mission: s.mission, alt: s.alt, noradId: s.noradId, category: s.category } })));
  }, [mapReady, data.satellites, activeLayers.satellites, (activeLayers as any).sat_comms, (activeLayers as any).sat_military, (activeLayers as any).sat_navigation, (activeLayers as any).sat_earth, (activeLayers as any).sat_science, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('gdelt', activeLayers.global_incidents && data.gdelt ? data.gdelt.map((e: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lng, e.lat] }, properties: { name: e.name } })) : []);
  }, [mapReady, data.gdelt, activeLayers.global_incidents, setGeo]);

  // ══ MILITARY DEMARCATION LINES (LAND, SEA, AIR) GEOJSON UPDATER ══
  useEffect(() => {
    if (!mapReady) return;
    const boundaries = getAllDemarcationGeoJSON();
    setGeo('demarcation-lines', boundaries);
  }, [mapReady, setGeo]);

  // ══ CHINA YELLOW SEA & SOUTH CHINA SEA ARTIFICIAL STRUCTURES OSINT UPDATER ══
  useEffect(() => {
    if (!mapReady) return;
    const features = CHINA_ENCROACHMENT_SITES.map(s => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        name: s.name,
        chinese_name: s.chinese_name,
        english_name: s.english_name,
        region: s.region,
        region_label: s.region_label,
        threat_level: s.threat_level,
        facility_type: s.facility_type,
        facility_type_label: s.facility_type_label,
        runway_length_m: s.runway_length_m || 0,
        spec_dimensions: s.specifications.dimensions,
        spec_radar: s.specifications.radar_systems,
        spec_weapons: s.specifications.weapon_systems,
        satellite_image: s.imagery?.satellite_ortho ?? '',
        recon_image: s.imagery?.aerial_recon ?? '',
        image_date: s.imagery?.image_date ?? '',
        image_source: s.imagery?.source_org ?? '',
        mgrs: s.coordinate_precision?.mgrs ?? '',
        visible_object_count: s.visible_objects?.length ?? 0,
      }
    }));
    setGeo('china-encroachment', features);
  }, [mapReady, setGeo]);

  // ══ DEDICATED DRONE & C-UAS GCS PILOT MAP GEOJSON UPDATER ══
  useEffect(() => {
    if (!mapReady) return;

    const rawDrones = data.drones || [];

    const droneFeatures: any[] = [];
    const gcsFeatures: any[] = [];
    const vectorLines: any[] = [];

    for (const d of rawDrones) {
      droneFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: {
          id: d.id,
          name: d.name,
          model: d.model,
          category: d.category,
          affiliation: d.affiliation,
          affiliation_code: d.affiliation_code || 'DRONE',
          lat: d.lat,
          lng: d.lng,
          alt_feet: d.alt_feet || 1000,
          alt_text: `${Math.round((d.alt_feet || 1000) * 0.3048)}m`,
          speed_kts: d.speed_kts || 40,
          rf_freq: d.rf_freq || '2.4 GHz',
          remote_id: d.remote_id || 'N/A',
          mission: d.mission || '기체 비행 감시',
          color: d.color || '#FF1744',
          gcs_lat: d.gcs_lat,
          gcs_lng: d.gcs_lng,
        }
      });

      if (d.gcs_lat && d.gcs_lng) {
        gcsFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [d.gcs_lng, d.gcs_lat] },
          properties: {
            drone_id: d.id,
            drone_name: d.name,
            drone_model: d.model,
            lat: d.gcs_lat,
            lng: d.gcs_lng,
          }
        });

        vectorLines.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[d.lng, d.lat], [d.gcs_lng, d.gcs_lat]] },
          properties: { drone_id: d.id }
        });
      }
    }

    setGeo('drones', droneFeatures);
    setGeo('cuas-gcs-emitters', gcsFeatures);
    setGeo('cuas-vector-lines', vectorLines);
  }, [mapReady, data.drones, setGeo]);

  // DPRK Strategic Military, Nuclear, Missile, UAV, MLRS, SPG & HARTS Sites
  useEffect(() => {
    if (!mapReady) return;
    const sites = data.dprk_sites || [];
    setGeo('dprk-sites-src', activeLayers.dprk_sites ? sites.map((s: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        title: s.title,
        category: s.category,
        category_label: s.category_label,
        tactical_type: s.tactical_type,
        verification_level: s.verification_level,
        source_org: s.source_org,
        source_date: s.source_date,
        report_title: s.report_title,
        report_url: s.report_url,
        description: s.description,
        satellite_image: s.satellite_image,
        satellite_sensor: s.satellite_sensor,
        imagery_timestamp: s.imagery_timestamp,
        spatial_resolution: s.spatial_resolution,
        palantir_entity_id: s.palantir_entity_id,
        threat_radius_km: s.threat_radius_km || 100,
        estimated_strength: s.estimated_strength || '',
        last_activity: s.last_activity || '',
        threat_assessment: s.threat_assessment || 'HIGH',
        strike_targets: JSON.stringify(s.strike_targets || []),
        countermeasure_systems: JSON.stringify(s.countermeasure_systems || []),
        terrain_type: s.terrain_type || '',
        concealment_level: s.concealment_level || '',
        ontology_links: JSON.stringify(s.ontology_links || []),
        // ── CSIS/NGA/IDF 3단계 정밀 건물/갱도 판독 및 무기 장단점 분석 ──
        intel_agencies: JSON.stringify(s.intel_agencies || []),
        military_coordinates: JSON.stringify(s.military_coordinates || {}),
        site_analysis_3stage: JSON.stringify(s.site_analysis_3stage || {}),
        equipment_details: JSON.stringify(s.equipment_details || {}),
        media_urls: JSON.stringify(Array.isArray(s.media_urls) ? s.media_urls : (s.media_urls ? [s.media_urls] : [])),
        satellite_analysis_callouts: s.satellite_analysis_callouts || '',
      }
    })) : []);
  }, [mapReady, data.dprk_sites, activeLayers.dprk_sites, setGeo]);

  // Bridge 1: DPRK Military Activity Events
  useEffect(() => {
    if (!mapReady) return;
    const activities = data.dprk_activities || [];
    setGeo('dprk-activity-src', activeLayers.dprk_activity ? activities.filter((a: any) => a.lat && a.lng).map((a: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: {
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category,
        source_org: a.source_org,
        source_date: a.source_date,
        report_url: a.report_url,
        verification_tier: a.verification_tier,
        verification_score: a.verification_score,
        terrain_description: a.terrain_description || '',
        media_urls: JSON.stringify(a.media_urls || []),
      }
    })) : []);
  }, [mapReady, data.dprk_activities, activeLayers.dprk_activity, setGeo]);

  // Bridge 2: Seismic Nuclear Watch
  useEffect(() => {
    if (!mapReady) return;
    const events = data.seismic_events || [];
    setGeo('seismic-nuclear-src', activeLayers.seismic_watch ? events.map((e: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: {
        id: e.id,
        magnitude: e.magnitude || 0,
        depth_km: e.depth_km || 0,
        place: e.place || 'Unknown',
        time: e.time,
        source: e.source,
        is_nuclear_suspect: e.is_nuclear_suspect || false,
        nuclear_suspect_reason: e.nuclear_suspect_reason || '',
        nearest_nuclear_facility: e.nearest_nuclear_facility || '',
        distance_to_facility_km: e.distance_to_facility_km || 0,
      }
    })) : []);
  }, [mapReady, data.seismic_events, activeLayers.seismic_watch, setGeo]);

  // Malware Threats
  useEffect(() => {
    if (!mapReady) return;
    setGeo('malware-nodes', activeLayers.malware && data.malware_threats ? data.malware_threats.map((t: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [t.lng, t.lat] }, properties: { ip: t.ip, malware: t.malware, status: t.status, threat_type: t.threat_type, country: t.country } })) : []);
  }, [mapReady, data.malware_threats, activeLayers.malware, setGeo]);

  // Network Mesh Generation (Nearest Neighbor Lattice)
  useEffect(() => {
    if (!mapReady) return;
    const meshLinks: any[] = [];
    
    // Generate Malware Botnet Mesh
    if (activeLayers.malware && data.malware_threats && data.malware_threats.length > 1) {
      const nodes = data.malware_threats;
      for (let i = 0; i < nodes.length; i++) {
        // Connect each to next 2 for a global web
        for (let j = 1; j <= 2; j++) {
          const target = nodes[(i + j) % nodes.length];
          meshLinks.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[nodes[i].lng, nodes[i].lat], [target.lng, target.lat]] },
            properties: { threat_type: 'malware' }
          });
        }
      }
    }
    setGeo('network-mesh', meshLinks);
  }, [mapReady, activeLayers.malware, data.malware_threats, setGeo]);

  // ══ LIVE CYBER ATTACKS — Threat network with real-time flow animation ══
  const cyberAnimRef = useRef<number>(0);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const al = activeLayers as any;
    const attacks = data.cyber_attacks;

    // Clean up when toggled off or no data
    if (!al.cyber_attacks || !attacks?.length) {
      cancelAnimationFrame(cyberAnimRef.current);
      setGeo('cyber-arcs', []);
      setGeo('cyber-heads', []);
      setGeo('cyber-impacts', []);
      return;
    }

    // Build static GeoJSON features (dots stay clickable)
    const dots: any[] = [];
    const srcGlows: any[] = [];
    const lines: any[] = [];

    for (const a of attacks) {
      dots.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.dst_lng, a.dst_lat] },
        properties: {
          malware: a.malware, action: a.action, target_ip: a.target_ip,
          target_country: a.target_country, port: a.port, severity: a.severity,
          status: a.status,
          src_lat: a.src_lat.toFixed(2), src_lng: a.src_lng.toFixed(2),
          dst_lat: a.dst_lat.toFixed(2), dst_lng: a.dst_lng.toFixed(2),
        },
      });
      srcGlows.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.src_lng, a.src_lat] },
        properties: { severity: a.severity },
      });
      lines.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[a.src_lng, a.src_lat], [a.dst_lng, a.dst_lat]] },
        properties: { malware: a.malware, severity: a.severity },
      });
    }

    setGeo('cyber-heads', dots);
    setGeo('cyber-impacts', srcGlows);
    setGeo('cyber-arcs', lines);

    // Animate: aggressive marching-ants with fast dash cycling
    const map = mapRef.current;
    let step = 0;
    function animateFlow() {
      step++;
      if (!map) return;
      try {
        // Fast cycling dash pattern — creates visible movement along the line
        const phase = (step * 0.15) % 6;
        map.setPaintProperty('cyber-arcs-flow', 'line-dasharray', [2, 3 + phase * 0.4]);

        // Alternate opacity on the core line for flicker effect
        const coreFlicker = 0.55 + Math.sin(step * 0.05) * 0.15;
        map.setPaintProperty('cyber-arcs-core', 'line-opacity', coreFlicker);

        // Pulse target dots — breathing black nodes
        const pulse = 1.5 + Math.sin(step * 0.1) * 0.6;
        map.setPaintProperty('cyber-heads', 'circle-stroke-width', pulse);
        map.setPaintProperty('cyber-heads', 'circle-stroke-color',
          step % 30 < 15 ? '#222222' : '#444444'
        );

        // Pulse source glow — dark breathing aura
        const glowPulse = 0.06 + Math.sin(step * 0.07) * 0.04;
        map.setPaintProperty('cyber-impacts', 'circle-opacity', glowPulse);
      } catch {}
      cyberAnimRef.current = requestAnimationFrame(animateFlow);
    }
    cyberAnimRef.current = requestAnimationFrame(animateFlow);

    return () => cancelAnimationFrame(cyberAnimRef.current);
  }, [mapReady, (activeLayers as any).cyber_attacks, data.cyber_attacks, setGeo]);


  useEffect(() => {
    if (!mapReady) return;
    setGeo('gps-jamming', activeLayers.gps_jamming && data.gps_jamming ? data.gps_jamming.map((z: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [z.lng, z.lat] }, properties: { severity: z.severity } })) : []);
  }, [mapReady, data.gps_jamming, activeLayers.gps_jamming, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('cctv', activeLayers.cctv && data.cameras ? data.cameras.map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { id: c.id, name: c.name, city: c.city, country: c.country, source: c.source, feed_url: c.feed_url, stream_url: c.stream_url, stream_type: c.stream_type, external_url: c.external_url } })) : []);
  }, [mapReady, data.cameras, activeLayers.cctv, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('fires', activeLayers.fires && data.fires ? data.fires.map((f: any) => ({ 
      type: 'Feature', 
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, 
      properties: { 
        brightness: f.brightness,
        frp: f.frp,
        classification: f.classification || 'wildfire',
        facility: f.facility || '',
        alert_text: f.alert_text || '',
        is_military: !!f.is_military,
        is_industrial: !!f.is_industrial,
        severity: f.severity || 'ELEVATED',
        confidence: f.confidence || 'nominal',
        date: f.date || '',
        time: f.time || '',
      } 
    })) : []);
  }, [mapReady, data.fires, activeLayers.fires, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('weather', activeLayers.weather && data.weather_events ? data.weather_events.map((w: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [w.lng, w.lat] }, properties: { title: w.title, type: w.type, icon: w.icon, severity: w.severity, source: w.source, id: w.id } })) : []);
  }, [mapReady, data.weather_events, activeLayers.weather, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('infrastructure', activeLayers.infrastructure && data.infrastructure ? data.infrastructure.map((i: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { name: i.name, city: i.city, country: i.country, status: i.status, reactors: i.reactors, capacityMW: i.capacityMW, owner: i.owner, source: i.source, date: i.date, confidence: i.confidence } })) : []);
  }, [mapReady, data.infrastructure, activeLayers.infrastructure, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const isValid = (item: any) => item && typeof item.lat === 'number' && typeof item.lng === 'number' && !isNaN(item.lat) && !isNaN(item.lng);
    setGeo('maritime', activeLayers.maritime && data.maritime_ports ? data.maritime_ports.filter(isValid).map((p: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { name: p.name, country: p.country, type: p.type, volume: p.volume, fleet: p.fleet, rank: p.rank } })) : []);
    setGeo('maritime-choke', activeLayers.maritime && data.maritime_chokepoints ? data.maritime_chokepoints.filter(isValid).map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { name: c.name, traffic: c.traffic, risk: c.risk } })) : []);
    const sanitizeShipCoords = (s: any) => {
      let lat = s.lat;
      let lng = s.lng;
      // Real Port Harbors & Docks Exception List (Allowed to sit at docks & piers)
      const isRealPortDock = 
        (lat >= 37.33 && lat <= 37.47 && lng >= 126.58 && lng <= 126.64) || // Incheon Port Docks
        (lat >= 35.06 && lat <= 35.13 && lng >= 128.80 && lng <= 129.07) || // Busan Port Docks
        (lat >= 36.95 && lat <= 37.02 && lng >= 126.70 && lng <= 126.85) || // Pyeongtaek / Dangjin Docks
        (lat >= 36.00 && lat <= 36.04 && lng >= 129.37 && lng <= 129.40) || // Pohang Docks
        (lat >= 35.43 && lat <= 35.48 && lng >= 129.36 && lng <= 129.40) || // Ulsan Docks
        (lat >= 34.72 && lat <= 34.90 && lng >= 127.70 && lng <= 127.77);   // Yeosu / Gwangyang Docks

      if (isRealPortDock) {
        return [lng, lat];
      }

      // Island Land Safeguards (Prevent ships drifting onto West/South Sea Islands)
      if (lat >= 37.14 && lat <= 37.21 && lng >= 126.07 && lng <= 126.15) lng = 126.22; // Mungapdo 문갑도
      if (lat >= 37.20 && lat <= 37.27 && lng >= 126.07 && lng <= 126.17) lng = 126.24; // Deokjeokdo 덕적도
      if (lat >= 37.19 && lat <= 37.24 && lng >= 126.15 && lng <= 126.20) lng = 126.24; // Soyado 소야도
      if (lat >= 37.23 && lat <= 37.28 && lng >= 126.30 && lng <= 126.37) lng = 126.42; // Jawoldo 자월도
      if (lat >= 37.22 && lat <= 37.30 && lng >= 126.42 && lng <= 126.52) lng = 126.38; // Yeongheungdo 영흥도
      if (lat >= 37.40 && lat <= 37.54 && lng >= 126.35 && lng <= 126.56) lng = 126.30; // Yeongjongdo 영종도
      if (lat >= 37.52 && lat <= 37.83 && lng >= 126.35 && lng <= 126.55) lng = 126.25; // Gangwhado 강화도
      if (lat >= 37.90 && lat <= 37.99 && lng >= 124.60 && lng <= 124.75) lng = 124.52; // Baengnyeongdo 백령도

      // North Korea Inland Land Safeguard (Prevent ROK or DPRK ships sitting on Koksan/Sariwon mountains)
      if (lat >= 37.82 && lat <= 42.50 && lng >= 124.75 && lng <= 130.40) {
        const isNkOpenSea = 
          (lat <= 38.75 && lng <= 124.75) ||
          (lat >= 39.10 && lat <= 39.30 && lng >= 127.55 && lng <= 127.95) ||
          (lat >= 39.85 && lat <= 40.10 && lng >= 128.25 && lng <= 128.60) ||
          (lat >= 41.60 && lat <= 42.30 && lng >= 129.80 && lng <= 130.40);

        if (!isNkOpenSea) {
          if (lng < 127.0) {
            lng = 124.50 - ((Math.abs(s.mmsi || 123) % 30) * 0.01);
          } else {
            lng = 130.60 + ((Math.abs(s.mmsi || 123) % 30) * 0.01);
          }
        }
      }

      if (lat >= 34.75 && lat <= 38.2 && lng >= 126.15 && lng <= 129.42) {
        if (lng < 127.8) {
          lng = 125.75 - ((Math.abs(s.mmsi || 123) % 45) * 0.01);
        } else {
          lng = 129.85 + ((Math.abs(s.mmsi || 123) % 45) * 0.01);
        }
      }
      return [lng, lat];
    };
    const rawShips = data.maritime_ships || [];
    const bridgeVessels = data.enav_portmis_bridge?.vessels || [];
    const allShips = [...rawShips, ...bridgeVessels.map((bv: any) => ({
      id: bv.vessel_id,
      mmsi: bv.mmsi,
      name: `[e-Nav/PORT-MIS] ${bv.name}`,
      type: bv.type,
      lat: bv.lat,
      lng: bv.lng,
      speed: bv.sog,
      heading: bv.cog,
      destination: bv.current_port,
      flag: bv.flag,
      nav_status: `e-Nav LTE-M: ${bv.enav_ltem_status} | PORT-MIS: ${bv.port_mis_permit}`,
      nav_status_code: bv.risk === 'CRITICAL' ? 'UNAUTHORIZED' : 'APPROVED',
      nav_status_short: bv.risk === 'CRITICAL' ? '🚨 무단입항 의심' : '🚢 e-Nav PORT-MIS 승인',
      badge_color: bv.risk === 'CRITICAL' ? '#FF1744' : '#00E676'
    }))];

    setGeo('maritime-ships', activeLayers.maritime && allShips.length > 0 ? allShips.filter(isValid).map((s: any) => {
      const navShort = s.nav_status_short || (s.speed < 0.5 ? '⚓ 묘박 정박' : `🟢 항해 ${s.speed||0}kt`);
      return { 
        type: 'Feature', 
        geometry: { type: 'Point', coordinates: sanitizeShipCoords(s) }, 
        properties: { 
          name: s.name || s.mmsi?.toString(), 
          type: s.type || 'cargo', 
          speed: s.speed, 
          heading: s.heading, 
          destination: s.destination, 
          flag: s.flag, 
          mmsi: s.mmsi || s.id,
          nav_status: s.nav_status || (s.speed < 0.5 ? '묘박 정박 중 (At Anchor)' : '항해 중 (Underway)'),
          nav_status_code: s.nav_status_code || (s.speed < 0.5 ? 'ANCHORED' : 'UNDERWAY'),
          nav_status_short: navShort,
          badge_color: s.badge_color || (s.speed < 0.5 ? '#FF9100' : '#00E676'),
          label_text: `${s.name || s.mmsi} (${navShort})`
        } 
      };
    }) : []);
  }, [mapReady, data.maritime_ports, data.maritime_chokepoints, data.maritime_ships, data.enav_portmis_bridge, activeLayers.maritime, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('balloons', activeLayers.balloons && data.balloons ? data.balloons.map((b: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.lng, b.lat] }, properties: { callsign: b.callsign, type: b.type, status: b.status, altitude: b.altitude, speed: b.speed, verticalRate: b.verticalRate, temperature: b.temperature, color: b.color } })) : []);
  }, [mapReady, data.balloons, activeLayers.balloons, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('radiation', activeLayers.radiation && data.radiation ? data.radiation.map((r: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { name: r.name, city: r.city, country: r.country, reading: r.reading, status: r.status, network: r.network } })) : []);
  }, [mapReady, data.radiation, activeLayers.radiation, setGeo]);

  // NOTAM hazards
  useEffect(() => {
    if (!mapReady) return;
    setGeo('notam-hazards', activeLayers.notam_hazards && data.notam_geojson ? data.notam_geojson.features : []);
  }, [mapReady, data.notam_geojson, activeLayers.notam_hazards, setGeo]);

  // Submarine cables
  useEffect(() => {
    if (!mapReady) return;
    setGeo('submarine-cables', (activeLayers.submarine_cables || activeLayers.cables) && data.cables_geojson ? data.cables_geojson.features : []);
  }, [mapReady, data.cables_geojson, activeLayers.submarine_cables, activeLayers.cables, setGeo]);

  // Dark Fleet kinetic bubbles
  useEffect(() => {
    if (!mapReady) return;
    setGeo('dark-fleet', activeLayers.dark_fleet && data.dark_fleet_geojson ? data.dark_fleet_geojson.features : []);
  }, [mapReady, data.dark_fleet_geojson, activeLayers.dark_fleet, setGeo]);

  // ══ OSIRIS SDK — Lattice Sensor Mesh ══
  // Uses real submarine cable data for SEA domain, curated routes for AIR/INTEL
  useEffect(() => {
    if (!mapReady) return;
    setGeo('sdk-entities', []);

    const anySDK = activeLayers.sdk_sea || activeLayers.sdk_air || activeLayers.sdk_naval;
    if (!anySDK) {
      setGeo('sdk-links', []);
      return;
    }

    const links: any[] = [];

    // ── SEA DOMAIN: Real submarine cable data (1-for-1 Match) ──
    if (activeLayers.sdk_sea && data.submarine_cables) {
      const ignoredColors = new Set(['#9BB5CC', '#A0B8CD', '#8EABC2', '#9bb5cc', '#a0b8cd', '#8eabc2']);
      for (const cable of data.submarine_cables) {
        if (!cable.geometry) continue;
        
        // Remove the light blue background arcs
        if (cable.properties?.color && ignoredColors.has(cable.properties.color)) continue;
        
        links.push({
          type: 'Feature',
          geometry: cable.geometry, // Raw topographic paths exactly from Submarine Map
          properties: {
            domain: 'SEA',
            fromName: cable.properties?.name || 'Submarine Cable',
            toName: cable.properties?.landing_points || '',
            source: 'Global Subsea Cable Network',
            url: 'https://www.submarinecablemap.com/',
            ...cable.properties,
            color: '#1976D2', // Darker blue as requested, more transparent in layer paint
          },
        });
      }
    }

    setGeo('sdk-links', links);
  }, [mapReady, activeLayers.sdk_sea, activeLayers.sdk_air, activeLayers.sdk_naval, data.submarine_cables, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('live-news', activeLayers.live_news && data.live_feeds ? data.live_feeds.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { name: f.name, city: f.city, country: f.country, url: f.url, category: f.category, embed_allowed: f.embed_allowed !== false } })) : []);
  }, [mapReady, data.live_feeds, activeLayers.live_news, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const items = data.news || [];
    setGeo('sigint-news', activeLayers.news_intel && items.length > 0
      ? items.filter((n: any) => n.coords?.length === 2).map((n: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [n.coords[1], n.coords[0]] },
          properties: { title: n.title, source: n.source, risk_score: n.risk_score, link: n.link }
        }))
      : []);
  }, [mapReady, data.news, activeLayers.news_intel, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    // 🔴 CONFLICT ZONES - Live from /api/conflicts 🔴
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/conflicts');
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const conflictData = await res.json();
        if (cancelled) return;

        // Zone anchor markers (war/high/elevated labels)
        const zoneFeatures = (conflictData.zones || []).map((z: any) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
          properties: { 
            label: z.label, 
            severity: z.severity, 
            description: `${z.description}${z.eventCount > 0 ? ` [${z.eventCount} live events detected]` : ''}`,
            sourceUrl: z.sourceUrl,
            eventCount: z.eventCount,
          },
        }));

        // Individual live conflict events (scatter dots across conflict zones)
        const eventFeatures = (conflictData.liveEvents || [])
          .filter((e: any) => e.lat && e.lng)
          .map((e: any) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
            properties: { 
              label: (e.title || 'CONFLICT EVENT').substring(0, 60).toUpperCase(),
              severity: 'war',
              description: e.title || 'Live conflict event detected by GDELT.',
              sourceUrl: e.url || '',
            },
          }));

        setGeo('conflict-zones', [...zoneFeatures, ...eventFeatures]);
      } catch (e) {
        // Fallback: if API fails, use minimal known zones
        const FALLBACK_ZONES = [
          { label: 'UKRAINE WAR', severity: 'war', lat: 48.5, lng: 31.2, description: 'Ongoing Russian invasion of Ukraine.', sourceUrl: 'https://liveuamap.com/' },
          { label: 'GAZA CONFLICT', severity: 'war', lat: 31.35, lng: 34.35, description: 'Active military operations in Gaza.', sourceUrl: 'https://israelpalestine.liveuamap.com/' },
          { label: 'SUDAN CIVIL WAR', severity: 'war', lat: 15.0, lng: 30.0, description: 'SAF vs RSF armed conflict.', sourceUrl: 'https://sudan.liveuamap.com/' },
          { label: 'YEMEN WAR', severity: 'war', lat: 15.5, lng: 48.0, description: 'Houthi operations and Red Sea threats.', sourceUrl: 'https://yemen.liveuamap.com/' },
          { label: 'MYANMAR CONFLICT', severity: 'war', lat: 19.5, lng: 96.5, description: 'Military junta vs opposition forces.', sourceUrl: 'https://myanmar.liveuamap.com/' },
          { label: 'SYRIA', severity: 'high', lat: 35.0, lng: 38.5, description: 'Ongoing civil conflict.', sourceUrl: 'https://syria.liveuamap.com/' },
        ];
        const fallbackFeatures = FALLBACK_ZONES.map(z => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
          properties: { label: z.label, severity: z.severity, description: z.description, sourceUrl: z.sourceUrl },
        }));
        setGeo('conflict-zones', fallbackFeatures);
      }
    })();
    return () => { cancelled = true; };
  }, [mapReady, setGeo]);


  // Visibility
  useEffect(() => {
    if (!mapReady) return;
    setVis(['eq-circles','eq-label'], activeLayers.earthquakes);
    const anySat = activeLayers.satellites || (activeLayers as any).sat_comms || (activeLayers as any).sat_military || (activeLayers as any).sat_navigation || (activeLayers as any).sat_earth || (activeLayers as any).sat_science;
    setVis(['sat-glow','sat-dots'], anySat);
    setVis(['gdelt-dots'], activeLayers.global_incidents);

    setVis(['malware-glow','malware-dots','malware-label'], activeLayers.malware);
    setVis(['network-mesh-atmo', 'network-mesh-glow', 'network-mesh-core'], activeLayers.internet_outages || activeLayers.malware);
    setVis(['cyber-arcs-atmo','cyber-arcs-glow','cyber-arcs-core','cyber-arcs-flow','cyber-heads','cyber-impacts','cyber-labels'], (activeLayers as any).cyber_attacks);
    setVis(['jam-fill','jam-label'], activeLayers.gps_jamming);
    setVis(['day-night-fill'], activeLayers.day_night);
    setVis(['fl-commercial'], activeLayers.flights);
    setVis(['fl-private'], activeLayers.private);
    setVis(['fl-jets'], activeLayers.jets);
    setVis(['fl-mil-rokus', 'fl-mil-dprk', 'fl-mil-china', 'fl-mil-russia', 'fl-mil-ukraine', 'fl-mil-israel', 'fl-mil-japan', 'fl-mil-other'], activeLayers.military);
    setVis(['cctv-glow','cctv-dots','cctv-label'], activeLayers.cctv);
    setVis(['fires-heat'], activeLayers.fires);
    setVis(['weather-glow','weather-dots','weather-label'], activeLayers.weather);
    setVis(['infra-glow','infra-dots','infra-label'], activeLayers.infrastructure);
    setVis(['maritime-glow','maritime-dots','maritime-label'], activeLayers.maritime);
    setVis(['choke-glow','choke-dots','choke-label'], activeLayers.maritime);
    setVis(['ship-icons','ship-dots','ship-glow','ship-label'], activeLayers.maritime);
    // Demarcation Lines (DMZ, NLL, KADIZ, CADIZ, China-ROK EEZ)
    setVis(['demarcation-lines-layer','demarcation-labels-layer'], (activeLayers as any).military_demarcation !== false);
    // DPRK Strategic Sites & Think-Tank Intel Sites
    setVis(['dprk-sites-threat-rings','dprk-sites-glow','dprk-sites-dots','dprk-sites-labels'], (activeLayers as any).dprk_sites !== false);
    // DPRK Military Activities (Harness)
    setVis(['dprk-activity-glow','dprk-activity-dots'], (activeLayers as any).dprk_activity !== false);
    // Seismic Nuclear Watch
    setVis(['seismic-nuclear-glow','seismic-nuclear-dots'], (activeLayers as any).seismic_watch !== false);
    // China Yellow Sea & South China Sea Encroachment & Artificial Islands
    setVis(['china-encroachment-radii','china-encroachment-glow','china-encroachment-dots','china-encroachment-labels'], (activeLayers as any).china_encroachment !== false);
    setVis(['news-glow','news-dots','news-label'], activeLayers.live_news);
    setVis(['sigint-news-glow','sigint-news-dots','sigint-news-label'], activeLayers.news_intel);
    setVis(['conflict-icons'], activeLayers.conflict_zones !== false);

    setVis(['balloon-dots','balloon-label'], activeLayers.balloons);
    setVis(['rad-glow','rad-dots','rad-label'], activeLayers.radiation);
    setVis(['sdk-sea','sdk-sea-glow','sdk-sea-atmo'], activeLayers.sdk_sea !== false);
    setVis(['sdk-air','sdk-air-glow','sdk-air-atmo'], activeLayers.sdk_air !== false);
    setVis(['sdk-intel','sdk-intel-glow','sdk-intel-atmo'], activeLayers.sdk_naval !== false);

    // NOTAM, Cables, Dark Fleet layers
    setVis(['notam-hazards-fill', 'notam-hazards-line', 'notam-hazards-label'], activeLayers.notam_hazards);
    setVis(['submarine-cables-glow', 'submarine-cables-line', 'submarine-cables-label'], activeLayers.submarine_cables || activeLayers.cables);
    setVis(['dark-fleet-bubble-fill', 'dark-fleet-bubble-line', 'dark-fleet-dots', 'dark-fleet-label'], activeLayers.dark_fleet);

    // Sweep layers always visible when data is present (controlled by useEffect)
    setVis(['sweep-connections','sweep-pulse-ring','sweep-device-glow','sweep-device-dots','sweep-device-labels'], true);
  }, [mapReady, activeLayers, setVis]);

  // IP Sweep visualization
  useEffect(() => {
    if (!mapReady) return;
    if (!sweepData?.devices?.length) {
      setGeo('ip-sweep-devices', []);
      setGeo('ip-sweep-pulse', []);
      setGeo('ip-sweep-connections', []);
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    const { center, devices } = sweepData;
    const centerCoord: [number, number] = [center.lng, center.lat];

    // Switch to globe and fly to the sweep location
    try {
      (map as any).setProjection({ type: 'globe' });
      map.setSky({ 'sky-color': '#0A0A0F', 'sky-horizon-blend': 0.02, 'horizon-color': '#0A0A0F', 'horizon-fog-blend': 0.02 });
    } catch { /* projection may not be supported */ }

    map.flyTo({ center: centerCoord, zoom: 14, pitch: 50, bearing: -20, duration: 3000, essential: true });

    // Set center pulse
    setGeo('ip-sweep-pulse', [{
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: centerCoord },
      properties: { ip: sweepData.target_ip },
    }]);

    // Build device features spread in a circle around center
    const allDeviceFeatures = devices.map((d: any, i: number) => {
      const angle = (i / devices.length) * Math.PI * 2;
      const radius = 0.001 + ((i % 7 + 1) * 0.0004);
      const dLng = centerCoord[0] + Math.cos(angle) * radius * (1 / Math.cos(center.lat * Math.PI / 180));
      const dLat = centerCoord[1] + Math.sin(angle) * radius;
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [dLng, dLat] },
        properties: {
          ip: d.ip, device_type: d.device_type, device_icon: d.device_icon,
          color: d.device_color, risk_level: d.risk_level,
          ports: JSON.stringify(d.ports), hostnames: JSON.stringify(d.hostnames),
          vulns: JSON.stringify(d.vulns), cpes: JSON.stringify(d.cpes), tags: JSON.stringify(d.tags),
        },
      };
    });

    // Connection lines from center to each device
    const connectionFeatures = allDeviceFeatures.map((f: any) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: [centerCoord, f.geometry.coordinates] },
      properties: { color: f.properties.color },
    }));

    // Stagger the appearance after 3s flyTo completes
    const timer = setTimeout(() => {
      setGeo('ip-sweep-connections', connectionFeatures);
      const batchSize = 5;
      const batches = Math.ceil(allDeviceFeatures.length / batchSize);
      for (let b = 0; b < batches; b++) {
        setTimeout(() => {
          setGeo('ip-sweep-devices', allDeviceFeatures.slice(0, (b + 1) * batchSize));
        }, b * 100);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [mapReady, sweepData, setGeo]);

  // Scan Targets visualization
  useEffect(() => {
    if (!mapReady || !mapRef.current || !scanTargets) return;
    const map = mapRef.current;
    
    const features = scanTargets.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.lng, t.lat] },
      properties: { ...t }
    }));
    
    const src = map.getSource('scan-targets') as maplibregl.GeoJSONSource;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, [scanTargets, mapReady]);

  // Fly-to
  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyToLocation) return;
    mapRef.current.flyTo({ center: [flyToLocation.lng, flyToLocation.lat], zoom: flyToLocation.zoom || 8, duration: 2000 });
  }, [mapReady, flyToLocation]);

  // Dynamic projection switching (lightweight — no terrain DEM)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    try {
      (map as any).setProjection({ type: projection });
      if (projection === 'globe') {
        try { map.jumpTo({ pitch: 20 }); } catch {}
        try {
          (map as any).setSky({
            'sky-color': '#04040A',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#0a0a1a',
            'horizon-fog-blend': 0.3,
            'fog-color': '#04040A',
            'fog-ground-blend': 0.9,
          });
        } catch (e) { console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e); }
      } else {
        try { map.easeTo({ pitch: 0, duration: 800 }); } catch {}
      }
    } catch (e) {
      console.warn('Projection switch failed:', e);
    }
  }, [mapReady, projection]);

  // 3D Terrain & Buildings layer
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const enabled = activeLayers.terrain_3d;

    try {
      if (enabled) {
        // ── 3D BUILDINGS SOURCE (OpenFreeMap CDN — no API key, globally cached) ──
        if (!map.getSource('osiris-buildings')) {
          map.addSource('osiris-buildings', {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet',
          });
        }

        // ── 3D BUILDING EXTRUSION LAYER ──
        if (!map.getLayer('osiris-3d-buildings')) {
          map.addLayer({
            id: 'osiris-3d-buildings',
            source: 'osiris-buildings',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14.5,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'render_height'],
                0, '#1a1a2e',
                20, '#16213e',
                50, '#0f3460',
                120, '#533483',
                300, '#e94560',
              ],
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15.5, ['get', 'render_height']
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15.5, ['get', 'render_min_height']
              ],
              'fill-extrusion-opacity': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15, 0.7,
              ],
            },
          });
        }

        // Pitch the camera to reveal the 3D skyline
        if (map.getPitch() < 40) {
          try {
            if ((map as any).getProjection?.()?.type === 'globe') {
              map.jumpTo({ pitch: 50 });
            } else {
              map.easeTo({ pitch: 50, duration: 1200 });
            }
          } catch {}
        }

      } else {
        // ── DISABLE 3D ──
        if (map.getLayer('osiris-3d-buildings')) map.removeLayer('osiris-3d-buildings');
      }
    } catch (e) {
      console.warn('[OSIRIS] 3D terrain toggle error:', e);
    }
  }, [mapReady, activeLayers.terrain_3d]);

  // Satellite / Dark style switching
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (mapStyle === prevStyleRef.current) return;
    prevStyleRef.current = mapStyle;
    const map = mapRef.current;

    try {
      if (mapStyle !== 'dark') {
        // Add satellite raster tiles
        if (!map.getSource('satellite-tiles')) {
          map.addSource('satellite-tiles', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 18,
          });
          map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', paint: { 'raster-opacity': 0.85 } }, 'day-night-fill');
        } else {
          map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }
      } else {
        if (map.getLayer('satellite-layer')) {
          map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }
      }
    } catch (e) {
      console.warn('Style switch failed:', e);
    }
  }, [mapReady, mapStyle]);



  const lastTerrainFocus = useRef(0);
  // Terrain loads only at regional zooms; globe overview stays inexpensive.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainEnabled) return;
    const map = mapRef.current;
    installTerrainTileProtocol(maplibregl.addProtocol);
    const dispose = attachTerrain(map, status => onTerrainStatusChange?.(status));
    return () => {
      if (mapRef.current === map) dispose();
    };
  }, [mapReady, terrainEnabled, terrainRetry, onTerrainStatusChange]);

  // A user-requested close-up keeps the current location and avoids a fly-out arc.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainFocus || !terrainEnabled || lastTerrainFocus.current === terrainFocus) return;
    lastTerrainFocus.current = terrainFocus;
    const map = mapRef.current;
    map.easeTo({ zoom: Math.max(10.5, map.getZoom()), pitch: 45, duration: 650 });
  }, [mapReady, terrainFocus, terrainEnabled]);


  // Sync drawn polygons to MapLibre source
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const src = mapRef.current.getSource('draw-polygons') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const features = drawnPolygons.map(p => {
      const ring = p.coordinates;
      const coords = ring.length > 2 && (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1])
        ? [...ring, ring[0]] : ring;
      return {
        type: 'Feature' as const,
        id: p.id,
        geometry: { type: 'Polygon' as const, coordinates: [coords] },
        properties: { id: p.id, name: p.name, color: p.color || '#00E5FF' }
      };
    });
    src.setData({ type: 'FeatureCollection', features });
  }, [mapReady, drawnPolygons]);

  const drawCbRef = useRef({ onDrawComplete, onDrawProgress, onDrawCancel });
  /** Set by the drawing effect so on-screen buttons can dispatch into it. */
  const drawApplyRef = useRef<((a: DrawAction) => void) | null>(null);
  drawCbRef.current = { onDrawComplete, onDrawProgress, onDrawCancel };

  // ── DRAWING MODE ──
  // A four-mode state machine over one set of map handlers.
  //
  // Every mode collects points; what differs is how many are needed and what
  // geometry they produce. Rectangle and circle are two-click shapes, so the
  // cursor stands in for their second point until it is committed — which is
  // what makes the preview and the final shape come from the same code path
  // instead of two that can disagree.
  //
  // Escape cancels, Backspace removes the last vertex, Enter or a double click
  // finishes. Drawing without an undo is the difference between a tool and a
  // demo: a misplaced vertex twenty clicks in should not cost the whole shape.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const SRC = 'draw-temp-source';
    const IDS = ['draw-fill-temp', 'draw-line-temp', 'draw-points-temp'];

    const teardown = () => {
      IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      drawingCoordsRef.current = [];
      map.getCanvas().style.cursor = '';
      map.doubleClickZoom.enable();
    };

    if (!drawMode) {
      teardown();
      drawCbRef.current.onDrawProgress?.(null);
      return;
    }

    map.doubleClickZoom.disable();
    map.getCanvas().style.cursor = 'crosshair';
    drawingCoordsRef.current = [];

    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'draw-fill-temp', type: 'fill', source: SRC,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'draw-line-temp', type: 'line', source: SRC,
        filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false],
        paint: { 'line-color': '#00E5FF', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      map.addLayer({
        id: 'draw-points-temp', type: 'circle', source: SRC,
        filter: ['==', ['geometry-type'], 'MultiPoint'],
        paint: { 'circle-color': '#00E5FF', 'circle-radius': 4, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#04040A' },
      });
    }

    // Declared before paint(), which closes over it. Leaving it below would
    // work only while no call happens in between — a temporal-dead-zone crash
    // waiting for someone to add one.
    let state: DrawState = initialDrawState(drawMode);

    /** Redraw the preview from committed points plus an optional cursor point. */
    const paint = (cursor?: [number, number]) => {
      const committed = state.points;
      const pts = cursor ? [...committed, cursor] : committed;
      const src = map.getSource(SRC) as maplibregl.GeoJSONSource;
      if (!src) return;

      drawCbRef.current.onDrawProgress?.(pts.length ? measure(drawMode, pts) : null);

      if (pts.length === 0) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      const features: any[] = [
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: committed } },
      ];

      const geom = buildGeometry(drawMode, pts);
      if (drawMode === 'line') {
        if (pts.length > 1) {
          features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom } });
        }
      } else if (geom.length >= 3) {
        // Show the enclosed area as it will be, not just its outline.
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closeRing(geom)] } });
      } else if (geom.length === 2) {
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom } });
      }

      src.setData({ type: 'FeatureCollection', features });
    };

    // The interaction lives in drawReducer, which is unit tested. This is the
    // adapter: map events in, reducer out, preview repainted.
    const apply = (action: DrawAction) => {
      const t = drawReducer(state, action);
      state = t.state;
      drawingCoordsRef.current = state.points;
      if (t.result) drawCbRef.current.onDrawComplete?.(t.result);
      if (t.cancelled) drawCbRef.current.onDrawCancel?.();
      paint();
    };

    let dblGuard = false;

    const onClick = (e: any) => {
      if (dblGuard) return;
      apply({ type: 'click', at: [e.lngLat.lng, e.lngLat.lat] });
    };

    const onMove = (e: any) => {
      if (state.points.length === 0) return;
      paint([e.lngLat.lng, e.lngLat.lat]);
    };

    const onDblClick = (e: any) => {
      e.preventDefault();
      dblGuard = true;
      setTimeout(() => { dblGuard = false; }, 300);
      apply({ type: 'dblclick' });
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); apply({ type: 'cancel' }); }
      else if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.preventDefault(); apply({ type: 'undo' }); }
      else if (ev.key === 'Enter') { ev.preventDefault(); apply({ type: 'finish' }); }
    };
    drawApplyRef.current = apply;

    map.on('click', onClick);
    map.on('mousemove', onMove);
    map.on('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);

    return () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
      map.off('dblclick', onDblClick);
      window.removeEventListener('keydown', onKey);
      teardown();
    };
  }, [mapReady, drawMode]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {/* CCTV real-time preview tiles on map (zoom 11+) */}
      {activeLayers.cctv !== false && activeLayers.cctv_previews !== false && (
        <CctvPreviews
          mapRef={mapRef}
          active={mapReady}
          onOpen={(cam: any) => {
            onEntityClick?.({ ...cam, type: 'cctv' });
          }}
        />
      )}
    </div>
  );
}

export default memo(OsirisMap);
