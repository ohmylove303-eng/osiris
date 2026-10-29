import { NextRequest } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeKoreanTacticalSpeech } from '@/lib/korean-audio-normalizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);
const CACHE_DIR = '/tmp/osiris_tactical_radio_cache';

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawText = searchParams.get('text')?.trim();
    const channelId = searchParams.get('channel') || 'TACTICAL';
    const physical = searchParams.get('physical') === '1' || searchParams.get('play') === '1';

    if (!rawText) {
      return new Response(JSON.stringify({ error: 'text query required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Apply tactical Korean phonetic normalization (e.g. NLL -> 엔엘엘, AIS -> 에이아이에스, 12마일 -> 십이 마일)
    const normalizedText = normalizeKoreanTacticalSpeech(rawText);
    const isKorean = /[가-힣]/.test(normalizedText);

    // Select authentic tactical voices installed on macOS
    let voice = 'Yuna';
    if (!isKorean) {
      voice = 'Samantha'; // Aviation ATC style English
    } else if (channelId === 'TACTICAL_MIL' || channelId === 'VHF_CH16') {
      voice = 'Eddy (한국어(한국))'; // Confident Korean male tactical operator
    } else if (channelId === 'RKSS_TWR' || channelId === 'RKSI_APP') {
      voice = 'Flo (한국어(한국))'; // Clear aviation tower controller voice
    }

    // Hash for cache key
    const hash = crypto.createHash('md5').update(`${voice}:${normalizedText}`).digest('hex');
    const wavPath = path.join(CACHE_DIR, `${hash}.wav`);
    const aiffPath = path.join(CACHE_DIR, `${hash}.aiff`);

    if (!fs.existsSync(wavPath)) {
      const escapedText = normalizedText.replace(/"/g, '\\"');
      // 1. Synthesize AIFF using macOS native tactical voice
      try {
        await execAsync(`say -v "${voice}" -o "${aiffPath}" "${escapedText}"`, { timeout: 10000 });
      } catch (voiceErr) {
        // Fallback to Yuna if named voice fails
        await execAsync(`say -v Yuna -o "${aiffPath}" "${escapedText}"`, { timeout: 10000 });
      }

      // 2. Convert to standard 16-bit PCM WAV for HTML5 / Web Audio Context
      await execAsync(`/usr/bin/afconvert -f WAVE -d LEI16 "${aiffPath}" "${wavPath}"`, { timeout: 10000 });
      
      // Clean up temporary AIFF
      try {
        if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);
      } catch {}
    }

    // Physical audio output on host Mac speakers if physical=1
    if (physical && fs.existsSync(wavPath)) {
      exec(`/usr/bin/afplay "${wavPath}"`, () => {});
    }

    const wavBuffer = fs.readFileSync(wavPath);

    return new Response(wavBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
        'X-Tactical-Voice': encodeURIComponent(voice),
      },
    });
  } catch (err: any) {
    console.error('[Tactical Radio Voice Error]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
