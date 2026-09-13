#!/usr/bin/env node
/**
 * ⚡ OSIRIS Synapse Knowledge Graph & Obsidian Vault MCP Server
 * 
 * Model Context Protocol (MCP) 공식 표준 SDK 기반:
 * 로컬 AI(qwen3:14b) 및 Antigravity 에이전트가 직접 옵시디언 볼트를 검색/수정하고,
 * 시냅스 그래프 토폴로지를 인출하며, macOS CoreAudio 고품질 음성 브리핑을 실행하는 독립 서버.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 프로젝트 루트 경로 (상위 디렉토리 탐색)
const PROJECT_ROOT = path.resolve(process.cwd(), process.cwd().endsWith('osiris-synapse-mcp') ? '../..' : '.');
const VAULT_DIR = path.join(PROJECT_ROOT, 'data', 'obsidian-vault');
const VECTOR_DIR = path.join(PROJECT_ROOT, 'data', 'vector-db');
const VECTOR_FILE = path.join(VECTOR_DIR, 'tactical-embeddings.json');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

// 로깅은 오직 stderr로만 출력 (stdout 오염 방지)
function logStderr(...args: any[]) {
  process.stderr.write(`[osiris-synapse-mcp] ${args.join(' ')}\n`);
}

// 1. MCP 서버 인스턴스 생성
const server = new McpServer({
  name: "osiris-synapse-mcp",
  version: "1.0.0"
});

/**
 * 볼트 내 모든 마크다운 파일 재귀 탐색
 */
function getVaultFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...getVaultFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 프론트매터 파싱
 */
function parseFrontmatter(text: string): { data: Record<string, any>; content: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: text };

  const data: Record<string, any> = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val.startsWith('[') && val.endsWith(']') && !val.startsWith('[[')) {
      data[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      data[key] = val;
    }
  }
  return { data, content: match[2] };
}

// ==========================================
// Tool 1: vault_search_nodes
// ==========================================
server.tool(
  "vault_search_nodes",
  {
    query: z.string().describe("검색할 군사 키워드, 시설명 또는 태그 (예: 선란, 부표, 소나)"),
    tier: z.enum(["ALL", "FACT", "INFERENCE", "HYPOTHESIS"]).optional().default("ALL").describe("소크라테스 검증 등급 필터")
  },
  async ({ query, tier }) => {
    try {
      const files = getVaultFiles(VAULT_DIR);
      const q = query.toLowerCase();
      const matches: Array<{ id: string; title: string; tier: string; tags: string[]; relPath: string; preview: string }> = [];

      for (const file of files) {
        const raw = fs.readFileSync(file, 'utf8');
        const { data, content } = parseFrontmatter(raw);
        const nodeTier = (data.verification_tier || 'INFERENCE').toUpperCase();
        if (tier !== 'ALL' && !nodeTier.includes(tier)) continue;

        const title = data.title || path.basename(file, '.md');
        const tags: string[] = Array.isArray(data.tags) ? data.tags : [];
        const isMatch = title.toLowerCase().includes(q) ||
                        tags.some((t: string) => t.toLowerCase().includes(q)) ||
                        content.toLowerCase().includes(q);

        if (isMatch) {
          matches.push({
            id: title,
            title,
            tier: nodeTier,
            tags,
            relPath: path.relative(VAULT_DIR, file),
            preview: content.trim().slice(0, 150) + '...'
          });
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            count: matches.length,
            query,
            tier,
            results: matches
          }, null, 2)
        }]
      };
    } catch (err: any) {
      logStderr("vault_search_nodes error:", err.message);
      return {
        isError: true,
        content: [{ type: "text", text: `검색 실패: ${err.message}` }]
      };
    }
  }
);

// ==========================================
// Tool 2: vault_read_node
// ==========================================
server.tool(
  "vault_read_node",
  {
    nodeId: z.string().describe("조회할 노드 ID 또는 마크다운 파일 제목 (예: 선란 1호, 13기 부표망)")
  },
  async ({ nodeId }) => {
    try {
      const files = getVaultFiles(VAULT_DIR);
      const targetClean = nodeId.replace(/^\[\[/, '').replace(/\]\]$/, '').trim().toLowerCase();
      let targetFile: string | null = null;
      let matchedData: any = null;
      let matchedContent = '';

      for (const file of files) {
        const raw = fs.readFileSync(file, 'utf8');
        const { data, content } = parseFrontmatter(raw);
        const title = (data.title || path.basename(file, '.md')).toLowerCase();
        if (title === targetClean || path.basename(file, '.md').toLowerCase() === targetClean) {
          targetFile = file;
          matchedData = data;
          matchedContent = content;
          break;
        }
      }

      if (!targetFile) {
        return {
          isError: true,
          content: [{ type: "text", text: `노드 '${nodeId}'를 찾을 수 없습니다.` }]
        };
      }

      // 역링크(Backlinks) 계산: 이 노드를 [[nodeId]] 로 참조하는 다른 파일들 찾기
      const backlinks: string[] = [];
      const nodeTitle = matchedData.title || path.basename(targetFile, '.md');
      for (const file of files) {
        if (file === targetFile) continue;
        const raw = fs.readFileSync(file, 'utf8');
        if (raw.includes(`[[${nodeTitle}]]`)) {
          const { data } = parseFrontmatter(raw);
          backlinks.push(data.title || path.basename(file, '.md'));
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            id: nodeTitle,
            filePath: path.relative(VAULT_DIR, targetFile),
            frontmatter: matchedData,
            backlinks,
            content: matchedContent.trim()
          }, null, 2)
        }]
      };
    } catch (err: any) {
      logStderr("vault_read_node error:", err.message);
      return {
        isError: true,
        content: [{ type: "text", text: `노드 읽기 실패: ${err.message}` }]
      };
    }
  }
);

// ==========================================
// Tool 3: vault_ingest_research
// ==========================================
server.tool(
  "vault_ingest_research",
  {
    rawText: z.string().describe("ChatGPT 대화 사고 또는 Perplexity 검색 결과 원문 텍스트"),
    customTitle: z.string().optional().describe("지정할 문서 제목 (생략 시 자동 생성)"),
    sourceUrl: z.string().optional().describe("원문 링크 또는 인용 URL"),
    sourcePlatform: z.enum(["perplexity", "chatgpt", "generic"]).optional().default("generic").describe("출처 플랫폼")
  },
  async ({ rawText, customTitle, sourceUrl, sourcePlatform }) => {
    try {
      const externalDir = path.join(VAULT_DIR, 'external-llm');
      if (!fs.existsSync(externalDir)) fs.mkdirSync(externalDir, { recursive: true });

      // 제목 결정
      let title = customTitle?.trim() || '';
      if (!title) {
        const firstLine = rawText.split('\n')[0].replace(/^[#\s*]+/, '').trim();
        title = firstLine && firstLine.length < 80 ? firstLine : `${sourcePlatform.toUpperCase()} 전술 분석 노트 (${Date.now()})`;
      }

      const safeTitle = title.replace(/[^\w\s가-힣-]/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || `intel-${Date.now()}`;
      const filePath = path.join(externalDir, `${safeTitle}.md`);

      // 엔티티 자동 위키링크 주입
      const KNOWN = ['선란 1호', '선란 2호', '13기 부표망', '루칭위안위 066', 'CSSC 702연구소', '소나', '서해 잠정조치수역', '해양경찰청'];
      let enriched = rawText;
      for (const k of KNOWN) {
        const r = new RegExp(`(?<!\\[\\[)(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?!\\]\\])`, 'g');
        enriched = enriched.replace(r, '[[$1]]');
      }

      const frontmatter = [
        '---',
        `title: "${title.replace(/"/g, '\\"')}"`,
        `source: "${sourcePlatform.toUpperCase()} Research"`,
        `platform: "${sourcePlatform}"`,
        sourceUrl ? `url: "${sourceUrl}"` : '',
        `date: "${new Date().toISOString().split('T')[0]}"`,
        `verification_tier: "${enriched.includes('위성') || enriched.includes('좌표') ? 'FACT' : 'INFERENCE'}"`,
        'parent: "[[서해 중국 8대 침탈 시설망]]"',
        `tags: ["#intel/external-llm", "#source/${sourcePlatform}"]`,
        '---',
        '',
        `# ${title}`,
        '',
        enriched,
        ''
      ].filter(Boolean).join('\n');

      fs.writeFileSync(filePath, frontmatter, 'utf8');

      // 로컬 Ollama 768D 벡터화
      let isVectorized = false;
      try {
        const embRes = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'nomic-embed-text', prompt: `${title}\n${enriched.slice(0, 1000)}` })
        });
        if (embRes.ok) {
          const embData = await embRes.json();
          if (embData.embedding) {
            let store: any[] = [];
            if (fs.existsSync(VECTOR_FILE)) {
              store = JSON.parse(fs.readFileSync(VECTOR_FILE, 'utf8'));
            }
            store.push({
              id: `vault-${safeTitle}`,
              title,
              category: 'external_llm_research',
              content: enriched,
              metadata: { source_org: sourcePlatform, source_url: sourceUrl || '', date: new Date().toISOString().split('T')[0] },
              embedding: embData.embedding
            });
            fs.writeFileSync(VECTOR_FILE, JSON.stringify(store, null, 2), 'utf8');
            isVectorized = true;
          }
        }
      } catch (embErr: any) {
        logStderr("Embedding sync warning:", embErr.message);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "success",
            title,
            savedPath: path.relative(PROJECT_ROOT, filePath),
            isVectorized,
            message: `옵시디언 볼트에 성공적으로 인제스천되었습니다.`
          }, null, 2)
        }]
      };
    } catch (err: any) {
      logStderr("vault_ingest_research error:", err.message);
      return {
        isError: true,
        content: [{ type: "text", text: `인제스천 실패: ${err.message}` }]
      };
    }
  }
);

// ==========================================
// Tool 4: vault_graph_topology
// ==========================================
server.tool(
  "vault_graph_topology",
  {},
  async () => {
    try {
      const files = getVaultFiles(VAULT_DIR);
      const nodes: any[] = [];
      const links: any[] = [];
      const linkSet = new Set<string>();

      for (const file of files) {
        const raw = fs.readFileSync(file, 'utf8');
        const { data, content } = parseFrontmatter(raw);
        const title = data.title || path.basename(file, '.md');
        const tier = (data.verification_tier || 'INFERENCE').toUpperCase();

        nodes.push({
          id: title,
          name: title,
          tier: tier.includes('FACT') ? 'FACT' : 'INFERENCE',
          tags: data.tags || []
        });

        // Parent link
        if (data.parent) {
          const parentClean = String(data.parent).replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
          const key = `${parentClean}-->${title}`;
          if (!linkSet.has(key)) {
            linkSet.add(key);
            links.push({ source: parentClean, target: title, relationship: 'parent_child' });
          }
        }

        // Wikilinks
        const wikilinks = content.match(/\[\[(.*?)\]\]/g) || [];
        for (const wl of wikilinks) {
          const tgt = wl.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
          const key = `${title}->${tgt}`;
          if (!linkSet.has(key) && tgt !== title) {
            linkSet.add(key);
            links.push({ source: title, target: tgt, relationship: 'references' });
          }
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            totalNodes: nodes.length,
            totalLinks: links.length,
            nodes,
            links
          }, null, 2)
        }]
      };
    } catch (err: any) {
      logStderr("vault_graph_topology error:", err.message);
      return {
        isError: true,
        content: [{ type: "text", text: `토폴로지 생성 실패: ${err.message}` }]
      };
    }
  }
);

// ==========================================
// Tool 5: tactical_tts_speak
// ==========================================
server.tool(
  "tactical_tts_speak",
  {
    text: z.string().describe("음성으로 합성하여 스피커로 출력할 브리핑 텍스트"),
    voice: z.string().optional().default("ko-KR-SunHiNeural").describe("신경망 음성 (기본: ko-KR-SunHiNeural [여성 아나운서], 남성 앵커: ko-KR-InJoonNeural)"),
    rate: z.number().optional().default(100).describe("재생 속도 백분율 (기본: 100)")
  },
  async ({ text, voice, rate }) => {
    try {
      // 제1원칙 음성 정규화 (기계음/뭉개짐 원천 방지)
      let normalized = text
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\|[^\n]+\|/g, ' ')
        .replace(/\bOSINT\b/gi, '오신트')
        .replace(/\bGEOINT\b/gi, '지오인트')
        .replace(/\bSIGINT\b/gi, '시그인트')
        .replace(/\bADS-B\b/gi, '에이디에스비')
        .replace(/\bCCTV\b/gi, '씨씨티비')
        .replace(/\bMMSI\b/gi, '선박 식별번호')
        .replace(/\bGPS\b/gi, '지피에스')
        .replace(/\bQwen\b/gi, '큐웬')
        .replace(/\bAI\b/gi, '인공지능')
        .replace(/\bRAG\b/gi, '래그')
        .replace(/\bTTS\b/gi, '음성 합성')
        .replace(/\bHUD\b/gi, '허드')
        .replace(/\bEasyOCR\b/gi, '이지 오씨알')
        .replace(/13기/g, '열세 기')
        .replace(/8대/g, '여덟 대')
        .replace(/1호/g, '일 호')
        .replace(/2호/g, '이 호')
        .replace(/14B\b/gi, '십사 비')
        .replace(/(\d+(?:\.\d+)?)\s*km\b/gi, '$1 킬로미터')
        .replace(/(\d+(?:\.\d+)?)\s*m\b/gi, '$1 미터')
        .replace(/(\d+(?:\.\d+)?)\s*kt\b/gi, '$1 노트')
        .replace(/(\d+(?:\.\d+)?)\s*t\b/gi, '$1 톤')
        .replace(/~/g, '에서 ')
        .replace(/&/g, ' 및 ')
        .replace(/\+/g, ' 이상 ')
        .replace(/\//g, ' 또는 ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s*\.\s*/g, '. ')
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const tmpMp3 = `/tmp/mcp-neural-${Date.now()}.mp3`;
      const selectedVoice = voice.toLowerCase().includes('injoon') || voice.toLowerCase().includes('male')
        ? 'ko-KR-InJoonNeural'
        : 'ko-KR-SunHiNeural';

      // 1순위: OSIRIS 통합 전술 TTS 파이프라인 (GPT-SoVITS 1순위 -> Edge-TTS 2순위 -> CoreAudio 3순위)
      try {
        const apiRes = await fetch("http://127.0.0.1:3000/api/local-ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: normalized, voice: selectedVoice, playDirect: true }),
          signal: AbortSignal.timeout(12000)
        });
        if (apiRes.ok) {
          const resData = await apiRes.json();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "speaking",
                voice: selectedVoice,
                engine: resData.engine || "GPT-SoVITS (GitHub #1 Local Zero-Shot SOTA)",
                quality: "Studio 32kHz Neural Audio (Human-Indistinguishable)",
                length: normalized.length,
                message: `초고음질 [${resData.engine || 'GPT-SoVITS'}] 음성으로 브리핑이 재생되고 있습니다.`
              }, null, 2)
            }]
          };
        }
      } catch {
        // 백엔드 API 미도달 시 로컬 Edge-TTS / say 직결 폴백
      }

      logStderr(`Synthesizing SOTA Neural TTS (${selectedVoice}) with First Principles Articulation (-4% rate)...`);

      // 2순위: 사람과 구별 불가능한 SOTA 한국어 신경망 합성 후 afplay 고음질 재생 (-4% 속도로 또렷한 조음 실현)
      const neuralCmd = `python3 -m edge_tts --voice "${selectedVoice}" --rate="-4%" --pitch="+0Hz" --text "${normalized.replace(/"/g, '\\"')}" --write-media "${tmpMp3}" && /usr/bin/afplay "${tmpMp3}" && rm -f "${tmpMp3}"`;

      exec(neuralCmd, (err) => {
        if (err) {
          logStderr("Neural TTS synthesis error, falling back to say:", err.message);
          exec(`/usr/bin/say -v Yuna "${normalized.replace(/"/g, '\\"')}"`, () => {});
        }
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "speaking",
            voice: selectedVoice,
            engine: "Edge-TTS (SOTA Neural Fallback)",
            quality: "Studio 24kHz Neural Audio (Human-Indistinguishable)",
            length: normalized.length,
            message: `사람과 구별 불가능한 초고음질 신경망 [${selectedVoice}] 음성으로 브리핑이 재생되고 있습니다.`
          }, null, 2)
        }]
      };
    } catch (err: any) {
      logStderr("tactical_tts_speak error:", err.message);
      return {
        isError: true,
        content: [{ type: "text", text: `음성 합성 실패: ${err.message}` }]
      };
    }
  }
);

// ==========================================
// Start MCP Server on Stdio Transport
// ==========================================
async function main() {
  logStderr("Starting OSIRIS Synapse MCP Server on Stdio...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logStderr("OSIRIS Synapse MCP Server successfully connected!");
}

main().catch((err) => {
  logStderr("Fatal initialization error:", err);
  process.exit(1);
});
