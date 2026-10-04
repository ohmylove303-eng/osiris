import { describe, it, expect } from 'vitest';
import {
  parseLocalVoiceCommand,
  VOICE_TOOLS,
  KNOWN_LOCATIONS,
} from './voice-tools';

describe('voice-tools', () => {
  describe('VOICE_TOOLS schema', () => {
    it('defines 10 core tactical tools', () => {
      expect(VOICE_TOOLS.length).toBe(10);
      const names = VOICE_TOOLS.map(t => t.name);
      expect(names).toContain('fly_to');
      expect(names).toContain('set_sensor_mode');
      expect(names).toContain('toggle_layer');
      expect(names).toContain('enter_cockpit');
      expect(names).toContain('toggle_detection');
      expect(names).toContain('toggle_military_hud');
      expect(names).toContain('reset_globe');
      expect(names).toContain('track_entity');
      expect(names).toContain('toggle_contacts');
      expect(names).toContain('measure_distance');
    });

    it('each tool has valid parameters object', () => {
      for (const tool of VOICE_TOOLS) {
        expect(tool.type).toBe('function');
        expect(tool.parameters.type).toBe('object');
        expect(typeof tool.description).toBe('string');
      }
    });
  });

  describe('parseLocalVoiceCommand', () => {
    it('parses Korean destination commands', () => {
      const res = parseLocalVoiceCommand('평양 상공으로 이동해줘');
      expect(res).not.toBeNull();
      expect(res?.tool).toBe('fly_to');
      expect(res?.params.lat).toBe(KNOWN_LOCATIONS['평양'].lat);
      expect(res?.params.lng).toBe(KNOWN_LOCATIONS['평양'].lng);
    });

    it('parses English destination commands', () => {
      const res = parseLocalVoiceCommand('fly to tokyo now');
      expect(res).not.toBeNull();
      expect(res?.tool).toBe('fly_to');
      expect(res?.params.lat).toBe(KNOWN_LOCATIONS['tokyo'].lat);
    });

    it('parses sensor mode commands', () => {
      const nvg = parseLocalVoiceCommand('야간투시 켜');
      expect(nvg?.tool).toBe('set_sensor_mode');
      expect(nvg?.params.mode).toBe('NVG');

      const flir = parseLocalVoiceCommand('열화상 모드로 전환');
      expect(flir?.tool).toBe('set_sensor_mode');
      expect(flir?.params.mode).toBe('FLIR_IRONBOW');

      const normal = parseLocalVoiceCommand('기본 일반 모드로 복귀');
      expect(normal?.tool).toBe('set_sensor_mode');
      expect(normal?.params.mode).toBe('NORMAL');
    });

    it('parses cockpit and overlay toggles', () => {
      const cockpit = parseLocalVoiceCommand('조종석 콕핏 모드 켜');
      expect(cockpit?.tool).toBe('enter_cockpit');
      expect(cockpit?.params.enabled).toBe(true);

      const detection = parseLocalVoiceCommand('탐지 오버레이 꺼');
      expect(detection?.tool).toBe('toggle_detection');
      expect(detection?.params.enabled).toBe(false);

      const hud = parseLocalVoiceCommand('군사 HUD 켜줘');
      expect(hud?.tool).toBe('toggle_military_hud');
      expect(hud?.params.enabled).toBe(true);
    });

    it('parses layer commands', () => {
      const mil = parseLocalVoiceCommand('군용기 레이어 토글');
      expect(mil?.tool).toBe('toggle_layer');
      expect(mil?.params.layer).toBe('military');

      const sat = parseLocalVoiceCommand('위성 레이어 보여줘');
      expect(sat?.tool).toBe('toggle_layer');
      expect(sat?.params.layer).toBe('satellites');
    });

    it('parses reset globe', () => {
      const reset = parseLocalVoiceCommand('지구 전체 보기로 돌려놔');
      expect(reset?.tool).toBe('reset_globe');
    });

    it('returns null for unrecognized speech', () => {
      const unknown = parseLocalVoiceCommand('오늘 저녁 뭐 먹지?');
      expect(unknown).toBeNull();
    });
  });
});
