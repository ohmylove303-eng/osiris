import { NextResponse } from 'next/server';

export interface TrackedEntity {
  id: string;
  type: 'vehicle' | 'person';
  label: string;
  subclass: string;
  confidence: number;
  // Normalized bounding box in percentage [top, left, width, height] (0-100)
  box: [number, number, number, number];
  velocity_kmh: number;
  heading_deg: number;
  status: 'moving' | 'stationary' | 'accelerating' | 'turning';
  history: [number, number][]; // [[x, y], ...]
  color: string;
  license_plate?: string;
  attribute?: string;
  segment_mask?: [number, number][]; // SAM 2.1 contour polygon [[x, y], ...]
}

function generateContourMask(box: [number, number, number, number], type: 'vehicle' | 'person'): [number, number][] {
  const [top, left, width, height] = box;
  if (type === 'vehicle') {
    return [
      [Number((left + width * 0.05).toFixed(1)), Number((top + height * 0.82).toFixed(1))],
      [Number((left + width * 0.18).toFixed(1)), Number((top + height * 0.50).toFixed(1))],
      [Number((left + width * 0.35).toFixed(1)), Number((top + height * 0.16).toFixed(1))],
      [Number((left + width * 0.70).toFixed(1)), Number((top + height * 0.16).toFixed(1))],
      [Number((left + width * 0.88).toFixed(1)), Number((top + height * 0.46).toFixed(1))],
      [Number((left + width * 0.98).toFixed(1)), Number((top + height * 0.78).toFixed(1))],
      [Number((left + width * 0.94).toFixed(1)), Number((top + height * 0.96).toFixed(1))],
      [Number((left + width * 0.78).toFixed(1)), Number((top + height * 0.96).toFixed(1))],
      [Number((left + width * 0.22).toFixed(1)), Number((top + height * 0.96).toFixed(1))],
      [Number((left + width * 0.06).toFixed(1)), Number((top + height * 0.96).toFixed(1))],
    ];
  } else {
    return [
      [Number((left + width * 0.50).toFixed(1)), Number((top + height * 0.02).toFixed(1))],
      [Number((left + width * 0.75).toFixed(1)), Number((top + height * 0.22).toFixed(1))],
      [Number((left + width * 0.70).toFixed(1)), Number((top + height * 0.60).toFixed(1))],
      [Number((left + width * 0.65).toFixed(1)), Number((top + height * 0.98).toFixed(1))],
      [Number((left + width * 0.35).toFixed(1)), Number((top + height * 0.98).toFixed(1))],
      [Number((left + width * 0.30).toFixed(1)), Number((top + height * 0.60).toFixed(1))],
      [Number((left + width * 0.25).toFixed(1)), Number((top + height * 0.22).toFixed(1))],
      [Number((left + width * 0.50).toFixed(1)), Number((top + height * 0.05).toFixed(1))],
    ];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const camId = searchParams.get('camId') || 'CAM-SEOUL-01';
  const filter = searchParams.get('filter') || 'all'; // 'all' | 'vehicle' | 'person'
  const targetId = searchParams.get('targetId') || null;

  // 1. Try forwarding to local Python Vision Server (YOLO26 + trackers + SAM 2.1 + ALPR)
  const pythonServerUrl = process.env.VISION_SERVER_HTTP || 'http://127.0.0.1:8100';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);
    const pyUrl = `${pythonServerUrl}/track/${encodeURIComponent(camId)}?filter=${encodeURIComponent(filter)}${targetId ? `&target_id=${encodeURIComponent(targetId)}` : ''}`;
    const pyRes = await fetch(pyUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (pyRes.ok) {
      const pyData = await pyRes.json();
      return NextResponse.json({
        status: pyData.status || 'ok',
        camId: pyData.camId || pyData.cam_id || camId,
        timestamp: pyData.timestamp || new Date().toISOString(),
        fps: pyData.fps ?? 30,
        filter: pyData.filter || filter,
        counts: pyData.counts || { total: 0, vehicles: 0, persons: 0 },
        engines: pyData.engines,
        entities: pyData.entities || [],
        lockedTarget: pyData.lockedTarget || pyData.locked_target || null,
        source: 'python_vision_server',
      });
    }
  } catch {
    // Python vision server offline or starting up; proceed to resilient internal fallback
  }

  // 2. Resilient Deterministic Engine (Next.js Internal Fallback)
  const now = Date.now();
  const timeStep = (now / 1000) % 60; // 0 to 60 seconds loop

  // camId-based deterministic seed so each camera returns unique positions
  const camHash = Array.from(camId).reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0x7fffffff, 0);
  const camOffset = (camHash % 37) + 1; // 1-37 offset per camera

  const v1_box: [number, number, number, number] = [
    55 + Math.sin(timeStep * 0.2 + camOffset * 0.3) * 2,
    Math.min(95, Math.max(5, ((timeStep * 4.5 + camOffset * 7) % 100))),
    16,
    11,
  ];

  const v2_box: [number, number, number, number] = [
    68 + Math.cos(timeStep * 0.15 + camOffset * 0.2) * 2,
    Math.min(92, Math.max(8, (100 - ((timeStep * 5.2 + camOffset * 5) % 100)))),
    19,
    13,
  ];

  const v3_box: [number, number, number, number] = [
    42 + (camOffset % 5),
    Math.min(90, Math.max(10, (((timeStep * 2.8 + 20 + camOffset * 3) % 100)))),
    22,
    15,
  ];

  const p1_box: [number, number, number, number] = [
    32 + Math.sin(timeStep * 0.4) * 1.5,
    Math.min(85, Math.max(15, 35 + Math.sin(timeStep * 0.3) * 12)),
    9,
    15,
  ];

  const p2_box: [number, number, number, number] = [
    38 + Math.cos(timeStep * 0.25) * 1.2,
    Math.min(88, Math.max(10, 65 - (timeStep * 1.8) % 40)),
    11,
    14,
  ];

  // Pre-configured dynamic traffic simulation matching real Korean CCTV feeds
  const rawEntities: TrackedEntity[] = [
    // Vehicles
    {
      id: 'TRK-V-102',
      type: 'vehicle',
      label: 'VEHICLE',
      subclass: '현대 그랜저 (Sedan)',
      confidence: 0.96,
      box: v1_box,
      velocity_kmh: Math.round(52 + Math.cos(timeStep * 0.3 + camOffset) * 6),
      heading_deg: (92 + camOffset * 3) % 360,
      status: 'moving',
      history: [
        [(((timeStep * 4.5 + camOffset * 7) - 15) + 100) % 100, 56],
        [(((timeStep * 4.5 + camOffset * 7) - 10) + 100) % 100, 55.5],
        [(((timeStep * 4.5 + camOffset * 7) - 5) + 100) % 100, 55.2],
        [v1_box[1], v1_box[0]],
      ],
      color: '#00E5FF',
      license_plate: '서울34가 8291',
      attribute: '블랙 세단 · 2차로 정속 주행',
      segment_mask: generateContourMask(v1_box, 'vehicle'),
    },
    {
      id: 'TRK-V-105',
      type: 'vehicle',
      label: 'VEHICLE',
      subclass: '기아 카니발 (Van)',
      confidence: 0.94,
      box: v2_box,
      velocity_kmh: Math.round(61 + Math.sin(timeStep * 0.2 + camOffset) * 4),
      heading_deg: (272 + camOffset * 5) % 360,
      status: 'moving',
      history: [
        [(100 - ((timeStep * 5.2 + camOffset * 5) - 15) % 100 + 100) % 100, 67],
        [(100 - ((timeStep * 5.2 + camOffset * 5) - 10) % 100 + 100) % 100, 67.5],
        [(100 - ((timeStep * 5.2 + camOffset * 5) - 5) % 100 + 100) % 100, 68],
        [v2_box[1], v2_box[0]],
      ],
      color: '#38EF7D',
      license_plate: '경기70바 1403',
      attribute: '화이트 밴 · 1차로 추월 주행',
      segment_mask: generateContourMask(v2_box, 'vehicle'),
    },
    {
      id: 'TRK-V-108',
      type: 'vehicle',
      label: 'VEHICLE',
      subclass: '볼보 FL 트럭 (Heavy)',
      confidence: 0.91,
      box: v3_box,
      velocity_kmh: 44 + (camOffset % 8),
      heading_deg: (90 + camOffset * 7) % 360,
      status: 'moving',
      history: [
        [(((timeStep * 2.8 + 5 + camOffset * 3) % 100)), 42 + (camOffset % 5)],
        [(((timeStep * 2.8 + 10 + camOffset * 3) % 100)), 42 + (camOffset % 5)],
        [(((timeStep * 2.8 + 15 + camOffset * 3) % 100)), 42 + (camOffset % 5)],
        [v3_box[1], v3_box[0]],
      ],
      color: '#FFB300',
      license_plate: '인천88아 5920',
      attribute: '적재 화물 트럭 · 3차로',
      segment_mask: generateContourMask(v3_box, 'vehicle'),
    },

    // Pedestrians / Persons
    {
      id: 'TRK-P-021',
      type: 'person',
      label: 'PERSON',
      subclass: '보행자 (Pedestrian)',
      confidence: 0.89,
      box: p1_box,
      velocity_kmh: 4.8,
      heading_deg: 45,
      status: 'moving',
      history: [
        [32, 33],
        [34, 32.5],
        [p1_box[1], p1_box[0]],
      ],
      color: '#FF0055',
      attribute: '어두운 외투 · 횡단보도 진입',
      segment_mask: generateContourMask(p1_box, 'person'),
    },
    {
      id: 'TRK-P-024',
      type: 'person',
      label: 'PERSON',
      subclass: '자전거/이륜차 (Cyclist)',
      confidence: 0.93,
      box: p2_box,
      velocity_kmh: 18.2,
      heading_deg: 265,
      status: 'moving',
      history: [
        [65, 38],
        [60, 38],
        [p2_box[1], p2_box[0]],
      ],
      color: '#E040FB',
      attribute: '자전거 도로 통행',
      segment_mask: generateContourMask(p2_box, 'person'),
    },
  ];

  // Apply filters
  let filtered = rawEntities;
  if (filter === 'vehicle') {
    filtered = rawEntities.filter(e => e.type === 'vehicle');
  } else if (filter === 'person') {
    filtered = rawEntities.filter(e => e.type === 'person');
  }

  // Selected target lock-on analysis
  const lockedTarget = targetId ? rawEntities.find(e => e.id === targetId) : filtered[0] || null;

  return NextResponse.json({
    status: 'ok',
    camId,
    timestamp: new Date().toISOString(),
    fps: 30,
    source: 'nextjs_internal_fallback',
    engines: {
      rank1_detection: {
        name: 'Ultralytics YOLO26 (NMS-free E2E)',
        repo: 'ultralytics/ultralytics',
        stars: '65k+',
        role: 'NMS-free One-to-One Label 할당 · 43% CPU ONNX 가속 · 1.7-11.8ms TensorRT · MuSGD 옵티마이저',
        upgrade_from: 'YOLO11 (2024.09) → YOLO26 (2026.01)',
      },
      rank2_tracking: {
        name: 'ByteTrackTracker / BoT-SORT (Roboflow Trackers)',
        repo: 'roboflow/trackers',
        stars: '52k+',
        role: 'ByteTrack+SORT+OC-SORT+BoT-SORT+C-BIoU+McByte 6대 알고리즘 · Optuna 자동 튜닝 · HOTA/IDF1/MOTA 벤치마크 내장',
        upgrade_from: 'sv.ByteTrack (deprecated@0.28.0, removed@0.31.0) → trackers 독립 패키지',
      },
      rank3_lockon: {
        name: 'Meta SAM 2.1 (Segment Anything 2.1)',
        repo: 'facebookresearch/sam2',
        stars: '22k+',
        role: '독립 per-object 추론 · torch.compile VOS 전체 모델 가속 · 강화 폐색 복원 · 동적 mid-stream 프롬프팅',
        upgrade_from: 'SAM 2 → SAM 2.1 (occlusion checkpoints, vos_optimized=True)',
      },
      rank4_alpr: {
        name: 'EasyKoreanLpDetector (한국 번호판 전용 ALPR)',
        repo: 'gyupro/EasyKoreanLpDetector',
        role: 'YOLO26s 차량 탐지 → YOLOv5 번호판 크롭 → 한글 OCR · 신구 8자리 포맷 지원',
      },
    },
    counts: {
      total: rawEntities.length,
      vehicles: rawEntities.filter(e => e.type === 'vehicle').length,
      persons: rawEntities.filter(e => e.type === 'person').length,
    },
    filter,
    entities: filtered,
    lockedTarget,
  });
}
