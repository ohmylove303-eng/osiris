import { NextResponse } from 'next/server';
import { VOICE_TOOLS } from '@/lib/voice-tools';

export const runtime = 'nodejs';

/**
 * OpenAI Realtime Session Ephemeral Token Endpoint
 * Generates client session token for direct WebRTC connection.
 * If OPENAI_API_KEY is not configured, provides clear fallback instructions.
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          fallback: 'local_speech',
          message: 'OPENAI_API_KEY not configured. Falling back to local tactical speech engine.',
          tools: VOICE_TOOLS,
        },
        { status: 200 }
      );
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions:
          'You are Lightning Eye (번개의 눈동자) Tactical AI, a military command and situational intelligence agent. Always respond concisely (1-2 sentences). Execute tool calls immediately when user gives tactical instructions (flying to regions, changing sensors, tracking entities, toggling layers).',
        tools: VOICE_TOOLS,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        {
          success: false,
          fallback: 'local_speech',
          error: `OpenAI Realtime error: ${response.status}`,
          details: errText,
        },
        { status: 200 }
      );
    }

    const sessionData = await response.json();
    return NextResponse.json({
      success: true,
      client_secret: sessionData.client_secret,
      session: sessionData,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        fallback: 'local_speech',
        error: error?.message || 'Internal voice session error',
      },
      { status: 500 }
    );
  }
}
