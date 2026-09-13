/**
 * ⚡ OSIRIS Synapse Knowledge Graph Engine
 * 
 * 옵시디언 마크다운 볼트(data/obsidian-vault/)를 스캔하여
 * 상하 계층(Parent-Child), 위키링크([[wikilinks]]), 소크라테스 검증 상태를
 * 2D/3D 포스 지향 시냅스 지식 그래프 모델로 빌드하는 엔진.
 */

import fs from 'fs';
import path from 'path';

export interface SynapseNode {
  id: string;
  name: string;
  type: 'domain' | 'facility' | 'intel_note' | 'evidence';
  tier: 'FACT' | 'INFERENCE' | 'HYPOTHESIS' | 'FALSE';
  group: string;
  val: number; // Node size (importance/degree)
  tags: string[];
  parent?: string;
  source?: string;
  content: string;
  filePath?: string;
  inDegree?: number;
  outDegree?: number;
}

export interface SynapseLink {
  source: string;
  target: string;
  relationship: 'parent_child' | 'references' | 'cites' | 'counters';
  value: number; // Link thickness/strength
}

export interface SynapseGraphData {
  nodes: SynapseNode[];
  links: SynapseLink[];
  stats: {
    totalNodes: number;
    totalLinks: number;
    tiers: Record<string, number>;
    types: Record<string, number>;
    topHubs: Array<{ id: string; name: string; connections: number }>;
  };
}

/**
 * YAML Frontmatter 파싱 헬퍼
 */
export function parseFrontmatter(fileContent: string): { data: Record<string, any>; content: string } {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: fileContent };
  }

  const rawYaml = match[1];
  const content = match[2];
  const data: Record<string, any> = {};

  for (const line of rawYaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    // 따옴표 제거
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // 배열 처리 [a, b, c] (단, [[wikilinks]] 는 제외)
    if (value.startsWith('[') && value.endsWith(']') && !value.startsWith('[[')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map(i => i.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      data[key] = items;
    } else {
      data[key] = value;
    }
  }

  return { data, content };
}

/**
 * data/obsidian-vault/ 내의 모든 .md 파일 재귀 스캔
 */
function scanVaultFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanVaultFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 시냅스 지식 그래프 전체 데이터 생성
 */
export function buildSynapseGraph(): SynapseGraphData {
  const vaultDir = path.join(process.cwd(), 'data', 'obsidian-vault');
  const files = scanVaultFiles(vaultDir);

  const nodeMap = new Map<string, SynapseNode>();
  const linkSet = new Set<string>();
  const rawLinks: SynapseLink[] = [];

  // 1. 파일 기반 노드 등록
  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content } = parseFrontmatter(raw);

    const relPath = path.relative(vaultDir, filePath);
    const filenameNoExt = path.basename(filePath, '.md');
    const nodeId = (data.title || filenameNoExt).trim();

    // 노드 타입 추론
    let type: SynapseNode['type'] = 'intel_note';
    if (relPath.startsWith('domains') || filenameNoExt.includes('MOC') || filenameNoExt.includes('Hierarchy')) {
      type = 'domain';
    } else if (relPath.startsWith('facilities') || data.category === 'facility') {
      type = 'facility';
    } else if (relPath.startsWith('evidence') || data.category === 'evidence') {
      type = 'evidence';
    }

    // 검증 등급 (소크라테스 티어)
    const tierRaw = String(data.verification_tier || '').toUpperCase();
    let tier: SynapseNode['tier'] = 'INFERENCE';
    if (tierRaw.includes('FACT')) tier = 'FACT';
    else if (tierRaw.includes('FALSE') || tierRaw.includes('REJECT')) tier = 'FALSE';
    else if (tierRaw.includes('HYPOTHESIS') || tierRaw.includes('UNKNOWN')) tier = 'HYPOTHESIS';

    const tags: string[] = Array.isArray(data.tags) ? data.tags : [];
    const parentClean = typeof data.parent === 'string'
      ? data.parent.replace(/^\[\[/, '').replace(/\]\]$/, '').trim()
      : undefined;

    const node: SynapseNode = {
      id: nodeId,
      name: data.title || filenameNoExt,
      type,
      tier,
      group: tags[0]?.replace(/^#/, '') || type,
      val: type === 'domain' ? 8 : type === 'facility' ? 5 : 3,
      tags,
      parent: parentClean,
      source: data.source || data.platform || 'OSIRIS Vault',
      content,
      filePath: relPath,
      inDegree: 0,
      outDegree: 0
    };

    nodeMap.set(nodeId, node);
  }

  // 2. 링크 및 상하 관계 연결
  for (const [, node] of nodeMap) {
    // A. 상하 계층 관계 (parent -> child)
    if (node.parent) {
      if (!nodeMap.has(node.parent)) {
        // 부모 노드가 아직 없으면 자동 도메인 노드 생성
        nodeMap.set(node.parent, {
          id: node.parent,
          name: node.parent,
          type: 'domain',
          tier: 'FACT',
          group: 'domain',
          val: 8,
          tags: ['#domain/root'],
          content: `# ${node.parent}\n상위 도메인 최상위 지식 노드입니다.`,
          inDegree: 0,
          outDegree: 0
        });
      }

      const linkKey = `${node.parent}-->${node.id}`;
      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey);
        rawLinks.push({
          source: node.parent,
          target: node.id,
          relationship: 'parent_child',
          value: 3
        });
      }
    }

    // B. 인라인 위키링크 [[...]] 검색
    const wikilinks = node.content.match(/\[\[(.*?)\]\]/g) || [];
    for (const rawWl of wikilinks) {
      const targetClean = rawWl.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
      if (!targetClean || targetClean === node.id) continue;

      if (!nodeMap.has(targetClean)) {
        // 참조된 노드가 아직 파일로 없으면 플레이스홀더 노드로 자동 승격
        nodeMap.set(targetClean, {
          id: targetClean,
          name: targetClean,
          type: 'intel_note',
          tier: 'INFERENCE',
          group: 'concept',
          val: 2,
          tags: ['#concept/wikilink'],
          content: `# ${targetClean}\n\n다른 지식 문서에서 참조된 개념 노드입니다.`,
          inDegree: 0,
          outDegree: 0
        });
      }

      const linkKey = `${node.id}->${targetClean}`;
      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey);
        rawLinks.push({
          source: node.id,
          target: targetClean,
          relationship: 'references',
          value: 1.5
        });
      }
    }
  }

  // 3. 차수(In-degree, Out-degree) 및 노드 크기(val) 재계산
  for (const link of rawLinks) {
    const srcNode = nodeMap.get(link.source);
    const tgtNode = nodeMap.get(link.target);
    if (srcNode) srcNode.outDegree = (srcNode.outDegree || 0) + 1;
    if (tgtNode) tgtNode.inDegree = (tgtNode.inDegree || 0) + 1;
  }

  for (const [, node] of nodeMap) {
    const totalDegree = (node.inDegree || 0) + (node.outDegree || 0);
    node.val = Math.max(2, Math.min(18, node.val + totalDegree * 0.8));
  }

  const nodes = Array.from(nodeMap.values());
  const links = rawLinks;

  // 통계 계산
  const tiers: Record<string, number> = {};
  const types: Record<string, number> = {};
  for (const n of nodes) {
    tiers[n.tier] = (tiers[n.tier] || 0) + 1;
    types[n.type] = (types[n.type] || 0) + 1;
  }

  const topHubs = [...nodes]
    .sort((a, b) => ((b.inDegree || 0) + (b.outDegree || 0)) - ((a.inDegree || 0) + (a.outDegree || 0)))
    .slice(0, 5)
    .map(n => ({ id: n.id, name: n.name, connections: (n.inDegree || 0) + (n.outDegree || 0) }));

  return {
    nodes,
    links,
    stats: {
      totalNodes: nodes.length,
      totalLinks: links.length,
      tiers,
      types,
      topHubs
    }
  };
}
