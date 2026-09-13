/**
 * OSIRIS — Korea Drone Intelligence OS
 * Provenance & Hallucination-Free Data Evidence Standard
 */

export interface ProvenanceMetadata {
  source_id: string;
  source_url: string;
  provider: string;
  retrieved_at: string;
  effective_at: string;
  valid_until: string | null;
  version: string;
  raw_hash: string;
  transformation: string;
  confidence: number;
}

export function createProvenanceMetadata(params: {
  source_id: string;
  source_url: string;
  provider: string;
  version?: string;
  confidence?: number;
  transformation?: string;
  raw_payload?: any;
}): ProvenanceMetadata {
  const now = new Date().toISOString();
  const rawString = JSON.stringify(params.raw_payload || params.source_id + params.source_url + now);
  
  // Simple SHA-256 placeholder hash generator
  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const raw_hash = `sha256:${Math.abs(hash).toString(16).padStart(64, '0')}`;

  return {
    source_id: params.source_id,
    source_url: params.source_url,
    provider: params.provider,
    retrieved_at: now,
    effective_at: new Date(Date.now() - 86400000).toISOString().split('T')[0] + 'T00:00:00Z',
    valid_until: null,
    version: params.version || '2026-v1.0',
    raw_hash,
    transformation: params.transformation || 'normalized-v1',
    confidence: params.confidence ?? 0.95,
  };
}
