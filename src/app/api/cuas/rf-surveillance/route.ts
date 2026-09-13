import { NextResponse } from 'next/server';
import { latLngToMGRS } from '@/lib/mgrs-converter';

export const dynamic = 'force-dynamic';

export type TargetClassification = 
  | 'COOPERATIVE'          // 협조 표적: 유효한 OpenDroneID + 레이더/EO-IR 트랙 일치
  | 'PARTIAL_COOPERATIVE'  // 부분 협조 표적: Remote ID 수신되나 위치/식별 불완전
  | 'NON_COOPERATIVE'      // 비협조 표적: RF 신호/레이더 감지되나 Remote ID 없음
  | 'SPOOFED_DISCREPANT'   // 위장·불일치 표적: Remote ID 좌표와 실제 RF/레이더 트랙 지속 불일치
  | 'GROUND_EMITTER_ONLY'; // 지상 RF 방사원: GCS 조종기 또는 영상송신기 신호만 감지

export interface AndroidOpenDroneIdRecord {
  rx_timestamp: string;
  monotonic_timestamp_ms: number;
  transport: 'BLE_LEGACY' | 'BLE_EXTENDED' | 'WIFI_BEACON' | 'WIFI_NAN_ACTION_FRAME';
  address_or_pseudonym: string;
  rssi_dbm: number;
  channel: number;
  raw_frame_hex: string;
  decode_status: 'DECODE_SUCCESS' | 'CHECKSUM_FAILED' | 'TRUNCATED_FRAME';
  uas_id: string;
  uas_position: { lat: number; lng: number; alt_m: number; mgrs?: string };
  operator_or_takeoff_position: { lat: number; lng: number; alt_m: number; mgrs?: string };
  position_type: 'TAKEOFF' | 'PILOT_GCS' | 'FIXED_BASE';
  speed_kts: number;
  heading_deg: number;
  horizontal_accuracy_m: number;
  vertical_accuracy_m: number;
  authentication_status: 'VERIFIED' | 'UNAUTHENTICATED' | 'SIGNATURE_INVALID';
  track_id: string;
  source_node_id: string;
}

export interface ErrorEllipse95 {
  semi_major_axis_a_m: number;
  semi_minor_axis_b_m: number;
  orientation_azimuth_deg: number;
  chi2_val: number;
  p_total_breakdown: {
    p_sensor_m: number;
    p_sync_m: number;
    p_map_m: number;
    p_model_m: number;
  };
}

export interface KalmanStatePayload {
  state_vector_x: [number, number, number, number];
  mahalanobis_d2: number;
  gating_passed: boolean;
  measurement_residual_v: [number, number];
  innovation_covariance_s: [[number, number], [number, number]];
}

export interface MultiSensorFusionPayload {
  track_id: string;
  classification: TargetClassification;
  classification_label: string;
  model_name: string;
  zone_name: string;
  
  fused_lat: number;
  fused_lng: number;
  fused_mgrs: string;
  fused_alt_m: number;
  fused_speed_kts: number;
  
  android_rid_record?: AndroidOpenDroneIdRecord;
  error_ellipse_95: ErrorEllipse95;
  kalman_state: KalmanStatePayload;
  
  rf_df: {
    freq_mhz: number;
    bandwidth_mhz: number;
    rssi_dbm: number;
    aoa_bearing_deg: number;
    nlos_flag: boolean;
  };
  
  fusion: {
    correlation_status: 'PROBABLE_CORRELATION' | 'UNRESOLVED_DISCREPANCY' | 'SINGLE_SENSOR_TRACK';
    confidence_score: number;
    sensors_used: string[];
  };

  estimated_gcs_lat: number;
  estimated_gcs_lng: number;
  estimated_gcs_mgrs: string;
  gcs_location_type: 'REMOTE_ID_SYSTEM_MSG' | 'TAKEOFF_BROADCAST' | 'RF_TDOA_EMITTER_DF';
  timestamp?: string;
}

// In-Memory Store for Real Sensor Telemetry
let realIngestedCuasStore: MultiSensorFusionPayload[] = [];

export async function GET(req: Request) {
  // Purge telemetry older than 60 seconds
  const now = Date.now();
  realIngestedCuasStore = realIngestedCuasStore.filter(t => {
    if (!t.timestamp) return false;
    const time = new Date(t.timestamp).getTime();
    return now - time < 60000;
  });

  return NextResponse.json({
    status: 'success',
    data_source: 'REAL_LIVE_RF_SENSOR_ONLY',
    notice: 'Synthetic mock C-UAS targets disabled. Returning real RF sensor telemetry received via SDR hardware.',
    system_name: '김포시 & 인천광역시 전지역 광역 C-UAS 무선 정밀 감시망 (Real Hardware Pipeline)',
    architecture: {
      sensor_status: 'AWAITING_PHYSICAL_SDR_TELEMETRY',
      supported_hardware: 'RTL-SDR / HackRF / USRP / Bleak OpenDroneID Android Node',
    },
    targets: realIngestedCuasStore,
    total: realIngestedCuasStore.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

// Hardware Sensor Ingestion POST Endpoint
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.fused_lat || !body.fused_lng) {
      return NextResponse.json({ status: 'error', message: 'Missing fused_lat/fused_lng payload' }, { status: 400 });
    }

    const newTarget: MultiSensorFusionPayload = {
      track_id: body.track_id || `RF-TRK-${Date.now()}`,
      classification: body.classification || 'NON_COOPERATIVE',
      classification_label: body.classification_label || 'Real Live Detected RF Target',
      model_name: body.model_name || 'RF Signal Target',
      zone_name: body.zone_name || 'Live RF Node Radius',
      fused_lat: Number(body.fused_lat),
      fused_lng: Number(body.fused_lng),
      fused_mgrs: latLngToMGRS(Number(body.fused_lat), Number(body.fused_lng)),
      fused_alt_m: Number(body.fused_alt_m || 100),
      fused_speed_kts: Number(body.fused_speed_kts || 20),
      error_ellipse_95: body.error_ellipse_95 || {
        semi_major_axis_a_m: 2.5,
        semi_minor_axis_b_m: 1.2,
        orientation_azimuth_deg: 0,
        chi2_val: 5.991,
        p_total_breakdown: { p_sensor_m: 1.0, p_sync_m: 0.2, p_map_m: 0.1, p_model_m: 0.2 }
      },
      kalman_state: body.kalman_state || {
        state_vector_x: [Number(body.fused_lat), Number(body.fused_lng), 0, 0],
        mahalanobis_d2: 1.0,
        gating_passed: true,
        measurement_residual_v: [0, 0],
        innovation_covariance_s: [[0.01, 0], [0, 0.01]]
      },
      rf_df: body.rf_df || {
        freq_mhz: Number(body.freq_mhz || 2412),
        bandwidth_mhz: 20,
        rssi_dbm: Number(body.rssi_dbm || -50),
        aoa_bearing_deg: 0,
        nlos_flag: false
      },
      fusion: body.fusion || {
        correlation_status: 'SINGLE_SENSOR_TRACK',
        confidence_score: 1.0,
        sensors_used: ['LIVE_HARDWARE_SDR']
      },
      estimated_gcs_lat: Number(body.estimated_gcs_lat || body.fused_lat),
      estimated_gcs_lng: Number(body.estimated_gcs_lng || body.fused_lng),
      estimated_gcs_mgrs: latLngToMGRS(Number(body.estimated_gcs_lat || body.fused_lat), Number(body.estimated_gcs_lng || body.fused_lng)),
      gcs_location_type: body.gcs_location_type || 'RF_TDOA_EMITTER_DF',
      timestamp: new Date().toISOString(),
    };

    const idx = realIngestedCuasStore.findIndex(t => t.track_id === newTarget.track_id);
    if (idx >= 0) {
      realIngestedCuasStore[idx] = newTarget;
    } else {
      realIngestedCuasStore.push(newTarget);
    }

    return NextResponse.json({
      status: 'success',
      message: 'Real live C-UAS RF telemetry ingested successfully',
      target: newTarget,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : 'Invalid JSON' }, { status: 400 });
  }
}
