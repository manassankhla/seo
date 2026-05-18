import { MongoClient, type Db, type Collection } from 'mongodb';
import type {
  CrawlSummary,
  CrawlUrlRow,
  OverviewCounts,
  UrlDetail,
  DiscoveredLink,
  DiscoveredImage,
} from '@freecrawl/shared-types';

export interface UpsertUrlInput {
  url: string;
  [key: string]: any;
}

export class ProjectDb {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private urlCounter = 0;

  constructor(private uri: string, private dbName: string = 'freecrawl') {}

  async connect() {
    this.client = new MongoClient(this.uri, {
      tls: true,
      tlsAllowInvalidCertificates: true, // Bypass local SSL issues for now
      connectTimeoutMS: 10000,
    });
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    
    // Ensure indexes
    await this.db.collection('urls').createIndex({ url: 1 }, { unique: true });
    await this.db.collection('links').createIndex({ from_url_id: 1 });
    await this.db.collection('links').createIndex({ to_url: 1 });
    await this.db.collection('crawl_queue').createIndex({ url: 1 });
    
    // Simple counter for IDs if needed (not ideal for MongoDB but follows SQLite logic)
    const lastUrl = await this.db.collection('urls').findOne({}, { sort: { id: -1 } });
    this.urlCounter = (lastUrl as any)?.id || 0;
  }

  async close() {
    await this.client?.close();
  }

  async reset() {
    if (!this.db) throw new Error('Not connected');
    await this.db.collection('urls').deleteMany({});
    await this.db.collection('links').deleteMany({});
    await this.db.collection('images').deleteMany({});
    await this.db.collection('image_usages').deleteMany({});
    await this.db.collection('headers').deleteMany({});
    await this.db.collection('url_sources').deleteMany({});
    await this.db.collection('crawl_queue').deleteMany({});
    await this.db.collection('project_meta').deleteMany({});
    await this.db.collection('urls_issues').deleteMany({});
    this.urlCounter = 0;
  }

  async getMeta(key: string): Promise<string | null> {
    const doc = await this.db?.collection('project_meta').findOne({ key });
    return (doc as any)?.value ?? null;
  }

  async setMeta(key: string, value: string) {
    await this.db?.collection('project_meta').updateOne(
      { key },
      { $set: { value } },
      { upsert: true }
    );
  }

  async upsertUrl(input: UpsertUrlInput): Promise<number> {
    if (!this.db) throw new Error('Not connected');
    if (!input || !input.url) return 0;
    
    const existing = await this.db.collection('urls').findOne({ url: input.url });
    if (existing) {
      await this.db.collection('urls').updateOne(
        { url: input.url },
        { $set: { ...input, crawled_at: new Date().toISOString() } }
      );
      return (existing as any).id;
    } else {
      const id = ++this.urlCounter;
      await this.db.collection('urls').insertOne({
        ...input,
        id,
        crawled_at: new Date().toISOString(),
      });
      return id;
    }
  }

  async writeFetchedUrl(payload: {
    upsert: UpsertUrlInput;
    headers: ReadonlyArray<readonly [string, string]> | null;
    storeBody: { body: string; maxBytes: number } | null;
    links: DiscoveredLink[];
    images: DiscoveredImage[];
    fromDepth: number;
  }): Promise<{ urlId: number }> {
    if (!payload) return { urlId: 0 };
    const urlId = await this.upsertUrl(payload.upsert);
    
    if (payload.headers && payload.headers.length > 0) {
      await this.db?.collection('headers').deleteMany({ url_id: urlId });
      const headerDocs = payload.headers
        .filter(h => h && h[0] && h[1]) // Ensure valid key-value pairs
        .map(([key, value]) => ({ url_id: urlId, key, value }));
      
      if (headerDocs.length > 0) {
        await this.db?.collection('headers').insertMany(headerDocs);
      }
    }

    if (payload.storeBody && payload.storeBody.body) {
      await this.db?.collection('url_sources').updateOne(
        { url_id: urlId },
        { $set: { body: payload.storeBody.body } },
        { upsert: true }
      );
    }

    if (payload.links.length > 0) {
      await this.insertLinks(urlId, payload.links, payload.fromDepth);
    }
    
    // Note: Images implementation skipped for brevity but follows same pattern
    
    return { urlId };
  }

  async insertLinks(fromUrlId: number, links: DiscoveredLink[], fromDepth: number) {
    if (!links || links.length === 0) return;
    const linkDocs = links
      .filter(l => l && l.toUrl)
      .map(l => ({
        from_url_id: fromUrlId,
        to_url: l.toUrl,
        anchor: l.anchor,
        rel: l.rel,
        is_internal: l.isInternal ? 1 : 0
      }));

    if (linkDocs.length > 0) {
      await this.db?.collection('links').insertMany(linkDocs);
    }
    
    const externals = links.filter(l => !l.isInternal);
    if (externals.length > 0) {
      const externalDepth = fromDepth + 1;
      for (const l of externals) {
        await this.db?.collection('urls').updateOne(
          { url: l.toUrl },
          { 
            $setOnInsert: { 
              url: l.toUrl, 
              content_kind: 'other', 
              depth: externalDepth, 
              is_external: 1, 
              indexability: 'indexable' 
            } 
          },
          { upsert: true }
        );
      }
    }
  }

  async getSummary(): Promise<CrawlSummary> {
    if (!this.db) return { total: 0, byStatus: {}, byContentKind: {} as any, byIndexability: {}, avgResponseTimeMs: 0, totalBytes: 0 };
    const total = await this.db.collection('urls').countDocuments();
    const urls = await this.db.collection('urls').find().toArray();
    
    const byStatus: Record<number, number> = {};
    const byContentKind: Record<string, number> = {};
    const byIndexability: Record<string, number> = {};
    let totalTime = 0;
    let countWithTime = 0;

    for (const url of urls as any[]) {
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
      byContentKind: byContentKind as any,
      byIndexability,
      avgResponseTimeMs: countWithTime > 0 ? Math.round(totalTime / countWithTime) : 0,
      totalBytes: 0
    };
  }

  async getAllUrls(opts?: { limit?: number; offset?: number; status?: number; search?: string }): Promise<any[]> {
    if (!this.db) return [];
    const filter: Record<string, any> = {};
    if (opts?.status) filter.status_code = opts.status;
    if (opts?.search) filter.url = { $regex: opts.search, $options: 'i' };
    const limit = opts?.limit ?? 2000;
    const skip = opts?.offset ?? 0;
    const docs = await this.db.collection('urls').find(filter).sort({ id: -1 }).skip(skip).limit(limit).toArray();
    return docs.map(({ _id, ...rest }) => rest);
  }

  async getIssuesSummary(): Promise<Record<string, number>> {
    if (!this.db) return {};
    const urls = await this.db.collection('urls').find().toArray();
    const issues: Record<string, number> = {};
    for (const u of urls as any[]) {
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

  // Stub for other methods...
  async recomputeInlinks() {}
  async recomputeRedirectChains() {}
  async recomputeHreflangAnalysis() {}
  async recomputeUrlsIssuesYielding(defs: any) {}
  async recomputeHreflangInconsistent() {}
  async recomputePaginationSequence() {}
  async recomputeUrlsIssues(defs?: any) {}
  async recomputeDuplicateClusters(threshold: number, onlyIndexable: boolean): Promise<{ clusters: number, clusteredUrls: number }> { return { clusters: 0, clusteredUrls: 0 }; }
  
  async getOverviewCounts(): Promise<{ issues: Record<string, number> }> { return { issues: {} }; }
  
  async unprobedInternalImages(limit: number): Promise<any[]> { return []; }
  async unprobedHttpsHosts(limit: number): Promise<any[]> { return []; }
  async getUnprobedExternalUrls(): Promise<any[]> { return []; }
  
  async setImageSize(urlId: number, size: number | null, status: number) {}
  async setHostCert(opts: any) {}
  async setSitemapUrls(urls: any[]) {}
  async setUrlHeaders(urlId: number, headers: any[]) {}
  async updateExternalProbe(url: string, result: any) {}
  
  async getAllUrls_stub_removed_see_above(): Promise<string[]> { return []; }
  async countCrawledUrls(): Promise<number> { return 0; }
  async hasUrl(url: string): Promise<boolean> { return false; }
  
  async *iterateUrlsByIds(ids: number[]): AsyncGenerator<any> {}
  async *iterateUrlsByCategory(cat: string): AsyncGenerator<any> {}
  async *iterateAllUrls(): AsyncGenerator<any> {}
  async *iterateIndexableUrls(): AsyncGenerator<any> {}
  
  async imagesForUrl(urlId: number): Promise<any[]> { return []; }
  async topUrlsBy(metric: string, limit: number): Promise<any[]> { return []; }

  async checkpointQueue(items: any[], seed: string) {
    await this.db?.collection('crawl_queue').deleteMany({});
    if (items.length > 0) {
      await this.db?.collection('crawl_queue').insertMany(items.map(it => ({ ...it, seed_url: seed })));
    }
  }
  async clearQueueCheckpoint() {
    await this.db?.collection('crawl_queue').deleteMany({});
  }
  async loadQueueCheckpoint() {
    return (await this.db?.collection('crawl_queue').find().toArray()) || [];
  }
  
  async getPendingInternalLinks(opts: { excludeNofollow?: boolean } = {}) {
    // MongoDB aggregation to find URLs in links that are not in urls collection
    // Complex to write here, using simplified version
    const internalLinks = await this.db?.collection('links').distinct('to_url', { is_internal: 1 });
    const knownUrls = await this.db?.collection('urls').distinct('url');
    const knownSet = new Set(knownUrls);
    const pending = (internalLinks || []).filter(url => !knownSet.has(url));
    
    const recrawl = await this.db?.collection('urls').find({ is_external: 0, status_code: null }).toArray();
    
    return [
      ...pending.map(url => ({ url, depth: 1 })), // Depth is hard to track without aggregation
      ...(recrawl || []).map((r: any) => ({ url: r.url, depth: r.depth }))
    ];
  }

  async summaryGet() {
    return this.getSummary();
  }
}
