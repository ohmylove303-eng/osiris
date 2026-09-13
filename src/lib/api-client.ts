/**
 * OSIRIS Type-Safe API Client
 * 
 * Inspired by ponytailer/pydantic-client (Python HTTP Client leveraging Pydantic validation):
 * - Strongly typed request/response handling
 * - Nested Response Extraction (`response_extract_path`, e.g., `$.sites`, `$.ports`)
 * - Interceptors (`before_request`, `after_response`)
 * - Mock API configuration for testing & offline development
 * - Performance span timing tracking
 */

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined | null>;
  extractPath?: string; // JSONPath style extraction: e.g. "$.sites", "$.data.items[0]"
  cache?: RequestCache;
}

export interface MockConfig {
  name: string;
  output: any;
}

export class BaseWebClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private mockConfigs: Map<string, any> = new Map();

  constructor(baseUrl: string = '', defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Osiris-TypeSafe-Client/1.0',
      ...defaultHeaders,
    };
  }

  /**
   * Configure Mock Responses for API testing (matching pydantic-client set_mock_config)
   */
  public setMockConfig(mocks: MockConfig[]) {
    mocks.forEach(m => this.mockConfigs.set(m.name, m.output));
  }

  /**
   * Hook executed before sending every request (matching pydantic-client before_request)
   */
  protected beforeRequest(params: { url: string; headers: Record<string, string> }): { url: string; headers: Record<string, string> } {
    return params;
  }

  /**
   * Extract data using JSONPath-like expressions (matching pydantic-client response_extract_path)
   * Example: "$.sites" -> returns obj.sites
   * Example: "$.data.items[0]" -> returns obj.data.items[0]
   */
  public extractPath<T = any>(obj: any, path: string): T {
    if (!path || !obj) return obj;
    const cleanPath = path.replace(/^\$\.?/, '');
    const tokens = cleanPath.split('.');
    let current = obj;
    for (const token of tokens) {
      if (current === undefined || current === null) break;
      const arrayMatch = token.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const prop = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        current = current[prop]?.[index];
      } else {
        current = current[token];
      }
    }
    return current as T;
  }

  /**
   * Execute API call with timing tracking, interceptors, and nested response extraction
   */
  protected async request<T = any>(endpointName: string, path: string, options: RequestOptions = {}): Promise<T> {
    // Check mock config
    if (this.mockConfigs.has(endpointName)) {
      return this.mockConfigs.get(endpointName) as T;
    }

    const startTime = performance.now();
    let url = `${this.baseUrl}${path}`;
    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.set(k, String(v));
      });
      const queryString = searchParams.toString();
      if (queryString) url += (url.includes('?') ? '&' : '?') + queryString;
    }

    const initialHeaders = { ...this.defaultHeaders, ...options.headers };
    const { url: finalUrl, headers: finalHeaders } = this.beforeRequest({ url, headers: initialHeaders });

    try {
      const res = await fetch(finalUrl, {
        headers: finalHeaders,
        cache: options.cache || 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText} for ${endpointName}`);
      }

      const json = await res.json();
      const extracted = options.extractPath ? this.extractPath<T>(json, options.extractPath) : json;
      const durationMs = (performance.now() - startTime).toFixed(1);
      
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[OsirisAPIClient] ${endpointName} -> ${durationMs}ms (${finalUrl})`);
      }

      return extracted as T;
    } catch (err) {
      console.warn(`[OsirisAPIClient] Error in ${endpointName}:`, err instanceof Error ? err.message : err);
      throw err;
    }
  }
}

/**
 * OSIRIS Main Intelligence Platform API Client
 */
export class OsirisAPIClient extends BaseWebClient {
  constructor(baseUrl: string = '') {
    super(baseUrl);
  }

  /** DPRK Strategic Intelligence Sites (extractPath: "$.sites") */
  async getDprkSites(category?: string, query?: string) {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (query) params.q = query;
    return this.request<any[]>('getDprkSites', '/api/osint/dprk', {
      params,
      extractPath: '$.sites',
    });
  }

  /** Live Aircraft Feed */
  async getFlights() {
    return this.request<any>('getFlights', '/api/flights');
  }

  /** Maritime Ships & Ports (extractPath: "$.ships" or raw) */
  async getMaritimeShips() {
    return this.request<any[]>('getMaritimeShips', '/api/maritime', {
      extractPath: '$.ships',
    });
  }

  /** Tracked Satellites */
  async getSatellites() {
    return this.request<any[]>('getSatellites', '/api/satellites', {
      extractPath: '$.satellites',
    });
  }

  /** Global News & Intelligence Feed */
  async getNews() {
    return this.request<any[]>('getNews', '/api/news', {
      extractPath: '$.news',
    });
  }

  /** Financial Markets & Space Weather */
  async getMarkets() {
    return this.request<any>('getMarkets', '/api/markets');
  }

  /** CCTV Surveillance Cameras */
  async getCctvCameras(region: string = 'all') {
    return this.request<any[]>('getCctvCameras', '/api/cctv', {
      params: { region, _t: Date.now() },
      extractPath: '$.cameras',
    });
  }
}

// Single exported instance for frontend components
export const osirisClient = new OsirisAPIClient();
