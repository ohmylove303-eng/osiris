'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  Bot, User, Send, Cpu, Zap, Activity, ShieldCheck, 
  RefreshCw, Sliders, ChevronDown, ChevronUp, Copy, Check, Sparkles, Eye, MessageSquare,
  Database, PlusCircle, ArrowRight, BookOpen, ExternalLink, CheckCircle2, ShieldAlert,
  Network, Volume2, VolumeX, FileText, Share2
} from 'lucide-react';
import { TacticalSpeechController } from '@/lib/tts-engine';

const BananaVisionStudio = dynamic(() => import('@/components/BananaVisionStudio'), { ssr: false });
const SynapseGraphView = dynamic(() => import('@/components/SynapseGraphView'), { ssr: false });
const InfluencerFaceLockStudio = dynamic(() => import('@/components/InfluencerFaceLockStudio'), { ssr: false });

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  timings?: {
    prompt_per_second?: number;
    predicted_per_second?: number;
    total_tokens?: number;
  };
  timestamp: string;
}

interface SystemPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
}

const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'osint_analyst',
    name: 'OSINT 안보 분석관',
    icon: '🛡️',
    description: '서해 침탈 시설, 위성 영상, 전술 제원 4단계 소크라테스 실재성 검증 보고',
    systemPrompt: '당신은 OSINT 군사 안보 전문 분석관입니다. 관측 사실(FACT), 물리 제원(PHYSICS), 반대 가설 심문(DIALECTIC), 종합 판독(INFERENCE)을 엄격히 구분하여 정밀 브리핑을 작성하세요.'
  },
  {
    id: 'general',
    name: '일반 다목적 AI',
    icon: '✨',
    description: '명확하고 정밀한 답변을 제공하는 다목적 어시스턴트',
    systemPrompt: '당신은 친절하고 정밀한 AI 어시스턴트입니다. 사용자의 질문에 정확하고 가독성 좋게 답변해 주세요.'
  },
  {
    id: 'coder',
    name: '시니어 소프트웨어 엔지니어',
    icon: '💻',
    description: 'TypeScript, Python, C++, Rust 및 시스템 아키텍처 전문가',
    systemPrompt: '당신은 시니어 소프트웨어 엔지니어입니다. 간결하고 안전하며 최적화된 코드와 함께 명확한 가이드를 제공하세요.'
  },
  {
    id: 'quant_researcher',
    name: '양자화 & LLM 엔지니어',
    icon: '⚡',
    description: 'Apple Silicon Metal, GGUF, MoE, Q4/Q5 양자화 및 성능 최적화 전문가',
    systemPrompt: '당신은 LLM 양자화 및 Apple Silicon Metal 가속 최적화 전문가입니다. 하드웨어 스펙과 텐서 연산 관점에서 통찰력 있는 답변을 제공하세요.'
  }
];

const QUICK_PROMPTS = [
  { label: '선란 1호 MMSI 제원', text: '서해 선란 1호에 상주하는 지원 트롤선 루칭위안위 066의 MMSI 번호와 위치, 수심 상태를 4단계 소크라테스 추론으로 분석해줘.' },
  { label: '선란 2호 110m 타워', text: '선란 2호의 직경 110m 8각형 타워 제원 및 CSSC 702연구소 물리 설계 데이터를 검증해줘.' },
  { label: '13기 부표 PMZ 차단선', text: '서해 잠정조치수역(PMZ)에 설치된 중국 13기 부표의 군사적 차단선 목적과 센서를 4단계로 분석해줘.' },
  { label: '서해 8대 시설 해경 단속 한계', text: '중국의 서해 8개 침탈 시설에 대해 대한민국 해양경찰이 실효적 물리 단속을 하지 못하는 법적·군사적 이유를 설명해줘.' },
];

interface IngestDoc {
  id: string;
  title: string;
  category: string;
  contentPreview: string;
  metadata?: {
    source_org?: string;
    source_url?: string;
    date?: string;
    mgrs?: string;
    verification_tier?: string;
  };
}

interface IngestStats {
  totalDocuments: number;
  categories: Record<string, number>;
  lastUpdated: string;
  recentDocuments: IngestDoc[];
}

/** Structured prose — avoid whitespace-pre-wrap brick walls */
function ProseBlocks({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const paras = blocks.length > 0 ? blocks : [text];
  return (
    <div className={`intel-prose ${className}`.trim()}>
      {paras.map((para, i) => (
        <p key={i}>
          {para.split('\n').map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export default function LocalAiStudio() {
  const [mainTab, setMainTab] = useState<'chat' | 'synapse' | 'ingest' | 'vision' | 'influencer'>('influencer');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '⚡ **OSIRIS 로컬 군사 안보 인텔리전스 AI 가동 중**\n\n로컬 Ollama (11434 포트)의 `qwen3:14b` 및 `nomic-embed-text` 768차원 RAG 벡터 DB, 그리고 **옵시디언 시냅스 지식 그래프**가 물리적으로 연동되었습니다.\n\n서해 중국 침탈 8대 시설 및 외부 LLM(ChatGPT, Perplexity)에서 수집한 연구 노트를 소크라테스 4단계 하네스로 검증하며, 답변마다 TTS 음성 브리핑을 지원합니다.',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<SystemPreset>(SYSTEM_PRESETS[0]);
  const [serverStatus, setServerStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  
  // TTS State
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [selectedTtsVoice, setSelectedTtsVoice] = useState<'ko-KR-SunHiNeural' | 'ko-KR-InJoonNeural'>('ko-KR-SunHiNeural');
  const speechControllerRef = useRef<TacticalSpeechController | null>(null);

  const [metrics, setMetrics] = useState({
    promptTps: 0,
    genTps: 0,
    lastLatencyMs: 0
  });
  const [healthInfo, setHealthInfo] = useState<{
    name: string | null;
    quant: string | null;
    size: number | null;
    listenPort: number | null;
    inference: boolean | null;
  }>({ name: null, quant: null, size: null, listenPort: null, inference: null });
  const [chatRag, setChatRag] = useState<{ assertiveAllowed: boolean; ragSuccess: boolean; citations: Array<{ id?: string; title?: string; url?: string }> } | null>(null);
  const [streamElapsedMs, setStreamElapsedMs] = useState(0);
  const [timeoutSoon, setTimeoutSoon] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);

  // Ingest state
  const [ingestStats, setIngestStats] = useState<IngestStats | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestForm, setIngestForm] = useState({
    title: '',
    content: '',
    source_org: 'OSIRIS 전술 검증단',
    category: 'china_encroachment_spec',
    source_url: 'https://osiris.tactical/verified',
  });
  const [ingestStatusMsg, setIngestStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // External LLM Ingestion State (ChatGPT / Perplexity)
  const [externalText, setExternalText] = useState('');
  const [externalTitle, setExternalTitle] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalResultMsg, setExternalResultMsg] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkHealth();
    fetchIngestStats();

    speechControllerRef.current = new TacticalSpeechController((state) => {
      if (!state.isPlaying || state.isPaused) {
        setSpeakingMsgId(null);
      }
    });

    return () => {
      speechControllerRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const formatSize = (n: number | null) => {
    if (!n || n <= 0) return null;
    const gb = n / (1024 ** 3);
    return gb >= 0.1 ? `${gb.toFixed(1)}GB` : `${Math.round(n / (1024 ** 2))}MB`;
  };

  const modelLabel = () => {
    const name = healthInfo.name || 'qwen3:14b';
    const bits = [healthInfo.quant, formatSize(healthInfo.size)].filter(Boolean).join(' · ');
    return bits ? `${name} (${bits})` : name;
  };

  const checkHealth = async () => {
    setServerStatus('checking');
    try {
      const res = await fetch('/api/local-ai/health', { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok) {
        setServerStatus('connected');
        setHealthInfo({
          name: data?.loadedModel?.name ?? null,
          quant: data?.loadedModel?.quant ?? null,
          size: typeof data?.loadedModel?.size === 'number' ? data.loadedModel.size : null,
          listenPort: typeof data?.endpoints?.listenPort === 'number' ? data.endpoints.listenPort : null,
          inference: typeof data?.verification?.inference === 'boolean' ? data.verification.inference : null,
        });
        setStatusHint(data?.verification?.inference === false ? '모델 로딩 중이거나 Ollama 응답 없음' : null);
      } else {
        setServerStatus('error');
        setStatusHint('헬스 체크 실패');
      }
    } catch {
      setServerStatus('error');
      setStatusHint('헬스 체크 실패');
    }
  };

  const fetchIngestStats = async () => {
    try {
      const res = await fetch('/api/harness/ingest-verified');
      if (res.ok) {
        const data = await res.json();
        setIngestStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch ingest stats:', err);
    }
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestForm.title.trim() || !ingestForm.content.trim()) return;
    setIngestLoading(true);
    setIngestStatusMsg(null);
    try {
      const res = await fetch('/api/harness/ingest-verified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingestForm),
      });
      const data = await res.json();
      if (res.ok) {
        setIngestStatusMsg({
          type: 'success',
          text: `✅ 지식 벡터 임베딩 및 영구 저장 완료! (총 ${data.totalDocumentsInStore}개 문서 적재됨)`,
        });
        setIngestForm(prev => ({ ...prev, title: '', content: '' }));
        fetchIngestStats();
      } else {
        setIngestStatusMsg({ type: 'error', text: data.error || data.message || '인제스천 실패' });
      }
    } catch (err: any) {
      setIngestStatusMsg({ type: 'error', text: err.message || '네트워크 오류 발생' });
    } finally {
      setIngestLoading(false);
    }
  };

  const handleExternalIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalText.trim()) return;
    setExternalLoading(true);
    setExternalResultMsg(null);
    try {
      const res = await fetch('/api/synapse/ingest-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: externalText,
          customTitle: externalTitle,
          sourceUrl: externalUrl,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setExternalResultMsg(`✅ [${data.result.sourcePlatform.toUpperCase()}] 연구 노트가 옵시디언 볼트에 저장되고 ${data.result.wikilinksCount}개의 위키링크가 시냅스 그래프에 연결되었습니다!`);
        setExternalText('');
        setExternalTitle('');
        setExternalUrl('');
        fetchIngestStats();
      } else {
        setExternalResultMsg(`⚠️ 오류: ${data.message}`);
      }
    } catch (err: any) {
      setExternalResultMsg(`⚠️ 오류: ${err.message}`);
    } finally {
      setExternalLoading(false);
    }
  };

  const executePrompt = async (promptText: string) => {
    if (!promptText.trim() || loading) return;

    const userText = promptText.trim();
    setInput('');

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamElapsedMs(0);
    setChatRag(null);
    setTimeoutSoon(false);

    const startTime = Date.now();
    const botId = `msg-${Date.now() + 1}`;
    setMessages(prev => [...prev, {
      id: botId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }]);

    try {
      const payloadMessages = [
        { role: 'system', content: activePreset.systemPrompt },
        ...messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userText }
      ];

      const res = await fetch('/api/local-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ messages: payloadMessages, model: healthInfo.name || undefined })
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => '');
        throw new Error(errBody || `chat HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let assembled = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.split("\n").find(l => l.startsWith('data: '));
          if (!line) continue;
          let evt: any;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (typeof evt.elapsed === 'number') setStreamElapsedMs(evt.elapsed);
          if (evt.timeoutSoon) setTimeoutSoon(true);
          if (evt.type === 'rag') {
            setChatRag({
              assertiveAllowed: !!evt.assertiveAllowed,
              ragSuccess: !!evt.ragSuccess,
              citations: Array.isArray(evt.citations) ? evt.citations : [],
            });
          }
          if (evt.type === 'token' && typeof evt.token === 'string') {
            assembled += evt.token;
            const snap = assembled;
            setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: snap } : m));
          }
          if (evt.type === 'error') throw new Error(evt.message || 'stream error');
        }
      }

      setMetrics(m => ({ ...m, lastLatencyMs: Date.now() - startTime }));
      if (!assembled.trim()) {
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: '응답 내용이 없습니다.' } : m));
      }
    } catch (err: any) {
      const port = healthInfo.listenPort ? String(healthInfo.listenPort) : '11434';
      setMessages(prev => prev.map(m => m.id === botId ? {
        ...m,
        content: `⚠️ **오류 발생**: ${err.message || `로컬 AI 서버 연결 실패. Ollama 포트 ${port}를 확인해주세요.`}`
      } : m));
      setTimeoutSoon(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executePrompt(input);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeakMessage = (id: string, text: string) => {
    if (!speechControllerRef.current) return;
    if (speakingMsgId === id) {
      speechControllerRef.current.stop();
      setSpeakingMsgId(null);
    } else {
      speechControllerRef.current.speak(text, selectedTtsVoice);
      setSpeakingMsgId(id);
    }
  };

  const toggleReasoning = (id: string) => {
    setExpandedReasoning(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-[var(--bg-void)] text-[var(--text-primary)] rounded-2xl glass-panel overflow-hidden font-[family-name:var(--font-body)]">
      {/* Top Header & Metrics Dashboard Bar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-[var(--bg-panel)] border-b border-[var(--border-primary)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[rgba(var(--gold-rgb),0.12)] border border-[var(--border-primary)] rounded-xl text-[var(--gold-primary)]">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="intel-title intel-title--hud text-[var(--text-heading)]">⚡ 로컬 AI 통합 스튜디오</h2>
              <div className="flex items-center bg-[var(--bg-void)] p-1 border border-[var(--border-secondary)] rounded-lg intel-meta ml-2">
                <button
                  onClick={() => setMainTab('chat')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    mainTab === 'chat'
                      ? 'bg-[rgba(var(--gold-rgb),0.2)] text-[var(--gold-primary)] font-semibold border border-[var(--border-active)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> 💬 AI 대화 (소크라테스)
                </button>
                <button
                  onClick={() => setMainTab('synapse')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    mainTab === 'synapse'
                      ? 'bg-[rgba(var(--cyan-rgb),0.2)] text-[var(--cyan-primary)] font-semibold border border-[var(--border-cyan)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" /> 🕸️ 시냅스 지식 그래프
                </button>
                <button
                  onClick={() => { setMainTab('ingest'); fetchIngestStats(); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    mainTab === 'ingest'
                      ? 'bg-[rgba(0,230,118,0.15)] text-[var(--alert-green)] font-semibold border border-[rgba(0,230,118,0.3)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" /> 🧠 실시간 지식 인제스천 ({ingestStats?.totalDocuments ?? '104'})
                </button>
                <button
                  onClick={() => setMainTab('vision')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    mainTab === 'vision'
                      ? 'bg-[rgba(var(--cyan-rgb),0.15)] text-[var(--cyan-primary)] font-semibold border border-[var(--border-cyan)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" /> 🍌 제미니 바나나 2.0 & OCR
                </button>
                <button
                  onClick={() => setMainTab('influencer')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    mainTab === 'influencer'
                      ? 'bg-[rgba(var(--gold-rgb),0.2)] text-[var(--gold-primary)] font-semibold border border-[var(--border-active)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> 🌟 AI 인플루언서 1단계 (얼굴 고정)
                </button>
              </div>
            </div>
            <p className="intel-meta mt-0.5">
              모델: {modelLabel()} · Ollama :11434 · 옵시디언 볼트 및 RAG nomic-embed-text (768D){statusHint ? ` · ${statusHint}` : ''}
            </p>
          </div>
        </div>

        {/* Real-time Hardware Metrics Gauges */}
        <div className="flex items-center gap-4 intel-meta bg-[var(--bg-void)]/60 border border-[var(--border-secondary)] px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
            <span className="text-[var(--text-muted)]">RAG 문서:</span>
            <span className="text-[var(--gold-light)] font-semibold">{ingestStats?.totalDocuments ?? 104}건</span>
          </div>
          <div className="h-3 w-px bg-[var(--border-primary)]" />
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
            <span className="text-[var(--text-muted)]">지연시간:</span>
            <span className="text-[var(--cyan-primary)] font-semibold">
              {metrics.lastLatencyMs > 0 ? `${(metrics.lastLatencyMs / 1000).toFixed(1)}s` : '실시간'}
            </span>
          </div>
          <div className="h-3 w-px bg-[var(--border-primary)]" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--alert-green)]" />
            <span className="text-[var(--text-muted)]">상태:</span>
            <span className={`font-semibold ${serverStatus === 'connected' ? 'text-[var(--alert-green)]' : 'text-[var(--alert-orange)]'}`}>
              {serverStatus === 'connected' ? '온라인 (가속 정상)' : serverStatus === 'error' ? '오프라인' : '확인 중'}
            </span>
          </div>
          <button 
            onClick={() => { checkHealth(); fetchIngestStats(); }}
            className="p-1 hover:bg-[var(--hover-accent)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="상태 새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {mainTab === 'influencer' ? (
        <div className="flex-1 overflow-hidden">
          <InfluencerFaceLockStudio />
        </div>
      ) : mainTab === 'vision' ? (
        <div className="flex-1 overflow-hidden">
          <BananaVisionStudio />
        </div>
      ) : mainTab === 'synapse' ? (
        <div className="flex-1 overflow-hidden">
          <SynapseGraphView onChatWithNode={(prompt) => {
            setMainTab('chat');
            executePrompt(prompt);
          }} />
        </div>
      ) : mainTab === 'ingest' ? (
        /* Real-time Knowledge Ingestion & External LLM Panel */
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel-solid)]">
              <div className="flex items-center gap-2 text-[var(--gold-primary)] intel-label">
                <Database className="w-4 h-4" /> 벡터 적재 문서
              </div>
              <div className="mt-2 text-2xl font-bold text-[var(--text-heading)]">
                {ingestStats?.totalDocuments ?? 104} <span className="text-sm font-normal text-[var(--text-muted)]">Docs</span>
              </div>
              <p className="mt-1 intel-meta text-[var(--text-muted)]">실시간 RAG 코사인 유사도 검색</p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel-solid)]">
              <div className="flex items-center gap-2 text-[var(--cyan-primary)] intel-label">
                <Network className="w-4 h-4" /> 옵시디언 볼트 연동
              </div>
              <div className="mt-2 text-xl font-bold text-[var(--text-heading)]">
                data/obsidian-vault
              </div>
              <p className="mt-1 intel-meta text-[var(--text-muted)]">위키링크([[wikilinks]]) 양방향 색인</p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel-solid)]">
              <div className="flex items-center gap-2 text-[var(--alert-green)] intel-label">
                <ShieldCheck className="w-4 h-4" /> 하네스 추론 구조
              </div>
              <div className="mt-2 text-lg font-bold text-[var(--text-heading)]">
                소크라테스 4단계
              </div>
              <p className="mt-1 intel-meta text-[var(--text-muted)]">FACT · PHYSICS · DIALECTIC · INFERENCE</p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel-solid)]">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] intel-label">
                <Volume2 className="w-4 h-4" /> 음성 브리핑 (TTS)
              </div>
              <div className="mt-2 text-lg font-bold text-[var(--text-heading)]">
                Web Speech API
              </div>
              <p className="mt-1 intel-meta text-[var(--text-muted)]">한국어 음성 자동 정제 및 논블로킹 재생</p>
            </div>
          </div>

          {/* External LLM Ingestion Strip (ChatGPT / Perplexity One-Click Ingest) */}
          <div className="p-6 rounded-2xl border border-[var(--border-active)] bg-[rgba(var(--gold-rgb),0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-3">
              <div>
                <h3 className="font-semibold text-base text-[var(--text-heading)] flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-[var(--cyan-primary)]" />
                  외부 LLM(ChatGPT, Perplexity) 연구 사고 데이터 자동 변환 & 옵시디언 볼트 주입
                </h3>
                <p className="intel-meta text-[var(--text-muted)] text-xs mt-1">
                  ChatGPT 대화 복사본이나 Perplexity 검색 결과([1], [2] 각주 포함)를 붙여넣으면, 자동으로 위키링크([[...]])와 메타데이터를 추출하여 볼트에 저장하고 RAG에 인덱싱합니다.
                </p>
              </div>
              <span className="intel-label bg-[rgba(var(--cyan-rgb),0.15)] text-[var(--cyan-primary)] px-2.5 py-1 rounded-lg border border-[var(--border-cyan)] text-xs">
                옵시디언 위키링크 자동 생성
              </span>
            </div>

            {externalResultMsg && (
              <div className="p-3 rounded-xl border intel-meta bg-[rgba(0,230,118,0.1)] border-[rgba(0,230,118,0.3)] text-[var(--alert-green)]">
                {externalResultMsg}
              </div>
            )}

            <form onSubmit={handleExternalIngest} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={externalTitle}
                  onChange={e => setExternalTitle(e.target.value)}
                  placeholder="노트 제목 (비워두면 본문 첫 줄 또는 검색어로 자동 생성)"
                  className="bg-[var(--bg-void)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                />
                <input
                  type="text"
                  value={externalUrl}
                  onChange={e => setExternalUrl(e.target.value)}
                  placeholder="원본 URL (선택 사항: https://www.perplexity.ai/search/...)"
                  className="bg-[var(--bg-void)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                />
              </div>

              <textarea
                required
                rows={4}
                value={externalText}
                onChange={e => setExternalText(e.target.value)}
                placeholder="ChatGPT 사고 과정이나 Perplexity 검색 답변 전문을 여기에 붙여넣으세요... (출처 [1], [2] 링크 및 선란 1호, 부표 등 핵심 단어가 자동으로 [[위키링크]]로 묶입니다)"
                className="w-full bg-[var(--bg-void)] border border-[var(--border-primary)] rounded-lg p-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] font-mono"
              />

              <button
                type="submit"
                disabled={externalLoading || !externalText.trim()}
                className="w-full py-2 px-4 bg-[rgba(var(--cyan-rgb),0.2)] hover:bg-[rgba(var(--cyan-rgb),0.35)] text-[var(--cyan-primary)] font-semibold border border-[var(--border-cyan)] rounded-xl transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-40"
              >
                {externalLoading ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin" />
                    <span>옵시디언 볼트 변환 및 시냅스 그래프 연결 중...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>옵시디언 볼트 변환 및 시냅스 그래프 연결하기</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Form & Stats Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: General Ingest Form */}
            <div className="lg:col-span-6 p-6 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-panel-solid)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-3">
                <h3 className="font-semibold text-[var(--text-heading)] flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-[var(--gold-primary)]" />
                  새로운 단독 검증 팩트 주입 (Direct Vector Ingest)
                </h3>
                <span className="intel-label bg-[rgba(var(--gold-rgb),0.12)] text-[var(--gold-light)] px-2 py-0.5 rounded">
                  즉시 벡터화
                </span>
              </div>

              {ingestStatusMsg && (
                <div className={`p-3 rounded-xl border intel-meta flex items-center gap-2 ${
                  ingestStatusMsg.type === 'success' 
                    ? 'bg-[rgba(0,230,118,0.1)] border-[rgba(0,230,118,0.3)] text-[var(--alert-green)]' 
                    : 'bg-[rgba(255,82,82,0.1)] border-[rgba(255,82,82,0.3)] text-[var(--alert-red)]'
                }`}>
                  {ingestStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
                  <span>{ingestStatusMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleIngestSubmit} className="space-y-4">
                <div>
                  <label className="block intel-label text-[var(--text-secondary)] mb-1">문서 제목 / 시설명</label>
                  <input
                    type="text"
                    required
                    value={ingestForm.title}
                    onChange={e => setIngestForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 서해 신규 부표 14호 군사 감시 레이더 제원"
                    className="w-full bg-[var(--bg-void)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block intel-label text-[var(--text-secondary)] mb-1">카테고리</label>
                    <select
                      value={ingestForm.category}
                      onChange={e => setIngestForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-[var(--bg-void)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                    >
                      <option value="china_encroachment_spec">중국 서해 침탈 제원 (china_encroachment_spec)</option>
                      <option value="china_encroachment_imagery">위성 영상 판독 (china_encroachment_imagery)</option>
                      <option value="china_encroachment_dialectic">소크라테스 반론 검증 (china_encroachment_dialectic)</option>
                      <option value="strategic_base">전략 거점 시설 (strategic_base)</option>
                      <option value="naval_threat">해상 전력 위협 (naval_threat)</option>
                      <option value="user_verified_intel">사용자 검증 인텔 (user_verified_intel)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block intel-label text-[var(--text-secondary)] mb-1">출처 기관</label>
                    <input
                      type="text"
                      required
                      value={ingestForm.source_org}
                      onChange={e => setIngestForm(prev => ({ ...prev, source_org: e.target.value }))}
                      placeholder="예: 해군본부, CSIS, 사용자 검증단"
                      className="w-full bg-[var(--bg-void)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block intel-label text-[var(--text-secondary)] mb-1">출처 URL / 문서 번호</label>
                  <input
                    type="text"
                    value={ingestForm.source_url}
                    onChange={e => setIngestForm(prev => ({ ...prev, source_url: e.target.value }))}
                    placeholder="https://osiris.tactical/verified"
                    className="w-full bg-[var(--bg-void)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                  />
                </div>

                <div>
                  <label className="block intel-label text-[var(--text-secondary)] mb-1">물리적 실재성 검증 본문 (Ground Truth Text)</label>
                  <textarea
                    required
                    rows={4}
                    value={ingestForm.content}
                    onChange={e => setIngestForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="[관측 사실] 35°00'N 124°30'E 위치에 직경 3m 황색 원형 부표 확인. 태양광 패널 4기 및 수중 음향 소나(Sonar) 장착. [물리 제원] 수심 74m 해저 케이블 연결 확인. 2026-09-12 14:00 위성 AIS 일치."
                    className="w-full bg-[var(--bg-void)] border border-[var(--border-primary)] rounded-lg p-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={ingestLoading || !ingestForm.title.trim() || !ingestForm.content.trim()}
                  className="w-full py-2.5 px-4 bg-[rgba(var(--gold-rgb),0.2)] hover:bg-[rgba(var(--gold-rgb),0.35)] text-[var(--gold-primary)] font-semibold border border-[var(--border-active)] rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 text-sm"
                >
                  {ingestLoading ? (
                    <>
                      <Cpu className="w-4 h-4 animate-spin" />
                      <span>nomic-embed-text 벡터화 및 저장 중...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span>지식 벡터화 & 실시간 RAG 반영하기</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right: Recently Ingested Documents */}
            <div className="lg:col-span-6 p-6 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-panel-solid)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-3">
                <h3 className="font-semibold text-[var(--text-heading)] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[var(--cyan-primary)]" />
                  최근 인덱싱된 실재성 검증 지식 ({ingestStats?.recentDocuments?.length ?? 0}건 표시)
                </h3>
                <button
                  onClick={fetchIngestStats}
                  className="p-1 hover:bg-[var(--hover-accent)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  title="새로고침"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Category distribution badges */}
              {ingestStats?.categories && (
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {Object.entries(ingestStats.categories).map(([cat, count]) => (
                    <span key={cat} className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-void)] border border-[var(--border-secondary)] text-[var(--text-secondary)]">
                      {cat}: <strong className="text-[var(--gold-light)]">{count}</strong>
                    </span>
                  ))}
                </div>
              )}

              {/* Document items list */}
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {ingestStats?.recentDocuments && ingestStats.recentDocuments.length > 0 ? (
                  ingestStats.recentDocuments.map(doc => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-void)]/70 hover:border-[var(--border-active)] transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="intel-label text-[10px] bg-[rgba(var(--cyan-rgb),0.1)] text-[var(--cyan-primary)] px-1.5 py-0.5 rounded border border-[rgba(var(--cyan-rgb),0.2)]">
                            {doc.category}
                          </span>
                          <h4 className="font-semibold text-sm text-[var(--text-heading)] mt-1">
                            {doc.title}
                          </h4>
                        </div>
                        <button
                          onClick={() => {
                            setMainTab('chat');
                            executePrompt(`${doc.title}에 대해 소크라테스 4단계 하네스로 검증해줘.`);
                          }}
                          className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-[rgba(var(--gold-rgb),0.12)] hover:bg-[rgba(var(--gold-rgb),0.25)] text-[var(--gold-primary)] border border-[var(--border-active)] transition-colors"
                          title="이 지식으로 AI 대화 시작"
                        >
                          대화하기 <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="intel-meta text-[var(--text-secondary)] line-clamp-2">
                        {doc.contentPreview}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-secondary)]">
                        <span>출처: {doc.metadata?.source_org || '전술 검증단'}</span>
                        <span>{doc.metadata?.date || '2026-09-12'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-[var(--text-muted)] intel-meta">
                    문서를 불러오는 중입니다...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Preset System Prompt Selection Strip */}
          <div className="flex items-center gap-2 px-6 py-2 bg-[var(--bg-secondary)]/60 border-b border-[var(--border-secondary)] overflow-x-auto">
            <span className="intel-label shrink-0 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5" /> 페르소나:
            </span>
            {SYSTEM_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => setActivePreset(preset)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all shrink-0 intel-meta ${
                  activePreset.id === preset.id
                    ? 'bg-[rgba(var(--gold-rgb),0.14)] border-[var(--border-active)] text-[var(--gold-light)]'
                    : 'bg-[var(--bg-panel-solid)] border-[var(--border-secondary)] text-[var(--text-muted)] hover:bg-[var(--hover-accent)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-[rgba(var(--gold-rgb),0.18)] border border-[var(--border-active)] flex items-center justify-center text-[var(--gold-primary)] shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Reasoning / Thinking Accordion */}
                  {msg.reasoning && (
                    <div className="glass-panel-sm overflow-hidden">
                      <button
                        onClick={() => toggleReasoning(msg.id)}
                        className="w-full px-3 py-1.5 bg-[var(--bg-panel-solid)] flex items-center justify-between intel-label hover:text-[var(--text-secondary)] transition-colors border-b border-[var(--border-secondary)]"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
                          추론 / Thinking 과정
                        </span>
                        {expandedReasoning[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {expandedReasoning[msg.id] && (
                        <div className="p-3 intel-body bg-[var(--bg-void)]/60 border-t border-[var(--border-secondary)]">
                          <ProseBlocks text={msg.reasoning} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Content Box */}
                  <div
                    className={`p-4 rounded-2xl shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-[rgba(var(--cyan-rgb),0.14)] border border-[var(--border-cyan)] text-[var(--text-heading)] rounded-br-none'
                        : 'bg-[var(--bg-panel-solid)] border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-bl-none'
                    }`}
                  >
                    <div>
                      {msg.content.includes('![') ? (
                        (() => {
                          const regex = /!\[(.*?)\]\((.*?)\)/g;
                          const parts: React.ReactNode[] = [];
                          let lastIndex = 0;
                          let match;
                          while ((match = regex.exec(msg.content)) !== null) {
                            if (match.index > lastIndex) {
                              parts.push(<ProseBlocks key={`t-${lastIndex}`} text={msg.content.substring(lastIndex, match.index)} />);
                            }
                            const alt = match[1];
                            const src = match[2];
                            parts.push(
                              <div key={match.index} className="my-3 max-w-sm rounded-xl overflow-hidden border border-[var(--border-active)] bg-[var(--bg-void)] p-2 shadow-lg">
                                <img src={src} alt={alt} className="w-full h-auto rounded-lg object-contain hover:scale-105 transition-transform" />
                                <div className="mt-1.5 intel-label text-center text-[var(--gold-primary)]">{alt}</div>
                              </div>
                            );
                            lastIndex = match.index + match[0].length;
                          }
                          if (lastIndex < msg.content.length) {
                            parts.push(<ProseBlocks key={`t-${lastIndex}`} text={msg.content.substring(lastIndex)} />);
                          }
                          return parts;
                        })()
                      ) : (
                        <ProseBlocks text={msg.content} className={msg.role === 'user' ? 'text-[var(--text-heading)]' : ''} />
                      )}
                    </div>

                    {/* Footer Metadata & TTS Button */}
                    <div className="flex items-center justify-between gap-4 mt-3 pt-2 border-t border-[var(--border-secondary)] intel-meta">
                      <span>{msg.timestamp}</span>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-3">
                          {msg.timings && (
                            <span>
                              {msg.timings.predicted_per_second ? `${msg.timings.predicted_per_second} t/s` : ''}
                            </span>
                          )}

                          {/* Ultra-HD SOTA Neural TTS Audio Briefing */}
                          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-solid)] px-2 py-0.5 rounded-md border border-[var(--border-primary)]">
                            <select
                              value={selectedTtsVoice}
                              onChange={(e) => setSelectedTtsVoice(e.target.value as any)}
                              className="bg-transparent text-[11px] text-[var(--gold-primary)] font-medium outline-none cursor-pointer"
                              title="신경망 음성 선택"
                            >
                              <option value="ko-KR-SunHiNeural" className="bg-[#0b0f19] text-white">선희 (여성 아나운서)</option>
                              <option value="ko-KR-InJoonNeural" className="bg-[#0b0f19] text-white">인준 (남성 전술분석)</option>
                            </select>

                            <button
                              onClick={() => handleSpeakMessage(msg.id, msg.content)}
                              className={`hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 text-xs ${
                                speakingMsgId === msg.id ? 'text-[var(--alert-green)] font-bold animate-pulse' : 'text-[var(--text-secondary)]'
                              }`}
                              title={speakingMsgId === msg.id ? '음성 중지' : '인간 수준 초고음질 신경망 브리핑 청취'}
                            >
                              {speakingMsgId === msg.id ? (
                                <>
                                  <VolumeX className="w-3.5 h-3.5 text-[var(--alert-red)]" />
                                  <span className="text-[var(--alert-red)]">중지</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                                  <span>신경망 브리핑</span>
                                </>
                              )}
                            </button>
                          </div>

                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
                            title="복사"
                          >
                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-[var(--alert-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-cyan)] flex items-center justify-center text-[var(--cyan-primary)] shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {chatRag && chatRag.assertiveAllowed === false && (
              <div className="mx-4 mb-2 rounded-md border border-[var(--border-secondary)] bg-[var(--bg-panel)] px-3 py-2 intel-meta text-[var(--text-muted)]">
                관측/출처 없음 · 단정·고confidence 표시 안 함
              </div>
            )}
            {chatRag && chatRag.assertiveAllowed === true && chatRag.citations.length > 0 && (
              <div className="mx-4 mb-2 flex flex-wrap gap-1.5">
                {chatRag.citations.slice(0, 3).map((c, i) => (
                  <span key={c.id || i} className="rounded bg-[rgba(0,230,118,0.08)] border border-[rgba(0,230,118,0.28)] px-2 py-0.5 intel-label text-[var(--alert-green)] truncate max-w-[18rem]" title={c.title || ''}>
                    RAG · {c.title || c.id || 'citation'}
                  </span>
                ))}
              </div>
            )}
            {loading && (
              <div className="flex flex-col gap-2 intel-meta glass-panel-sm p-4 w-fit min-w-[240px]">
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-[var(--gold-primary)] animate-spin" />
                  <span>소크라테스 4단계 하네스 추론 중... {Math.max(0, Math.round(streamElapsedMs / 1000))}s</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div className="h-full w-1/3 rounded-full bg-[var(--gold-primary)] animate-pulse" />
                </div>
                {timeoutSoon && (
                  <button type="button" onClick={() => handleSubmit()} className="text-[var(--alert-orange)] hover:text-[var(--gold-light)] underline text-left">
                    재시도
                  </button>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Verification Chips */}
          <div className="flex items-center gap-2 px-6 py-2 bg-[var(--bg-void)]/80 border-t border-[var(--border-secondary)] overflow-x-auto">
            <span className="intel-label shrink-0 text-[var(--gold-primary)] flex items-center gap-1 text-xs">
              <Sparkles className="w-3.5 h-3.5" /> 검증 팩트 질문:
            </span>
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => executePrompt(qp.text)}
                disabled={loading}
                className="shrink-0 px-2.5 py-1 rounded-md text-xs bg-[var(--bg-panel)] hover:bg-[rgba(var(--gold-rgb),0.15)] border border-[var(--border-secondary)] hover:border-[var(--border-active)] text-[var(--text-secondary)] hover:text-[var(--gold-light)] transition-all disabled:opacity-40"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Message Input Area */}
          <form onSubmit={handleSubmit} className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border-primary)]">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`${activePreset.name}에게 무엇이든 물어보세요... (소크라테스 4단계 실재성 검증)`}
                disabled={loading}
                className="w-full bg-[var(--bg-void)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-3.5 pr-12 intel-body focus:outline-none focus:border-[var(--border-active)] transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2.5 p-2 bg-[rgba(var(--gold-rgb),0.25)] hover:bg-[rgba(var(--gold-rgb),0.4)] text-[var(--gold-primary)] border border-[var(--border-active)] rounded-lg transition-colors disabled:opacity-40 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
