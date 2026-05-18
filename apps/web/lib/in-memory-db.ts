export class InMemoryDb {
  private urls: any[] = [];
  private links: any[] = [];
  private headers: any[] = [];
  private queue: any[] = [];
  private meta = new Map<string, string>();
  private urlCounter = 0;

  async connect() {
    console.log('>>> [InMemoryDb] Connected successfully (in-memory mode)');
  }

  async close() {
    console.log('>>> [InMemoryDb] Closed connection');
  }

  async reset() {
    this.urls = [];
    this.links = [];
    this.headers = [];
    this.queue = [];
    this.meta.clear();
    this.urlCounter = 0;
    console.log('>>> [InMemoryDb] Reset all collections');
  }

  async getMeta(key: string): Promise<string | null> {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
  }

  async upsertUrl(input: any): Promise<number> {
    if (!input || !input.url) return 0;
    const existing = this.urls.find(u => u.url === input.url);
    if (existing) {
      Object.assign(existing, input, { crawled_at: new Date().toISOString() });
      return existing.id;
    } else {
      const id = ++this.urlCounter;
      this.urls.push({
        ...input,
        id,
        crawled_at: new Date().toISOString(),
      });
      return id;
    }
  }

  async writeFetchedUrl(payload: any): Promise<{ urlId: number }> {
    if (!payload) return { urlId: 0 };
    const urlId = await this.upsertUrl(payload.upsert);

    if (payload.headers && payload.headers.length > 0) {
      this.headers = this.headers.filter(h => h.url_id !== urlId);
      for (const h of payload.headers) {
        if (h && h[0] && h[1]) {
          this.headers.push({ url_id: urlId, key: h[0], value: h[1] });
        }
      }
    }

    if (payload.links && payload.links.length > 0) {
      await this.insertLinks(urlId, payload.links, payload.fromDepth);
    }

    return { urlId };
  }

  async insertLinks(fromUrlId: number, links: any[], fromDepth: number) {
    if (!links || links.length === 0) return;
    for (const l of links) {
      if (l && l.toUrl) {
        this.links.push({
          from_url_id: fromUrlId,
          to_url: l.toUrl,
          anchor: l.anchor,
          rel: l.rel,
          is_internal: l.isInternal ? 1 : 0
        });
      }
    }

    const externals = links.filter(l => !l.isInternal);
    if (externals.length > 0) {
      const externalDepth = fromDepth + 1;
      for (const l of externals) {
        await this.upsertUrl({
          url: l.toUrl,
          content_kind: 'other',
          depth: externalDepth,
          is_external: 1,
          indexability: 'indexable'
        });
      }
    }
  }

  async getSummary(): Promise<any> {
    const total = this.urls.length;
    const byStatus: Record<number, number> = {};
    const byContentKind: Record<string, number> = {};
    const byIndexability: Record<string, number> = {};
    let totalTime = 0;
    let countWithTime = 0;

    for (const url of this.urls) {
      if (url.status_code) {
        byStatus[url.status_code] = (byStatus[url.status_code] || 0) + 1;
      }
      if (url.content_kind) {
        byContentKind[url.content_kind] = (byContentKind[url.content_kind] || 0) + 1;
      }
      if (url.indexability) {
        byIndexability[url.indexability] = (byIndexability[url.indexability] || 0) + 1;
      }
      if (url.response_time_ms) {
        totalTime += url.response_time_ms;
        countWithTime++;
      }
    }

    return {
      total,
      byStatus,
      byContentKind,
      byIndexability,
      avgResponseTimeMs: countWithTime > 0 ? Math.round(totalTime / countWithTime) : 0,
      totalBytes: 0
    };
  }

  async getAllUrls(opts?: any): Promise<any[]> {
    let result = [...this.urls];
    if (opts?.status) {
      result = result.filter(u => u.status_code === opts.status);
    }
    if (opts?.search) {
      const searchLower = opts.search.toLowerCase();
      result = result.filter(u => u.url.toLowerCase().includes(searchLower) || (u.title && u.title.toLowerCase().includes(searchLower)));
    }
    result.sort((a, b) => b.id - a.id);
    const limit = opts?.limit ?? 2000;
    const skip = opts?.offset ?? 0;
    return result.slice(skip, skip + limit);
  }

  async getIssuesSummary(): Promise<Record<string, number>> {
    const issues: Record<string, number> = {};
    for (const u of this.urls) {
      if (!u.title) issues['Title Missing'] = (issues['Title Missing'] || 0) + 1;
      if (u.title && u.title.length > 60) issues['Title Too Long (>60)'] = (issues['Title Too Long (>60)'] || 0) + 1;
      if (!u.meta_description) issues['Meta Desc Missing'] = (issues['Meta Desc Missing'] || 0) + 1;
      if ((u.status_code ?? 0) >= 400) issues['4xx/5xx Errors'] = (issues['4xx/5xx Errors'] || 0) + 1;
      if ((u.status_code ?? 0) >= 300 && (u.status_code ?? 0) < 400) issues['Redirects (3xx)'] = (issues['Redirects (3xx)'] || 0) + 1;
      if ((u.response_time_ms ?? 0) > 3000) issues['Slow Pages (>3s)'] = (issues['Slow Pages (>3s)'] || 0) + 1;
      if (!u.h1 || u.h1 === '') issues['H1 Missing'] = (issues['H1 Missing'] || 0) + 1;
    }
    return issues;
  }

  async checkpointQueue(items: any[], seed: string) {
    this.queue = items.map(it => ({ ...it, seed_url: seed }));
  }

  async clearQueueCheckpoint() {
    this.queue = [];
  }

  async loadQueueCheckpoint() {
    return [...this.queue];
  }

  async getPendingInternalLinks(opts?: any) {
    const internalLinks = Array.from(new Set(this.links.filter(l => l.is_internal === 1).map(l => l.to_url)));
    const knownUrls = new Set(this.urls.map(u => u.url));
    const pending = internalLinks.filter(url => !knownUrls.has(url));
    const recrawl = this.urls.filter(u => u.is_external === 0 && u.status_code === null);
    
    return [
      ...pending.map(url => ({ url, depth: 1 })),
      ...recrawl.map(r => ({ url: r.url, depth: r.depth }))
    ];
  }

  async summaryGet() {
    return this.getSummary();
  }

  async hasUrl(url: string): Promise<boolean> {
    return this.urls.some(u => u.url === url);
  }

  async countCrawledUrls(): Promise<number> {
    return this.urls.filter(u => u.status_code !== null).length;
  }

  // Stubs & minor operations to maintain exact API compatibility with ProjectDb
  async recomputeInlinks() {}
  async recomputeRedirectChains() {}
  async recomputeHreflangAnalysis() {}
  async recomputeUrlsIssuesYielding(defs: any) {}
  async recomputeHreflangInconsistent() {}
  async recomputePaginationSequence() {}
  async recomputeUrlsIssues(defs?: any) {}
  async recomputeDuplicateClusters(threshold: number, onlyIndexable: boolean): Promise<any> { return { clusters: 0, clusteredUrls: 0 }; }
  async getOverviewCounts(): Promise<any> { return { issues: {} }; }
  async unprobedInternalImages(limit: number): Promise<any[]> { return []; }
  async unprobedHttpsHosts(limit: number): Promise<any[]> { return []; }
  async getUnprobedExternalUrls(): Promise<any[]> { return []; }
  async setImageSize(urlId: number, size: number | null, status: number) {}
  async setHostCert(opts: any) {}
  async setSitemapUrls(urls: any[]) {}
  async setUrlHeaders(urlId: number, headers: any[]) {}
  async updateExternalProbe(url: string, result: any) {}
  
  async *iterateUrlsByIds(ids: number[]): AsyncGenerator<any> {}
  async *iterateUrlsByCategory(cat: string): AsyncGenerator<any> {}
  async *iterateAllUrls(): AsyncGenerator<any> {}
  async *iterateIndexableUrls(): AsyncGenerator<any> {}
}
