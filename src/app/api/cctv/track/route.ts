import { NextResponse } from 'next/server';

export interface TrackedEntity {
  id: string;
  type: 'vehicle' | 'person';
  label: string;
  subclass: string;
  confidence: number;
  box: [number, number, number, number]; // [top, left, width, height] (0-100%)
  velocity_kmh: number;
  heading_deg: number;
  status: 'moving' | 'stationary' | 'accelerating' | 'turning';
  history: [number, number][]; // [[x, y], ...]
  color: string;
  license_plate?: string;
  attribute?: string;
  segment_mask?: [number, number][]; // SAM 2.1 contour polygon [[x, y], ...]
}

const DEFAULT_ENGINES = {
  rank1_detection: {
    name: 'Ultralytics YOLO11n / YOLO26 (NMS-free SOTA)',
    repo: 'ultralytics/ultralytics',
    stars: '65k+',
    role: '2.6M 초경량 나노 가중치 · 29ms 추론 · One-to-One 레이블 할당',
    upgrade_from: 'YOLO11 (2024.09) → YOLO26 (2026.01)',
  },
  rank2_tracking: {
    name: 'ByteTrackTracker (Roboflow Trackers / Zhang et al. ECCV)',
    repo: 'roboflow/trackers',
    stars: '52k+',
    role: 'ByteTrack 칼만 필터 궤적 추적 · 실시간 속도 및 방향각 산출',
    upgrade_from: 'sv.ByteTrack (removed@0.31.0) → trackers 2.6.1',
  },
  rank3_lockon: {
    name: 'Meta SAM 2.1 (Segment Anything 2.1)',
    repo: 'facebookresearch/sam2',
    stars: '22k+',
    role: '실시간 객체 윤곽선 폴리곤 추출 및 타깃 락온',
    upgrade_from: 'SAM 2 → SAM 2.1',
  },
  rank4_alpr: {
    name: 'EasyOCR / EasyKoreanLpDetector (한국 번호판 ALPR)',
    repo: 'JaidedAI/EasyOCR',
    role: '차량 영역 크롭 및 번호판 광학 문자 인식',
  },
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { frame, streamUrl, camId = 'CAM-LIVE', filter = 'all', targetId = null } = body;

    const pythonServerUrl = process.env.VISION_SERVER_HTTP || 'http://127.0.0.1:8100';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const pyRes = await fetch(`${pythonServerUrl}/track/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cam_id: camId,
        frame_base64: frame || null,
        stream_url: streamUrl || null,
        filter,
        target_id: targetId,
      }),
      signal: controller.signal,
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
        engines: pyData.engines || DEFAULT_ENGINES,
        entities: pyData.entities || [],
        lockedTarget: pyData.lockedTarget || pyData.locked_target || null,
        source: 'real_time_yolo11_bytetrack',
      });
    }
  } catch {
    // Vision server offline or error
  }

  // Zero-fake-data policy: Never fabricate coordinates
  return NextResponse.json({
    status: 'engine_standby',
    camId: 'CAM-LIVE',
    timestamp: new Date().toISOString(),
    fps: 0,
    filter: 'all',
    counts: { total: 0, vehicles: 0, persons: 0 },
    engines: DEFAULT_ENGINES,
    entities: [],
    lockedTarget: null,
    source: 'engine_standby',
    message: '비전 AI 엔진 대기 중 (실제 프레임 입력 대기)',
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const camId = searchParams.get('camId') || 'CAM-SEOUL-01';
  const filter = searchParams.get('filter') || 'all';
  const targetId = searchParams.get('targetId') || null;
  const streamUrl = searchParams.get('streamUrl') || null;

  const pythonServerUrl = process.env.VISION_SERVER_HTTP || 'http://127.0.0.1:8100';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    let pyRes: Response;
    if (streamUrl) {
      pyRes = await fetch(`${pythonServerUrl}/track/frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cam_id: camId,
          stream_url: streamUrl,
          filter,
          target_id: targetId,
        }),
        signal: controller.signal,
      });
    } else {
      const pyUrl = `${pythonServerUrl}/track/${encodeURIComponent(camId)}?filter=${encodeURIComponent(filter)}${targetId ? `&target_id=${encodeURIComponent(targetId)}` : ''}`;
      pyRes = await fetch(pyUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    }
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
        engines: pyData.engines || DEFAULT_ENGINES,
        entities: pyData.entities || [],
        lockedTarget: pyData.lockedTarget || pyData.locked_target || null,
        source: 'real_time_yolo11_bytetrack',
      });
    }
  } catch {
    // Engine offline
  }

  // Zero-fake-data policy
  return NextResponse.json({
    status: 'engine_standby',
    camId,
    timestamp: new Date().toISOString(),
    fps: 0,
    filter,
    counts: { total: 0, vehicles: 0, persons: 0 },
    engines: DEFAULT_ENGINES,
    entities: [],
    lockedTarget: null,
    source: 'engine_standby',
    message: '실제 프레임 수신 대기 중 (가짜 좌표 생성 차단됨)',
  });
}
