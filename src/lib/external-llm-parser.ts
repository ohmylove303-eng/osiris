/**
 * ⚡ OSIRIS External LLM Ingestion Parser
 * 
 * ChatGPT 및 Perplexity에서 연구·검색·사고한 텍스트를 옵시디언 표준 마크다운 볼트로 변환:
 * 1. 플랫폼 자동 판별: Perplexity vs ChatGPT vs Research Note
 * 2. 출처 및 각주([1], [2] 링크) 추출
 * 3. 엔티티 자동 식별 및 [[위키링크]] 변환
 * 4. YAML Frontmatter 생성 및 data/obsidian-vault/ 저장
 * 5. 로컬 nomic-embed-text 768D 벡터화 및 RAG DB 동기화
 */

import fs from 'fs';
import path from 'path';
import { getEmbedding, loadVectorStore, saveVectorStore, VectorDocument } from '@/lib/local-rag-engine';

export interface ParsedLlmDocument {
  title: string;
  sourcePlatform: 'perplexity' | 'chatgpt' | 'generic';
  originalUrl?: string;
  sourceOrg: string;
  category: string;
  tags: string[];
  parentDomain: string;
  verificationTier: 'FACT' | 'INFERENCE' | 'HYPOTHESIS' | 'FALSE';
  contentMarkdown: string;
  citations: Array<{ id: string; title: string; url?: string }>;
  suggestedLinks: string[];
}

export interface IngestExternalResult {
  filePath: string;
  relativeVaultPath: string;
  documentId: string;
  title: string;
  sourcePlatform: string;
  wikilinksCount: number;
  isVectorized: boolean;
}

const KNOWN_TACTICAL_ENTITIES = [
  '서해 잠정조치수역',
  '이어도 해양과학기지',
  'CSSC 702연구소',
  '중국선박중공집단',
  '수중 청음 센서',
  '루칭위안위 066',
  '루칭위안위066',
  '스카버러 암초',
  '13기 부표망',
  '13기 부표',
  '격렬비열도',
  '양자강 하구',
  '해양경찰청',
  '선란 1호',
  '선란 2호',
  '선란1호',
  '선란2호',
  '해군본부',
  '레이더',
  'MAXAR',
  'SOSUS',
  '소나',
  'CSIS',
  'PMZ'
];

/**
 * 텍스트 내에서 핵심 엔티티를 찾아 [[위키링크]]로 감싸기 (이미 링크된 것은 제외)
 */
export function enrichWithWikilinks(text: string): { enrichedText: string; extractedLinks: string[] } {
  let enriched = text;
  const extractedLinks = new Set<string>();

  for (const entity of KNOWN_TACTICAL_ENTITIES) {
    // 이미 [[entity]] 로 감싸져 있지 않은 경우만 변환
    const regex = new RegExp(`(?<!\\[\\[)(${entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?!\\]\\])`, 'g');
    if (regex.test(enriched)) {
      enriched = enriched.replace(regex, '[[$1]]');
      extractedLinks.add(entity);
    }
  }

  // 텍스트 내 기존에 있던 [[...]] 위키링크도 수집
  const existingWikilinks = text.match(/\[\[(.*?)\]\]/g) || [];
  for (const raw of existingWikilinks) {
    const clean = raw.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
    if (clean) extractedLinks.add(clean);
  }

  return {
    enrichedText: enriched,
    extractedLinks: Array.from(extractedLinks)
  };
}

/**
 * ChatGPT / Perplexity 원본 텍스트 파싱
 */
export function parseExternalLlmText(rawInput: string, customTitle?: string, sourceUrl?: string): ParsedLlmDocument {
  const text = rawInput.trim();
  let sourcePlatform: 'perplexity' | 'chatgpt' | 'generic' = 'generic';

  // 플랫폼 감지
  if (text.includes('perplexity.ai') || /Sources?:/i.test(text) || /\[\d+\]\s*https?:\/\//i.test(text)) {
    sourcePlatform = 'perplexity';
  } else if (/ChatGPT/i.test(text) || /Thinking process/i.test(text) || /\b(User|Assistant)\b\s*:/i.test(text)) {
    sourcePlatform = 'chatgpt';
  }

  // 제목 자동 추출
  let title = customTitle?.trim() || '';
  if (!title) {
    const firstLine = text.split('\n')[0].replace(/^[#\s*]+/, '').trim();
    if (firstLine && firstLine.length < 80) {
      title = firstLine;
    } else {
      const matchHeading = text.match(/^#+\s*(.+)$/m);
      if (matchHeading) {
        title = matchHeading[1].trim();
      } else {
        title = `${sourcePlatform === 'perplexity' ? 'Perplexity' : 'ChatGPT'} 검색 분석 (${new Date().toLocaleDateString('ko-KR')})`;
      }
    }
  }

  // 출처 각주 [1] https://... 파싱
  const citations: Array<{ id: string; title: string; url?: string }> = [];
  const citeRegex = /\[(\d+)\]\s*([^:\n]+)?[:\s]*(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = citeRegex.exec(text)) !== null) {
    citations.push({
      id: match[1],
      title: (match[2] || `출처 ${match[1]}`).trim(),
      url: match[3].trim()
    });
  }

  // 엔티티 위키링크 주입
  const { enrichedText, extractedLinks } = enrichWithWikilinks(text);

  // 태그 생성
  const tags = ['#intel/external-llm', `#source/${sourcePlatform}`];
  if (text.includes('선란') || text.includes('부표') || text.includes('서해')) tags.push('#osint/china-westsea');
  if (text.includes('군사') || text.includes('해군') || text.includes('해경')) tags.push('#military/tactical');
  if (text.includes('소나') || text.includes('센서') || text.includes('레이더')) tags.push('#sensor/surveillance');

  return {
    title,
    sourcePlatform,
    originalUrl: sourceUrl || (sourcePlatform === 'perplexity' ? 'https://www.perplexity.ai' : 'https://chatgpt.com'),
    sourceOrg: sourcePlatform === 'perplexity' ? 'Perplexity Deep Research' : 'ChatGPT Analysis',
    category: 'external_llm_research',
    tags,
    parentDomain: '[[서해 중국 8대 침탈 시설망]]',
    verificationTier: text.includes('위성') && text.includes('좌표') ? 'FACT' : 'INFERENCE',
    contentMarkdown: enrichedText,
    citations,
    suggestedLinks: extractedLinks
  };
}

/**
 * 옵시디언 볼트에 Markdown 문서로 저장 및 로컬 RAG 벡터 DB 동기화
 */
export async function saveToObsidianVaultAndVectorize(
  parsed: ParsedLlmDocument
): Promise<IngestExternalResult> {
  const vaultDir = path.join(process.cwd(), 'data', 'obsidian-vault');
  const externalDir = path.join(vaultDir, 'external-llm');

  if (!fs.existsSync(externalDir)) {
    fs.mkdirSync(externalDir, { recursive: true });
  }

  // 파일명 슬러그 생성
  const safeTitle = parsed.title
    .replace(/[^\w\s가-힣-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || `intel-${Date.now()}`;
  const filename = `${safeTitle}.md`;
  const filePath = path.join(externalDir, filename);

  // YAML Frontmatter 생성
  const frontmatter = [
    '---',
    `title: "${parsed.title.replace(/"/g, '\\"')}"`,
    `source: "${parsed.sourceOrg}"`,
    `platform: "${parsed.sourcePlatform}"`,
    parsed.originalUrl ? `url: "${parsed.originalUrl}"` : '',
    `date: "${new Date().toISOString().split('T')[0]}"`,
    `verification_tier: "${parsed.verificationTier}"`,
    `parent: "${parsed.parentDomain}"`,
    `tags: [${parsed.tags.map(t => `"${t}"`).join(', ')}]`,
    `links: [${parsed.suggestedLinks.map(l => `"[[${l}]]"`).join(', ')}]`,
    '---',
    '',
    `# ${parsed.title}`,
    '',
    `> **[출처 플랫폼: ${parsed.sourceOrg}]** | 상위 계층: ${parsed.parentDomain} | 검증 등급: **${parsed.verificationTier}**`,
    '',
    parsed.contentMarkdown,
    '',
    parsed.citations.length > 0 ? '## 인용 출처 (Citations)' : '',
    ...parsed.citations.map(c => `- [${c.id}] [${c.title}](${c.url || '#'})`),
    ''
  ].filter(line => line !== null).join('\n');

  fs.writeFileSync(filePath, frontmatter, 'utf8');

  // 로컬 nomic-embed-text 벡터화
  const docId = `vault-${safeTitle}-${Date.now().toString(36)}`;
  let isVectorized = false;

  try {
    const embedding = await getEmbedding(`${parsed.title}\n${parsed.contentMarkdown.slice(0, 1200)}`);
    const store = loadVectorStore();

    const newDoc: VectorDocument = {
      id: docId,
      title: parsed.title,
      category: parsed.category,
      content: parsed.contentMarkdown,
      metadata: {
        source_org: parsed.sourceOrg,
        source_url: parsed.originalUrl || '',
        date: new Date().toISOString().split('T')[0],
        verification_tier: parsed.verificationTier,
        verification_score: parsed.verificationTier === 'FACT' ? 0.95 : 0.75,
      },
      embedding: embedding || undefined
    };

    // 기존 문서가 있으면 업데이트, 없으면 추가
    const existingIndex = store.findIndex(d => d.title === parsed.title);
    if (existingIndex >= 0) {
      store[existingIndex] = newDoc;
    } else {
      store.push(newDoc);
    }
    saveVectorStore(store);
    isVectorized = !!embedding;
  } catch (err) {
    console.warn('[ExternalLlmParser] Vectorization failed (saved to disk only):', err);
  }

  return {
    filePath,
    relativeVaultPath: `external-llm/${filename}`,
    documentId: docId,
    title: parsed.title,
    sourcePlatform: parsed.sourcePlatform,
    wikilinksCount: parsed.suggestedLinks.length,
    isVectorized
  };
}
