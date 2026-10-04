import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TacticalVoiceAgent } from './voice-agent';

describe('TacticalVoiceAgent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes in idle state', () => {
    const agent = new TacticalVoiceAgent();
    expect(agent.getState()).toBe('idle');
    agent.destroy();
  });

  it('notifies onStateChange callbacks', () => {
    const onStateChange = vi.fn();
    const agent = new TacticalVoiceAgent({ onStateChange });

    // Manually trigger handleFinalTranscript with recognized command
    const onAction = vi.fn();
    (agent as any).config.onAction = onAction;

    agent.handleFinalTranscript('야간투시 켜');
    expect(onAction).toHaveBeenCalled();
    expect(onAction.mock.calls[0][0].tool).toBe('set_sensor_mode');
    expect(onAction.mock.calls[0][0].params.mode).toBe('NVG');
    agent.destroy();
  });

  it('dispatches flight navigation voice commands', () => {
    const onAction = vi.fn();
    const agent = new TacticalVoiceAgent({ onAction });

    agent.handleFinalTranscript('도쿄로 이동해줘');
    expect(onAction).toHaveBeenCalled();
    const call = onAction.mock.calls[0][0];
    expect(call.tool).toBe('fly_to');
    expect(call.params.location).toBe('도쿄');
    agent.destroy();
  });

  it('gracefully handles speech recognition absence', async () => {
    const onError = vi.fn();
    const agent = new TacticalVoiceAgent({ onError });
    const success = await agent.start();
    expect(success).toBe(false);
    expect(onError).toHaveBeenCalled();
    agent.destroy();
  });
});
