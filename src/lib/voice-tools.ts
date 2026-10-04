/**
 * OSIRIS Tactical Voice Tools & Command Grammar
 * Supports both OpenAI Realtime API function definitions and local NLP command parsing.
 */

export interface VoiceToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface VoiceActionResult {
  tool: string;
  params: Record<string, any>;
  feedback: string;
}

export const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number; zoom: number; label: string }> = {
  seoul: { lat: 37.5665, lng: 126.978, zoom: 11, label: '대한민국 서울' },
  서울: { lat: 37.5665, lng: 126.978, zoom: 11, label: '대한민국 서울' },
  pyongyang: { lat: 39.0392, lng: 125.7625, zoom: 11, label: '북한 평양' },
  평양: { lat: 39.0392, lng: 125.7625, zoom: 11, label: '북한 평양' },
  dmz: { lat: 37.95, lng: 126.68, zoom: 11, label: '한반도 군사분계선 (DMZ)' },
  군사분계선: { lat: 37.95, lng: 126.68, zoom: 11, label: '한반도 군사분계선 (DMZ)' },
  panmunjom: { lat: 37.956, lng: 126.677, zoom: 14, label: '판문점 공동경비구역' },
  판문점: { lat: 37.956, lng: 126.677, zoom: 14, label: '판문점 공동경비구역' },
  tokyo: { lat: 35.6762, lng: 139.6503, zoom: 11, label: '일본 도쿄' },
  도쿄: { lat: 35.6762, lng: 139.6503, zoom: 11, label: '일본 도쿄' },
  beijing: { lat: 39.9042, lng: 116.4074, zoom: 10, label: '중국 베이징' },
  베이징: { lat: 39.9042, lng: 116.4074, zoom: 10, label: '중국 베이징' },
  taiwan: { lat: 24.5, lng: 119.5, zoom: 8, label: '대만 해협' },
  대만: { lat: 24.5, lng: 119.5, zoom: 8, label: '대만 해협' },
  대만해협: { lat: 24.5, lng: 119.5, zoom: 8, label: '대만 해협' },
  washington: { lat: 38.9072, lng: -77.0369, zoom: 11, label: '미국 워싱턴 D.C.' },
  워싱턴: { lat: 38.9072, lng: -77.0369, zoom: 11, label: '미국 워싱턴 D.C.' },
  moscow: { lat: 55.7558, lng: 37.6173, zoom: 10, label: '러시아 모스크바' },
  모스크바: { lat: 55.7558, lng: 37.6173, zoom: 10, label: '러시아 모스크바' },
  kyiv: { lat: 50.4501, lng: 30.5234, zoom: 11, label: '우크라이나 키이우' },
  키이우: { lat: 50.4501, lng: 30.5234, zoom: 11, label: '우크라이나 키이우' },
  hawaii: { lat: 21.3069, lng: -157.8583, zoom: 10, label: '하와이 진주만' },
  하와이: { lat: 21.3069, lng: -157.8583, zoom: 10, label: '하와이 진주만' },
  guam: { lat: 13.4443, lng: 144.7937, zoom: 11, label: '미군 앤더슨 공군기지 (괌)' },
  괌: { lat: 13.4443, lng: 144.7937, zoom: 11, label: '미군 앤더슨 공군기지 (괌)' },
  yongsan: { lat: 37.5326, lng: 126.9805, zoom: 14, label: '용산 국방부/합참' },
  용산: { lat: 37.5326, lng: 126.9805, zoom: 14, label: '용산 국방부/합참' },
};

/**
 * 10 Core Voice Tools for OpenAI Realtime API
 */
export const VOICE_TOOLS: VoiceToolDefinition[] = [
  {
    type: 'function',
    name: 'fly_to',
    description: 'Fly the map camera to a specific location or coordinates.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Name of the city, region, or strategic landmark (e.g. "Seoul", "Pyongyang", "Taiwan Strait").',
        },
        lat: { type: 'number', description: 'Latitude in decimal degrees' },
        lng: { type: 'number', description: 'Longitude in decimal degrees' },
        zoom: { type: 'number', description: 'Zoom level (typically 3 to 17)' },
      },
    },
  },
  {
    type: 'function',
    name: 'set_sensor_mode',
    description: 'Switch visual sensor mode (NORMAL, CRT, NVG, FLIR_WHITE, FLIR_IRONBOW, NOIR, SNOW).',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['NORMAL', 'CRT', 'NVG', 'FLIR_WHITE', 'FLIR_IRONBOW', 'NOIR', 'SNOW'],
          description: 'The sensor post-processing visual filter mode.',
        },
      },
      required: ['mode'],
    },
  },
  {
    type: 'function',
    name: 'toggle_layer',
    description: 'Toggle tactical map layer visibility on or off.',
    parameters: {
      type: 'object',
      properties: {
        layer: {
          type: 'string',
          enum: [
            'flights',
            'military',
            'maritime',
            'satellites',
            'cctv',
            'earthquakes',
            'fires',
            'weather',
            'cyber_attacks',
            'military_demarcation',
            'dprk_sites',
          ],
          description: 'The tactical layer to toggle.',
        },
        enabled: { type: 'boolean', description: 'Whether to enable or disable the layer. If omitted, toggles.' },
      },
      required: ['layer'],
    },
  },
  {
    type: 'function',
    name: 'enter_cockpit',
    description: 'Enter or exit 3rd-person cockpit chase camera mode on a tracked aircraft.',
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'True to enter cockpit mode, false to exit.' },
        icao24: { type: 'string', description: 'Optional target aircraft ICAO 24-bit hex code' },
      },
      required: ['enabled'],
    },
  },
  {
    type: 'function',
    name: 'toggle_detection',
    description: 'Toggle military bounding box detection overlay on screen targets.',
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'True to display detection boxes, false to hide.' },
      },
      required: ['enabled'],
    },
  },
  {
    type: 'function',
    name: 'toggle_military_hud',
    description: 'Toggle tactical heads-up telemetry display (MGRS, speed, bearing).',
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'True to display military HUD, false to hide.' },
      },
      required: ['enabled'],
    },
  },
  {
    type: 'function',
    name: 'reset_globe',
    description: 'Reset camera to global overview.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    type: 'function',
    name: 'track_entity',
    description: 'Select and track a specific aircraft or vessel by callsign or ID.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Callsign, vessel name, or entity identifier to track.' },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'toggle_contacts',
    description: 'Open or close the 250km tactical contacts roster list.',
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'True to open contacts roster, false to close.' },
      },
      required: ['enabled'],
    },
  },
  {
    type: 'function',
    name: 'measure_distance',
    description: 'Measure distance between current viewpoint and a target coordinate or landmark.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Destination city, landmark, or coordinates.' },
      },
      required: ['target'],
    },
  },
];

/**
 * Natural language intent parser for zero-latency local speech command execution.
 */
export function parseLocalVoiceCommand(text: string): VoiceActionResult | null {
  const norm = text.trim().toLowerCase().replace(/[?,.!\n]/g, '');

  if (!norm) return null;

  // 1. Reset globe
  if (
    norm.includes('지구 전체') ||
    norm.includes('전체 보기') ||
    norm.includes('글로브') ||
    norm.includes('reset globe') ||
    norm.includes('overview')
  ) {
    return {
      tool: 'reset_globe',
      params: {},
      feedback: '지구 전체 시점으로 초기화합니다.',
    };
  }

  // 2. Cockpit Mode
  if (norm.includes('콕핏') || norm.includes('조종석') || norm.includes('cockpit')) {
    const isExit = norm.includes('꺼') || norm.includes('끄') || norm.includes('해제') || norm.includes('exit') || norm.includes('off');
    return {
      tool: 'enter_cockpit',
      params: { enabled: !isExit },
      feedback: isExit ? '콕핏 모드를 해제합니다.' : '항공기 콕핏 모드로 진입합니다.',
    };
  }

  // 3. Detection Overlay
  if (norm.includes('탐지') || norm.includes('바운딩') || norm.includes('detection')) {
    const isOff = norm.includes('꺼') || norm.includes('끄') || norm.includes('해제') || norm.includes('hide') || norm.includes('off');
    return {
      tool: 'toggle_detection',
      params: { enabled: !isOff },
      feedback: isOff ? '탐지 오버레이를 비활성화합니다.' : '전술 탐지 오버레이를 활성화합니다.',
    };
  }

  // 4. Military HUD
  if (norm.includes('hud') || norm.includes('허드') || norm.includes('헤드업')) {
    const isOff = norm.includes('꺼') || norm.includes('끄') || norm.includes('해제') || norm.includes('hide') || norm.includes('off');
    return {
      tool: 'toggle_military_hud',
      params: { enabled: !isOff },
      feedback: isOff ? '군사 HUD를 숨깁니다.' : '군사 HUD를 활성화합니다.',
    };
  }

  // 5. Contacts Roster
  if (norm.includes('컨택트') || norm.includes('접촉') || norm.includes('로스터') || norm.includes('contacts')) {
    const isOff = norm.includes('닫') || norm.includes('꺼') || norm.includes('hide') || norm.includes('close');
    return {
      tool: 'toggle_contacts',
      params: { enabled: !isOff },
      feedback: isOff ? '컨택츠 로스터를 닫습니다.' : '250km 반경 컨택츠 로스터를 전개합니다.',
    };
  }

  // 6. Sensor Modes
  if (norm.includes('야간') || norm.includes('nvg') || norm.includes('나이트')) {
    return {
      tool: 'set_sensor_mode',
      params: { mode: 'NVG' },
      feedback: 'NVG 야간투시 센서 모드로 전환합니다.',
    };
  }
  if (norm.includes('열화상') || norm.includes('flir') || norm.includes('적외선')) {
    const isWhite = norm.includes('화이트') || norm.includes('백색');
    return {
      tool: 'set_sensor_mode',
      params: { mode: isWhite ? 'FLIR_WHITE' : 'FLIR_IRONBOW' },
      feedback: `FLIR ${isWhite ? '화이트핫' : '아이언보우'} 열화상 센서 모드로 전환합니다.`,
    };
  }
  if (norm.includes('흑백') || norm.includes('느와르') || norm.includes('noir')) {
    return {
      tool: 'set_sensor_mode',
      params: { mode: 'NOIR' },
      feedback: 'NOIR 고대비 센서 모드로 전환합니다.',
    };
  }
  if (norm.includes('crt') || norm.includes('레트로')) {
    return {
      tool: 'set_sensor_mode',
      params: { mode: 'CRT' },
      feedback: 'CRT 레이더 인광체 모드로 전환합니다.',
    };
  }
  if (norm.includes('일반 모드') || norm.includes('노멀') || norm.includes('정상')) {
    return {
      tool: 'set_sensor_mode',
      params: { mode: 'NORMAL' },
      feedback: '기본 광학 센서 모드로 복귀합니다.',
    };
  }

  // 7. Layer toggles
  if (norm.includes('군용기') || norm.includes('military flight')) {
    return {
      tool: 'toggle_layer',
      params: { layer: 'military' },
      feedback: '군용기 레이어 표시를 전환합니다.',
    };
  }
  if (norm.includes('항공기') || norm.includes('비행기') || norm.includes('flights')) {
    return {
      tool: 'toggle_layer',
      params: { layer: 'flights' },
      feedback: '항공기 레이어를 전환합니다.',
    };
  }
  if (norm.includes('선박') || norm.includes('해상') || norm.includes('maritime') || norm.includes('ships')) {
    return {
      tool: 'toggle_layer',
      params: { layer: 'maritime' },
      feedback: '해상 선박 AIS 레이어를 전환합니다.',
    };
  }
  if (norm.includes('위성') || norm.includes('satellites')) {
    return {
      tool: 'toggle_layer',
      params: { layer: 'satellites' },
      feedback: '위성 궤도 추적 레이어를 전환합니다.',
    };
  }
  if (norm.includes('cctv') || norm.includes('카메라')) {
    return {
      tool: 'toggle_layer',
      params: { layer: 'cctv' },
      feedback: 'CCTV 감시 레이어를 전환합니다.',
    };
  }
  if (norm.includes('지진') || norm.includes('earthquake')) {
    return {
      tool: 'toggle_layer',
      params: { layer: 'earthquakes' },
      feedback: '지진 감시 레이어를 전환합니다.',
    };
  }
  if (norm.includes('화재') || norm.includes('산불') || norm.includes('fires')) {
    return {
      tool: 'toggle_layer',
      params: { layer: 'fires' },
      feedback: 'NASA FIRMS 화재 감시 레이어를 전환합니다.',
    };
  }

  // 8. Fly to location
  for (const [key, loc] of Object.entries(KNOWN_LOCATIONS)) {
    if (norm.includes(key)) {
      return {
        tool: 'fly_to',
        params: { location: key, lat: loc.lat, lng: loc.lng, zoom: loc.zoom },
        feedback: `${loc.label} 상공으로 이동합니다.`,
      };
    }
  }

  return null;
}
