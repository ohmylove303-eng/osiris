/**
 * ═══════════════════════════════════════════════════════════════
 *  OSIRIS — One-Click AI Overview
 *  POST /api/ai/overview   body: { mode: 'alerts' | 'markets' | 'chain', payload }
 *
 *  Generates an intelligence read-out for the Alerts, Markets or Chain
 *  panel. Uses Gemini when GEMINI_API_KEY_* is configured, otherwise
 *  falls back to a built-in heuristic analyst so the button always
 *  works — no key required. For alerts, both paths also return the
 *  structured brief (threads, seismic, coverage) the panel renders.
 * ═══════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import { createGeminiClient, rotateApiKey } from '@/lib/ai-engine';
import {
  BLOCS, buildAlertBrief, timeAgo,
  type AlertBrief, type Bloc, type DigestQuake, type DigestReport,
} from '@/lib/alert-digest';

export const dynamic = 'force-dynamic';

type Mode = 'alerts' | 'markets' | 'chain';

function getEnvApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim().length > 0) keys.push(key.trim());
  }
  return keys;
}

/* ─────────────────────────── Digest builders ─────────────────────────── */

type Digest = { summaryLine: string; facts: string[]; highlights: string[] };

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '');
}

function digestMarkets(payload: any): Digest {
  const markets = payload?.markets || {};
  const space = payload?.spaceWeather;
  const facts: string[] = [];
  const highlights: string[] = [];

  // Flatten every ticker across sections into { name, pct }
  const tickers: { name: string; pct: number; price: number | null }[] = [];
  for (const section of Object.keys(markets)) {
    const group = markets[section];
    if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
    for (const [name, d] of Object.entries<any>(group)) {
      const pct = num(d?.change_percent);
      if (pct === null) continue;
      tickers.push({ name, pct, price: num(d?.price) });
    }
  }

  if (tickers.length) {
    const up = tickers.filter(t => t.pct > 0).length;
    const down = tickers.filter(t => t.pct < 0).length;
    const sorted = [...tickers].sort((a, b) => b.pct - a.pct);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const breadthDesc = up >= down ? '위험선호 (Risk-On) 매수 우위' : '위험회피 (Risk-Off) 하방 압력';

    facts.push(`추적 중인 ${tickers.length}개 핵심 금융 자산 — ${up}개 상승 / ${down}개 하락 (${breadthDesc}).`);
    if (top && top.pct > 0) {
      facts.push(`최대 상승 지표: ${top.name} +${top.pct.toFixed(2)}%.`);
      highlights.push(`▲ ${top.name} +${top.pct.toFixed(2)}%`);
    }
    if (bottom && bottom.pct < 0) {
      facts.push(`최대 하락 지표: ${bottom.name} ${bottom.pct.toFixed(2)}%.`);
      highlights.push(`▼ ${bottom.name} ${bottom.pct.toFixed(2)}%`);
    }
  } else {
    facts.push('현재 수신된 실시간 시장 지표 데이터가 없습니다.');
  }

  const btc = markets?.crypto?.Bitcoin || markets?.crypto?.BTC || markets?.crypto?.bitcoin;
  const btcPct = num(btc?.change_percent);
  if (btcPct !== null) {
    facts.push(`비트코인(BTC) ${btcPct >= 0 ? '상승' : '하락'} ${btcPct.toFixed(2)}% (현재가: $${num(btc?.price)?.toLocaleString() ?? '—'}).`);
    highlights.push(`₿ BTC ${btcPct >= 0 ? '+' : ''}${btcPct.toFixed(2)}%`);
  }

  if (space?.kp_index != null) {
    const kp = num(space.kp_index);
    const geomag = kp !== null && kp >= 5 ? '지자기 폭풍 주의' : '안정 상태 (Quiet)';
    facts.push(`우주 기상: 지자기 Kp ${space.kp_index} (${space.storm_level || geomag}).`);
    if (kp !== null && kp >= 5) highlights.push(`⚡ Kp ${space.kp_index} STORM`);
  }

  const breadthWord = tickers.length && tickers.filter(t => t.pct > 0).length >= tickers.filter(t => t.pct < 0).length ? '글로벌 자산 시장에 매수 우위의 안정적 흐름이 유지되고 있습니다.' : '글로벌 자산 시장 전반에 변동성 확대 및 하방 압력이 가해지고 있습니다.';
  return {
    summaryLine: tickers.length ? breadthWord : '시장 데이터 수신 대기 중입니다.',
    facts,
    highlights,
  };
}

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (v !== null && typeof v === 'object' ? (v as Loose) : {});
const isBloc = (v: unknown): v is Bloc => typeof v === 'string' && Object.hasOwn(BLOCS, v);
const str = (v: unknown, max = 300): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null);

/** Accepts the panel's compact slice or an older full dashboard payload. */
function normalizeReports(raw: unknown): DigestReport[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).flatMap((item, i): DigestReport[] => {
    const n = rec(item);
    const rawTitle = str(n.title);
    const title = rawTitle ? decodeEntities(rawTitle) : '';
    if (!title) return [];
    return [{
      id: str(n.id, 100) ?? String(i),
      title,
      text: str(n.text ?? n.description, 800),
      source: str(n.source) ?? 'unknown',
      source_name: str(n.source_name),
      bloc: isBloc(n.bloc) ? n.bloc : null,
      published: str(n.published, 40),
      link: str(n.link, 500),
      flag: str(n.flag, 20),
      views: typeof n.views === 'number' ? n.views : null,
      also_reported_by: Array.isArray(n.also_reported_by)
        ? n.also_reported_by.slice(0, 12).map(entry => {
            const a = rec(entry);
            return { source: str(a.source) ?? 'unknown', source_name: str(a.source_name), bloc: isBloc(a.bloc) ? a.bloc : null };
          })
        : null,
    }];
  });
}

function normalizeQuakes(raw: unknown): DigestQuake[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map(item => {
    const q = rec(item);
    const props = rec(q.properties);
    return {
      magnitude: num(q.magnitude ?? q.mag ?? props.mag),
      place: str(q.place ?? props.place),
      time: typeof q.time === 'number' || typeof q.time === 'string' ? q.time : null,
      tsunami: num(q.tsunami),
      url: str(q.url, 500),
    };
  });
}

function digestAlerts(payload: unknown): { digest: Digest; brief: AlertBrief; reports: DigestReport[] } {
  const p = rec(payload);
  const reports = normalizeReports(p.news ?? p.news_intel);
  const brief = buildAlertBrief({
    news: reports,
    earthquakes: normalizeQuakes(p.earthquakes ?? p.quakes),
  });

  const facts = [...brief.facts];
  const highlights = [...brief.highlights];

  const weather = Array.isArray(p.weather_events) ? p.weather_events.map(rec) : [];
  if (weather.length) {
    const high = weather.filter(w => str(w.severity)?.toLowerCase() === 'high').length;
    const types = [...new Set(weather.map(w => str(w.type)).filter(Boolean))].slice(0, 3).join(', ');
    facts.push(`${weather.length} active severe-weather events${high ? `, ${high} high-severity` : ''}${types ? ` (${types})` : ''}.`);
    if (high) highlights.push(`${high} severe weather`);
  }

  const conflicts = Array.isArray(p.conflicts) ? p.conflicts : [];
  if (conflicts.length) facts.push(`${conflicts.length} conflict zones on the map layer.`);

  if (!facts.length) facts.push('No significant alerts in the current feed window.');
  return { digest: { summaryLine: brief.bottomLine, facts, highlights }, brief, reports };
}

/** The newest headlines, each attributed, for the model to read. */
function headlineContext(reports: DigestReport[]): string {
  return [...reports]
    .sort((a, b) => (Date.parse(b.published ?? '') || 0) - (Date.parse(a.published ?? '') || 0))
    .slice(0, 40)
    .map(r => {
      const who = `${r.source_name || r.source}${r.bloc ? ` (${BLOCS[r.bloc].label})` : ''}`;
      const carried = r.also_reported_by?.length ? `, also carried by ${r.also_reported_by.length} other channel(s)` : '';
      return `- [${timeAgo(r.published) || 'undated'}] ${who}${carried}: ${r.title}`;
    })
    .join('\n');
}

/**
 * Chain-threat brief: exploits, crypto CVEs and OFAC wallet designations.
 * Facts are stated with their figures so the heuristic path stays useful
 * when no Gemini key is configured.
 */
function digestChain(payload: any): Digest {
  const b = payload?.brief || payload || {};
  const t = b.totals || {};
  const exploits: any[] = Array.isArray(b.exploits) ? b.exploits : [];
  const cves: any[] = Array.isArray(b.cves) ? b.cves : [];
  const wallets: any[] = Array.isArray(b.sanctioned_wallets) ? b.sanctioned_wallets : [];

  const facts: string[] = [];
  const highlights: string[] = [];

  const losses = num(t.exploit_losses_usd) ?? 0;
  const usd = (n: number) =>
    n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;

  if (exploits.length) {
    facts.push(`최근 ${b.window_days ?? 30}일간 ${t.exploit_count ?? exploits.length}건의 온체인 탈취 사고로 총 ${usd(losses)} 상당 피해 발생.`);
    const biggest = [...exploits].sort((a, b2) => (num(b2.amount_usd) ?? 0) - (num(a.amount_usd) ?? 0))[0];
    if (biggest) {
      facts.push(`최대 피해 사고: ${biggest.chain} 네트워크의 ${biggest.name} — ${biggest.technique} 수법으로 ${usd(num(biggest.amount_usd) ?? 0)} 피해.`);
      highlights.push(biggest.name);
    }
    // Which attack techniques actually dominate the window.
    const byTech = new Map<string, number>();
    for (const e of exploits) byTech.set(e.technique, (byTech.get(e.technique) || 0) + 1);
    const top = [...byTech.entries()].sort((a, b2) => b2[1] - a[1])[0];
    if (top && top[1] > 1) facts.push(`주요 침해 수법: ${top[0]} (총 ${top[1]}건).`);
    const bridges = exploits.filter(e => e.bridge_hack).length;
    if (bridges) facts.push(`이 중 ${bridges}건이 크로스체인 브릿지 해킹.`);
  } else {
    facts.push('선택된 관측 기간 내 주요 온체인 침해 사고는 없습니다.');
  }

  if (cves.length) {
    const crit = num(t.critical_cves) ?? 0;
    facts.push(`총 ${t.cve_count ?? cves.length}건의 암호화폐 관련 CVE 보안 취약점 식별${crit ? ` (이 중 ${crit}건 CVSS 9.0 이상 치명적 위험)` : ''}.`);
    const worst = [...cves].sort((a, b2) => (num(b2.cvss) ?? 0) - (num(a.cvss) ?? 0))[0];
    if (worst?.cvss != null) {
      facts.push(`최고 위험도 취약점: ${worst.id} (CVSS ${worst.cvss}).`);
      highlights.push(worst.id);
    }
  }

  if (wallets.length) {
    const byAsset = new Map<string, number>();
    for (const w of wallets) byAsset.set(w.asset, (byAsset.get(w.asset) || 0) + 1);
    const spread = [...byAsset.entries()].map(([a, n]) => `${n}개 ${a}`).join(', ');
    facts.push(`OFAC 제재 대상 지정 지갑 총 ${t.sanctioned_wallet_count ?? wallets.length}개 식별 (${spread}).`);
  }

  const summaryLine = exploits.length
    ? `최근 ${b.window_days ?? 30}일간 ${t.exploit_count ?? exploits.length}건의 온체인 탈취 사고로 총 ${usd(losses)} 상당 피해 발생.`
    : '선택된 관측 기간 내 온체인 위협 표면은 비교적 안정적입니다.';

  return { summaryLine, facts, highlights };
}

/* ─────────────────────────── Renderers ─────────────────────────── */

function heuristicOverview(mode: Mode, digest: Digest): string {
  const bullets = digest.facts.map(f => `• ${f}`).join('\n');
  return `${digest.summaryLine}\n\n${bullets}`;
}

const SYSTEM_DEFAULT =
  '당신은 대한민국 최고 등급 군사정보 시스템 "번개의 눈동자" 전술 분석관입니다. 수집된 실시간 지표 데이터를 종합하여 지휘관을 위한 직관적이고 날카로운 2~4문장의 한국어 전술 분석 브리핑을 작성하십시오. 서론 없이 즉시 핵심 결론부터 명확하게 서술하십시오.';

const SYSTEM_ALERTS =
  '당신은 대한민국 군사전술 OSINT 정보 분석관 "번개의 눈동자"입니다. 수집된 텔레그램 및 통신 채널 헤드라인을 바탕으로 지휘관용 상황 요약 브리핑을 한국어로 3~5문장 작성하십시오. 출처 채널의 편향과 진영 시각을 객관적으로 명시하고 미확인 주장은 사실로 단정하지 마십시오.';

async function ollamaOverview(mode: Mode, digest: Digest, headlines?: string): Promise<string | null> {
  const OLLAMA = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const model = process.env.LOCAL_AI_MODEL ?? 'qwen3:14b-osiris';
  try {
    const sysPrompt = mode === 'alerts' ? SYSTEM_ALERTS : SYSTEM_DEFAULT;
    const userPrompt = [
      `[분석 모드: ${mode === 'markets' ? '글로벌 자산 시장 지표' : mode === 'alerts' ? '실시간 전술 경보' : '온체인 안보 위협'}]`,
      `[핵심 요약 결론]: ${digest.summaryLine}`,
      `[수집된 사실 지표]:\n${digest.facts.map(f => `• ${f}`).join('\n')}`,
      headlines ? `[수신 전술 헤드라인]:\n${headlines}` : '',
      '위 지표에 기반하여 지휘관용 실시간 상황 분석 브리핑을 한국어 2~4문장으로 작성하십시오.',
    ].filter(Boolean).join('\n\n');

    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: '<think>\n</think>' },
        ],
        stream: false,
        options: { temperature: 0.3, num_predict: 400 }
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = (data?.message?.content || data?.message?.thinking || '').trim();
    return content || null;
  } catch (err) {
    console.warn('[OSIRIS] Local Ollama overview failed, falling back to heuristic:', err);
    return null;
  }
}

async function geminiOverview(mode: Mode, digest: Digest, keys: string[], headlines?: string): Promise<string | null> {
  try {
    const client = createGeminiClient(rotateApiKey(keys));
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: mode === 'alerts' ? SYSTEM_ALERTS : SYSTEM_DEFAULT,
    });
    const prompt = [
      `MODE: ${mode.toUpperCase()}`,
      `BOTTOM LINE: ${digest.summaryLine}`,
      `FACTS:\n${digest.facts.map(f => `- ${f}`).join('\n')}`,
      headlines ? `HEADLINES (newest first):\n${headlines}` : '',
      '위 팩트를 종합하여 지휘관용 한국어 전술 분석 브리핑을 작성하십시오.',
    ].filter(Boolean).join('\n\n');
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text || null;
  } catch (e) {
    console.warn('[OSIRIS] Gemini overview failed, using heuristic:', e);
    return null;
  }
}

/* ─────────────────────────── Handler ─────────────────────────── */

export async function POST(request: NextRequest) {
  /* This reaches Gemini on the server's key, like analyze and briefing, so it
     gets the same gate they have. It was the only one of the three without. */
  if (isRateLimited(getClientIp(request), 20)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: { mode?: Mode; payload?: any };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const mode: Mode =
    body.mode === 'markets' ? 'markets' : body.mode === 'chain' ? 'chain' : 'alerts';
  const alerts = mode === 'alerts' ? digestAlerts(body.payload) : null;
  const digest =
    alerts ? alerts.digest
    : mode === 'markets' ? digestMarkets(body.payload)
    : digestChain(body.payload);

  let overview: string | null = null;
  let generatedBy: 'local_ai' | 'gemini' | 'analyst' = 'analyst';

  // 1. Physically call Local Ollama AI (Port 11434: qwen3:14b-osiris)
  overview = await ollamaOverview(mode, digest, alerts ? headlineContext(alerts.reports) : undefined);
  if (overview) {
    generatedBy = 'local_ai';
  } else {
    // 2. Fallback to Gemini if configured
    const keys = getEnvApiKeys();
    if (keys.length > 0) {
      overview = await geminiOverview(mode, digest, keys, alerts ? headlineContext(alerts.reports) : undefined);
      if (overview) generatedBy = 'gemini';
    }
  }

  // 3. Fallback to refined Korean Heuristic Overview
  if (!overview) {
    overview = heuristicOverview(mode, digest);
    generatedBy = 'analyst';
  }

  const briefingSource = generatedBy === 'gemini' ? 'gemini_cloud' : 'local_ai';
  return NextResponse.json({
    mode,
    overview,
    highlights: digest.highlights,
    generatedBy,
    briefingSource,
    provider: generatedBy === 'gemini' ? 'gemini' : generatedBy === 'local_ai' ? 'qwen3:14b-osiris' : 'rule',
    generatedAt: new Date().toISOString(),
    ...(alerts ? { brief: alerts.brief } : {}),
  });
}
