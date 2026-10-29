import { describe, it, expect } from 'vitest';
import { GET } from './route';
import { POST } from './verify/route';
import { NextRequest } from 'next/server';

describe('obra/superpowers Structured Verification: DMZ Tunnels & Google Claims', () => {
  describe('Protocol 1: Confirmed Tunnels & Google Claims Data Integrity', () => {
    it('returns verified 4 DMZ infiltration tunnels with official UNC MAC specifications', async () => {
      const res = await GET();
      const body = await res.json();

      expect(body.status).toBe('ok');
      expect(body.meta.total_confirmed).toBe(4);
      expect(body.sites).toHaveLength(4);

      const t1 = body.sites.find((s: any) => s.id === 'TUNNEL-01');
      expect(t1).toBeDefined();
      expect(t1.name).toContain('제1땅굴');
      expect(t1.depth_m).toBe(45);
      expect(t1.mdl_penetration_m).toBe(1200);

      const t3 = body.sites.find((s: any) => s.id === 'TUNNEL-03');
      expect(t3).toBeDefined();
      expect(t3.name).toContain('제3땅굴');
      expect(t3.depth_m).toBe(73);
      expect(t3.mdl_penetration_m).toBe(435);
      expect(t3.capacity_per_hour).toContain('30,000');
    });

    it('returns 6 strategic infiltration axes with multi-tier scientific detection methods', async () => {
      const res = await GET();
      const body = await res.json();

      expect(body.meta.total_suspected_axes).toBe(6);
      expect(body.axes).toHaveLength(6);

      const munsan = body.axes.find((a: any) => a.id === 'AXIS-PAJU-MUNSAN');
      expect(munsan).toBeDefined();
      expect(munsan.coordinates.length).toBeGreaterThanOrEqual(3);
      expect(munsan.detection_methods).toContain('마이크로 중력계(Microgravity)');
    });

    it('verifies all 5 Google civilian suspected claims with ROK MND/KIGAM drilling evidence', async () => {
      const res = await GET();
      const body = await res.json();

      expect(body.meta.total_investigated_claims).toBe(5);
      expect(body.claims).toHaveLength(5);

      // 1. 경기 양주 광사동
      const yangju = body.claims.find((c: any) => c.id === 'CLAIM-YANGJU');
      expect(yangju.socratic_verdict).toBe('DISPROVEN_NATURAL_GEOLOGY');
      expect(yangju.evidence_gate_tier).toBe('FACT_DISPROVEN');
      expect(yangju.drilling_stats).toContain('시추공 5개');
      expect(yangju.scientific_reasoning).toContain('싱크홀');

      // 2. 경기 남양주 지금동
      const namyangju = body.claims.find((c: any) => c.id === 'CLAIM-NAMYANGJU');
      expect(namyangju.socratic_verdict).toBe('DISPROVEN_NATURAL_GEOLOGY');
      expect(namyangju.scientific_reasoning).toContain('자연 수맥');

      // 3. 경기 화성 남양읍 (NYT 보도 건)
      const hwaseong = body.claims.find((c: any) => c.id === 'CLAIM-HWASEONG');
      expect(hwaseong.socratic_verdict).toBe('DISPROVEN_NATURAL_GEOLOGY');
      expect(hwaseong.scientific_reasoning).toContain('14만 대');

      // 4. 김포 하성면 (한강하구 접경 감시)
      const gimpo = body.claims.find((c: any) => c.id === 'CLAIM-GIMPO-HASEONG');
      expect(gimpo.socratic_verdict).toBe('MONITORED_BORDER_ZONE');
      expect(gimpo.evidence_gate_tier).toBe('INFERENCE_BORDER_WATCH');

      // 5. 파주 적성면 (임진강 축선 감시)
      const paju = body.claims.find((c: any) => c.id === 'CLAIM-PAJU-JEOKSEONG');
      expect(paju.socratic_verdict).toBe('MONITORED_BORDER_ZONE');
      expect(paju.evidence_gate_tier).toBe('INFERENCE_BORDER_WATCH');
    });

    it('returns 4 threat cones polygons and 6 global subterranean intelligence nodes', async () => {
      const res = await GET();
      const body = await res.json();

      expect(body.meta.total_threat_cones).toBe(4);
      expect(body.cones).toHaveLength(4);
      expect(body.cones[0].coordinates.length).toBeGreaterThanOrEqual(10); // polygon ring

      expect(body.meta.total_intel_nodes).toBe(6);
      expect(body.intel_nodes).toHaveLength(6);
      const usDia = body.intel_nodes.find((n: any) => n.id === 'NODE-US-DIA');
      expect(usDia).toBeDefined();
      expect(usDia.agency).toContain('DIA');
      const idf = body.intel_nodes.find((n: any) => n.id === 'NODE-IL-IDF9900');
      expect(idf).toBeDefined();
      expect(idf.assessment_summary).toContain('KOMID');
    });
  });

  describe('Protocol 2: Socratic 5-Gate Physical Truth Calculations', () => {
    it('accurately computes mass conservation: debris tonnage and 5-ton truck counts for Hwaseong (60km)', async () => {
      const req = new NextRequest('http://127.0.0.1:3000/api/intel/tunnels/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: '경기 화성시 남양읍', distance_km: 60 })
      });

      const res = await POST(req);
      const { data } = await res.json();

      // Formula: 2.7m² * 60,000m * 2.65t/m³ = 429,300 tons
      expect(data.calculated_debris_tons).toBe(429300);
      expect(data.truck_loads_5ton).toBe(85860);
      expect(data.ventilation_feasible).toBe(false);
      expect(data.verdict).toBe('FACT_DISPROVEN');
      expect(data.epistemic_score).toBe(100);

      // Verify all 5 philosophers are included
      const philosophers = data.gates.map((g: any) => g.philosopher);
      expect(philosophers).toContain('Aristotle');
      expect(philosophers).toContain('Socrates');
      expect(philosophers).toContain('Richard Feynman');
      expect(philosophers).toContain('Karl Popper');
      expect(philosophers).toContain('Judea Pearl');
    });

    it('enforces Feynman engineering boundary: short distance (2km) vs long distance (25km)', async () => {
      // 2km border zone
      const reqShort = new NextRequest('http://127.0.0.1:3000/api/intel/tunnels/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: '김포 접경초소', distance_km: 2 })
      });
      const resShort = await POST(reqShort);
      const dataShort = (await resShort.json()).data;
      expect(dataShort.ventilation_feasible).toBe(true);
      expect(dataShort.verdict).toBe('INFERENCE_BORDER_WATCH');

      // 25km inland zone (Yangju)
      const reqLong = new NextRequest('http://127.0.0.1:3000/api/intel/tunnels/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: '경기 양주시 광사동', distance_km: 25 })
      });
      const resLong = await POST(reqLong);
      const dataLong = (await resLong.json()).data;
      expect(dataLong.ventilation_feasible).toBe(false);
      expect(dataLong.verdict).toBe('FACT_DISPROVEN');
      expect(dataLong.kigam_drilling_history).toContain('자연 싱크홀');
    });
  });
});
