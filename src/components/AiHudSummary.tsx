'use client';

import { memo, useMemo } from 'react';
import { ShieldAlert, Activity, Radio, Cpu } from 'lucide-react';
import { type SensorMode } from '@/lib/visual-styles';

interface AiHudSummaryProps {
  zoom: number;
  centerLat: number;
  centerLng: number;
  airCount: number;
  seaCount: number;
  sensorMode: SensorMode;
  visible?: boolean;
}

function AiHudSummaryInner({
  zoom,
  centerLat,
  centerLng,
  airCount,
  seaCount,
  sensorMode,
  visible = false,
}: AiHudSummaryProps) {
  // 사용자의 요청에 따라 지도 상단의 불필요한 [DEFCON-2] 범례 및 오버레이 제거
  return null;
}

export const AiHudSummary = memo(AiHudSummaryInner);
export default AiHudSummary;
