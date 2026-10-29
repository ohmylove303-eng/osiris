import { NextResponse } from 'next/server';
import { getTacticalRadioChannels } from '@/lib/gods-eye-bridge/sigint-radio-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = getTacticalRadioChannels();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch radio channels' },
      { status: 500 }
    );
  }
}
