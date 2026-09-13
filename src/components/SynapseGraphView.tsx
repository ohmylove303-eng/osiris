'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { 
  Network, Search, Filter, Sparkles, Volume2, VolumeX, MessageSquare, 
  ChevronRight, ExternalLink, RefreshCw, Layers, ShieldCheck, X, Compass, Tag
} from 'lucide-react';
import { SynapseNode, SynapseLink, SynapseGraphData } from '@/lib/synapse-graph-engine';
import { TacticalSpeechController } from '@/lib/tts-engine';

// SSR 방지를 위한 ForceGraph2D 동적 로드
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface SynapseGraphViewProps {
  onChatWithNode?: (prompt: string) => void;
}

export default function SynapseGraphView({ onChatWithNode }: SynapseGraphViewProps) {
  const [graphData, setGraphData] = useState<SynapseGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<SynapseNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'FACT' | 'INFERENCE' | 'HYPOTHESIS' | 'FALSE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'domain' | 'facility' | 'intel_note'>('ALL');

  // TTS 컨트롤러
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechControllerRef = useRef<TacticalSpeechController | null>(null);
  const graphRef = useRef<any>(null);

  useEffect(() => {
    speechControllerRef.current = new TacticalSpeechController((state) => {
      setIsSpeaking(state.isPlaying && !state.isPaused);
    });
    fetchGraph();

    return () => {
      speechControllerRef.current?.stop();
    };
  }, []);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/synapse/graph');
      if (res.ok) {
        const json = await res.json();
        setGraphData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch synapse graph:', err);
    } finally {
      setLoading(false);
    }
  };

  // 필터링된 노드 및 링크 계산
  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };

    const nodes = graphData.nodes.filter(node => {
      if (tierFilter !== 'ALL' && node.tier !== tierFilter) return false;
      if (typeFilter !== 'ALL' && node.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = node.name.toLowerCase().includes(q);
        const matchTag = node.tags.some(t => t.toLowerCase().includes(q));
        const matchContent = node.content.toLowerCase().includes(q);
        if (!matchName && !matchTag && !matchContent) return false;
      }
      return true;
    });

    const activeNodeIds = new Set(nodes.map(n => n.id));
    const links = graphData.links.filter(link => {
      const srcId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tgtId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      return activeNodeIds.has(srcId) && activeNodeIds.has(tgtId);
    });

    return { nodes, links };
  }, [graphData, tierFilter, typeFilter, searchQuery]);

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
    if (speechControllerRef.current?.isSpeaking()) {
      speechControllerRef.current.stop();
    }
  };

  const handleSpeak = (text: string) => {
    if (!speechControllerRef.current) return;
    if (isSpeaking) {
      speechControllerRef.current.stop();
    } else {
      speechControllerRef.current.speak(text, 1.05);
    }
  };

  const getNodeColor = (tier: string) => {
    switch (tier) {
      case 'FACT': return '#00E676'; // Emerald Green
      case 'INFERENCE': return '#FFD54F'; // Gold/Amber
      case 'HYPOTHESIS': return '#00E5FF'; // Cyan
      case 'FALSE': return '#FF5252'; // Red
      default: return '#81D4FA';
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-[var(--bg-void)] overflow-hidden font-[family-name:var(--font-body)]">
      {/* Top Filter & HUD Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-[var(--bg-panel)] border-b border-[var(--border-primary)] z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[rgba(var(--cyan-rgb),0.12)] border border-[var(--border-cyan)] rounded-xl text-[var(--cyan-primary)]">
            <Network className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-[var(--text-heading)]">시냅스 지식 그래프 (Synapse Graph)</h3>
              <span className="intel-label bg-[rgba(var(--gold-rgb),0.15)] text-[var(--gold-light)] px-2 py-0.5 rounded text-[11px]">
                {graphData?.stats.totalNodes ?? 0} 노드 · {graphData?.stats.totalLinks ?? 0} 시냅스 엣지
              </span>
            </div>
            <p className="intel-meta text-[var(--text-muted)] text-[11px] mt-0.5">
              옵시디언 마크다운 볼트(wikilinks) 및 소크라테스 검증 상태 실시간 2D 토폴로지
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="노드 또는 태그 검색..."
              className="bg-[var(--bg-void)] border border-[var(--border-secondary)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] w-40 md:w-52"
            />
          </div>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value as any)}
            className="bg-[var(--bg-void)] border border-[var(--border-secondary)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none"
          >
            <option value="ALL">모든 등급</option>
            <option value="FACT">FACT (공인 팩트)</option>
            <option value="INFERENCE">INFERENCE (판단 추론)</option>
            <option value="HYPOTHESIS">HYPOTHESIS (가설)</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="bg-[var(--bg-void)] border border-[var(--border-secondary)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none"
          >
            <option value="ALL">모든 유형</option>
            <option value="domain">상위 도메인 (domain)</option>
            <option value="facility">전술 시설 (facility)</option>
            <option value="intel_note">외부 LLM 노트 (intel_note)</option>
          </select>

          <button
            onClick={fetchGraph}
            className="p-1.5 hover:bg-[var(--hover-accent)] rounded-lg border border-[var(--border-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="그래프 새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Force Graph Canvas */}
      <div className="relative flex-1 bg-[var(--bg-void)] overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 intel-meta text-[var(--text-muted)]">
            <Network className="w-8 h-8 text-[var(--cyan-primary)] animate-spin" />
            <span>옵시디언 마크다운 볼트 시냅스 분석 중...</span>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredData}
            backgroundColor="#07090e"
            nodeRelSize={4}
            nodeVal={(node: any) => node.val || 3}
            nodeLabel={(node: any) => `${node.name} [${node.tier}]`}
            nodeColor={(node: any) => getNodeColor(node.tier)}
            linkColor={() => 'rgba(255, 215, 79, 0.22)'}
            linkWidth={(link: any) => link.value || 1}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => '#00E5FF'}
            onNodeClick={handleNodeClick}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const fontSize = Math.max(10 / globalScale, 3.5);
              const nodeR = Math.sqrt(Math.max(0, node.val || 3)) * 2.8;
              const color = getNodeColor(node.tier);

              // 1. Glowing outer ring halo
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeR + 2.5, 0, 2 * Math.PI, false);
              ctx.fillStyle = `${color}22`;
              ctx.fill();

              // 2. Core circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI, false);
              ctx.fillStyle = color;
              ctx.fill();

              // 3. Label text
              ctx.font = `${fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(label, node.x, node.y + nodeR + fontSize);
            }}
          />
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 p-3 bg-[var(--bg-panel-solid)]/90 backdrop-blur-md border border-[var(--border-secondary)] rounded-xl intel-meta space-y-1.5 shadow-lg">
          <div className="text-xs font-semibold text-[var(--text-heading)] mb-1">소크라테스 검증 범례</div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E676]" />
            <span className="text-[var(--text-secondary)]">FACT (공인 관측 사실)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFD54F]" />
            <span className="text-[var(--text-secondary)]">INFERENCE (판단 추론)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF]" />
            <span className="text-[var(--text-secondary)]">HYPOTHESIS (검증 가설)</span>
          </div>
        </div>

        {/* Slide-over Note Inspector */}
        {selectedNode && (
          <div className="absolute top-0 right-0 w-full sm:w-[420px] h-full bg-[var(--bg-panel-solid)] border-l border-[var(--border-primary)] shadow-2xl flex flex-col z-20 transition-transform">
            {/* Inspector Header */}
            <div className="p-4 border-b border-[var(--border-secondary)] flex items-start justify-between gap-3 bg-[var(--bg-void)]/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`intel-label px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedNode.tier === 'FACT' 
                      ? 'bg-[rgba(0,230,118,0.15)] text-[var(--alert-green)] border border-[rgba(0,230,118,0.3)]' 
                      : 'bg-[rgba(255,213,79,0.15)] text-[var(--gold-primary)] border border-[rgba(255,213,79,0.3)]'
                  }`}>
                    {selectedNode.tier}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    유형: {selectedNode.type}
                  </span>
                </div>
                <h3 className="font-bold text-base text-[var(--text-heading)] mt-1.5">
                  {selectedNode.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-[var(--hover-accent)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action Bar (Chat & TTS) */}
            <div className="p-3 border-b border-[var(--border-secondary)] flex items-center gap-2 bg-[var(--bg-panel)]">
              {onChatWithNode && (
                <button
                  onClick={() => onChatWithNode(`${selectedNode.name}에 대해 소크라테스 4단계 하네스로 전술 브리핑을 작성해줘.`)}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs bg-[rgba(var(--gold-rgb),0.18)] hover:bg-[rgba(var(--gold-rgb),0.3)] text-[var(--gold-light)] border border-[var(--border-active)] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>AI 대화로 심문하기</span>
                </button>
              )}
              <button
                onClick={() => handleSpeak(selectedNode.content)}
                className={`py-1.5 px-3 rounded-lg text-xs border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  isSpeaking
                    ? 'bg-[rgba(255,82,82,0.2)] border-[rgba(255,82,82,0.4)] text-[var(--alert-red)] animate-pulse'
                    : 'bg-[rgba(var(--cyan-rgb),0.15)] border-[var(--border-cyan)] text-[var(--cyan-primary)] hover:bg-[rgba(var(--cyan-rgb),0.25)]'
                }`}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isSpeaking ? '음성 중지' : '음성 브리핑 (TTS)'}</span>
              </button>
            </div>

            {/* Note Content & Metadata Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Tags & Source */}
              <div className="space-y-1.5 pb-2 border-b border-[var(--border-secondary)]">
                <div className="flex flex-wrap gap-1">
                  {selectedNode.tags.map((tag, i) => (
                    <span key={i} className="intel-label text-[10px] bg-[var(--bg-void)] border border-[var(--border-secondary)] px-1.5 py-0.5 rounded text-[var(--cyan-primary)]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1">
                  <span>출처: {selectedNode.source || 'OSIRIS Vault'}</span>
                  <span>연결 차수: {selectedNode.val.toFixed(1)}</span>
                </div>
              </div>

              {/* Markdown Content */}
              <div className="intel-body text-xs leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap font-sans bg-[var(--bg-void)]/60 p-3 rounded-xl border border-[var(--border-secondary)]">
                {selectedNode.content}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
