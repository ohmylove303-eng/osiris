import { describe, it, expect } from 'vitest';
import { parseExternalLlmText, enrichWithWikilinks } from '@/lib/external-llm-parser';
import { cleanMarkdownForSpeech } from '@/lib/tts-engine';
import { buildSynapseGraph } from '@/lib/synapse-graph-engine';

describe('⚡ Synapse Knowledge Graph & External LLM Test Suite', () => {
  describe('1. External LLM Parser & Wikilink Enrichment', () => {
    it('Perplexity 검색 스레드와 [1] 각주를 자동 식별하여 파싱한다', () => {
      const samplePerplexity = `
### 서해 선란 1호와 중국 해양 감시망
Sources:
[1] CSIS AMTI Report: https://amti.csis.org/shenlan-report
[2] USNI News: https://news.usni.org/china-sensors

선란 1호는 반잠수식 플랫폼으로 수중 음향 소나 센서를 운용합니다.
관련 시설로는 선란 2호 및 13기 부표망이 연계되어 있습니다.
      `;

      const parsed = parseExternalLlmText(samplePerplexity, '서해 선란 1호 분석');
      expect(parsed.sourcePlatform).toBe('perplexity');
      expect(parsed.citations.length).toBe(2);
      expect(parsed.citations[0].url).toBe('https://amti.csis.org/shenlan-report');
      expect(parsed.suggestedLinks).toContain('선란 1호');
      expect(parsed.suggestedLinks).toContain('선란 2호');
      expect(parsed.suggestedLinks).toContain('13기 부표망');
    });

    it('ChatGPT 분석 텍스트를 감지하고 위키링크를 자동 주입한다', () => {
      const sampleChatGpt = `
User: 서해 PMZ 루칭위안위 066의 정체는?
ChatGPT: 루칭위안위 066은 선란 1호에 상주하는 지원 트롤선으로 고전압 전력을 공급합니다.
Thinking process:
CSSC 702연구소와의 연계 가능성을 검토함.
      `;

      const parsed = parseExternalLlmText(sampleChatGpt);
      expect(parsed.sourcePlatform).toBe('chatgpt');
      expect(parsed.contentMarkdown).toContain('[[루칭위안위 066]]');
      expect(parsed.contentMarkdown).toContain('[[선란 1호]]');
      expect(parsed.contentMarkdown).toContain('[[CSSC 702연구소]]');
    });

    it('이미 [[위키링크]]로 감싸진 엔티티는 중복으로 감싸지 않는다', () => {
      const text = '이미 [[선란 1호]]는 감싸져 있고, 선란 2호는 감싸져 있지 않습니다.';
      const { enrichedText } = enrichWithWikilinks(text);
      expect(enrichedText).not.toContain('[[[[선란 1호]]]]');
      expect(enrichedText).toContain('[[선란 1호]]');
      expect(enrichedText).toContain('[[선란 2호]]');
    });
  });

  describe('2. TTS Markdown Normalizer', () => {
    it('마크다운 기호, 위키링크, URL을 음성 친화적으로 깨끗이 정제한다', () => {
      const raw = `
### [[선란 1호]]의 **소나** 시스템 분석
- [CSIS 보고서](https://amti.csis.org/report) [인용 #1]에 따르면,
- 수심 60m에 계류되어 있습니다.
      `;

      const cleaned = cleanMarkdownForSpeech(raw);
      expect(cleaned).not.toContain('###');
      expect(cleaned).not.toContain('[[');
      expect(cleaned).not.toContain(']]');
      expect(cleaned).not.toContain('**');
      expect(cleaned).not.toContain('https://');
      expect(cleaned).toContain('선란 1호의 소나 시스템 분석');
      expect(cleaned).toContain('제1인용 에 따르면');
    });
  });

  describe('3. Synapse Graph Topology & Hierarchy', () => {
    it('옵시디언 볼트를 스캔하여 상하 계층과 위키링크 엣지를 형성한다', () => {
      const graph = buildSynapseGraph();
      expect(graph.nodes.length).toBeGreaterThanOrEqual(10);
      expect(graph.links.length).toBeGreaterThanOrEqual(15);

      // 최상위 도메인 및 핵심 허브 확인
      const hubIds = graph.stats.topHubs.map(h => h.id);
      expect(hubIds).toContain('선란 1호');

      // 상하 관계(parent_child) 링크 확인
      const parentChildLinks = graph.links.filter(l => l.relationship === 'parent_child');
      expect(parentChildLinks.length).toBeGreaterThanOrEqual(3);

      // 참조 관계(references) 링크 확인
      const referenceLinks = graph.links.filter(l => l.relationship === 'references');
      expect(referenceLinks.length).toBeGreaterThanOrEqual(5);
    });

    it('소크라테스 5대 관문 등급(FACT/INFERENCE/HYPOTHESIS)이 엄격히 분류된다', () => {
      const graph = buildSynapseGraph();
      expect(graph.stats.tiers['FACT']).toBeGreaterThan(0);
      expect(graph.stats.tiers['INFERENCE']).toBeGreaterThan(0);

      // 관측 제원이 검증된 선란 1호는 FACT 여야 함
      const shenlan1 = graph.nodes.find(n => n.id === '선란 1호');
      expect(shenlan1?.tier).toBe('FACT');
    });
  });
});
