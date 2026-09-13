import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface TacticalSessionState {
  version: number;
  bgMode: 'mountain' | 'urban';
  speedKmh: number;
  waypoints: Array<{ x: number; y: number; altitudeM: number }>;
  targets: Array<{
    id: string;
    code: string;
    name: string;
    category: 'INF' | 'AFV' | 'SPH' | 'CP';
    x: number;
    y: number;
    destX?: number | null;
    destY?: number | null;
    maneuverPoints?: Array<{
      id: string;
      index: number;
      x: number;
      y: number;
      headingDeg: number;
      aspectIndex: number;
    }>;
    currentWpIndex?: number;
    isMoving: boolean;
    progress: number;
    headingDeg: number;
    aspectIndex: number;
    distanceM: number;
    identified: boolean;
    reported: boolean;
    destroyed: boolean;
    speedKmh?: number;
  }>;
  cffState: 'STANDBY' | 'TRANSMITTING' | 'SHOT' | 'SPLASH' | 'DESTROYED';
  selectedTargetId: string;
  scores: {
    identification: number;
    report: number;
    callForFire: number;
    safety: number;
    bda: number;
  };
  feedback: string;
  isPlaying?: boolean;
  harnessLocked?: boolean;
  updatedAt: number;
  syncedAt?: string;
}

const HARNESS_DIR = join(process.cwd(), 'data', 'tactical-session');
const HARNESS_FILE = join(HARNESS_DIR, 'harness-baseline.json');

// 🎯 교관이 직접 선정한 최초 시작 기준 위치 (임의 지정 금지)
const DEFAULT_INSTRUCTOR_BASELINE: TacticalSessionState = {
  version: 11,
  bgMode: 'mountain',
  speedKmh: 20,
  isPlaying: false,
  harnessLocked: true,
  waypoints: [
    { x: 44, y: 84, altitudeM: 110 },
    { x: 42, y: 76, altitudeM: 125 },
    { x: 40, y: 70, altitudeM: 140 },
    { x: 37, y: 63, altitudeM: 160 },
    { x: 33, y: 56, altitudeM: 190 },
    { x: 30, y: 52, altitudeM: 220 },
    { x: 34, y: 48, altitudeM: 250 },
  ],
  targets: [
    {
      id: 'AFV-01',
      code: 'AFV-01',
      name: '교육용 가상 표적 AFV-01 (기동 장갑차)',
      category: 'AFV',
      x: 42,
      y: 77,
      isMoving: false,
      speedKmh: 24,
      progress: 0.58,
      headingDeg: 45,
      aspectIndex: 45,
      distanceM: 870,
      identified: true,
      reported: true,
      destroyed: false,
      maneuverPoints: [],
      currentWpIndex: 0,
    },
    {
      id: 'SPH-01',
      code: 'SPH-01',
      name: '교육용 가상 표적 SPH-01',
      category: 'SPH',
      x: 34,
      y: 50,
      isMoving: false,
      speedKmh: 20,
      progress: 0.40,
      headingDeg: 280,
      aspectIndex: 90,
      distanceM: 1045,
      identified: true,
      reported: false,
      destroyed: false,
      maneuverPoints: [],
    },
    {
      id: 'CP-01',
      code: 'CP-01',
      name: '교육용 가상 표적 CP-01',
      category: 'CP',
      x: 64,
      y: 64,
      isMoving: false,
      speedKmh: 0,
      progress: 0,
      headingDeg: 0,
      aspectIndex: 0,
      distanceM: 954,
      identified: true,
      reported: false,
      destroyed: false,
      maneuverPoints: [],
    },
    {
      id: 'INF-01',
      code: 'INF-01',
      name: '교육용 가상 표적 INF-01',
      category: 'INF',
      x: 28,
      y: 71,
      isMoving: false,
      speedKmh: 0,
      progress: 0,
      headingDeg: 180,
      aspectIndex: 0,
      distanceM: 909,
      identified: false,
      reported: false,
      destroyed: false,
      maneuverPoints: [],
    },
  ],
  cffState: 'STANDBY',
  selectedTargetId: 'SPH-01',
  scores: {
    identification: 18,
    report: 17,
    callForFire: 17,
    safety: 16,
    bda: 17,
  },
  feedback: '전반적으로 우수합니다. 표적 식별 정확도를 더 향상시켜 보세요.',
  updatedAt: Date.now(),
  syncedAt: '오전 6:16:07',
};

function loadHarnessBaseline(): TacticalSessionState {
  try {
    if (existsSync(HARNESS_FILE)) {
      const data = readFileSync(HARNESS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('[Harness] Failed to load baseline from file, using default:', e);
  }
  return DEFAULT_INSTRUCTOR_BASELINE;
}

function saveHarnessBaseline(state: TacticalSessionState) {
  try {
    if (!existsSync(HARNESS_DIR)) {
      mkdirSync(HARNESS_DIR, { recursive: true });
    }
    writeFileSync(HARNESS_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Harness] Failed to save baseline to file:', e);
  }
}

// In-memory tactical session storage initialized from permanent harness baseline
let globalSession: TacticalSessionState = loadHarnessBaseline();

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    session: globalSession,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    globalSession = {
      ...globalSession,
      ...payload,
      version: globalSession.version + 1,
      updatedAt: Date.now(),
    };
    saveHarnessBaseline(globalSession);
    return NextResponse.json({
      status: 'ok',
      version: globalSession.version,
      updatedAt: globalSession.updatedAt,
      session: globalSession,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to update tactical session' },
      { status: 400 }
    );
  }
}
