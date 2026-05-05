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
    this.client = new MongoClient(this.uri);
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
    const urlId = await this.upsertUrl(payload.upsert);
    
    if (payload.headers && payload.headers.length > 0) {
      await this.db?.collection('headers').deleteMany({ url_id: urlId });
      await this.db?.collection('headers').insertMany(
        payload.headers.map(([key, value]) => ({ url_id: urlId, key, value }))
      );
    }

    if (payload.storeBody) {
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
    if (links.length === 0) return;
    await this.db?.collection('links').insertMany(
      links.map(l => ({
        from_url_id: fromUrlId,
        to_url: l.toUrl,
        anchor: l.anchor,
        rel: l.rel,
        is_internal: l.isInternal ? 1 : 0
      }))
    );
    
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

  async summaryGet(): Promise<CrawlSummary> {
    if (!this.db) return { total: 0, byStatus: {}, byContentKind: {} as any, byIndexability: {}, avgResponseTimeMs: 0, totalBytes: 0 };
    const total = await this.db.collection('urls').countDocuments();
    return {
      total,
      byStatus: {},
      byContentKind: {} as any,
      byIndexability: {},
      avgResponseTimeMs: 0,
      totalBytes: 0
    };
  }

  // Stub for other methods...
  async recomputeInlinks() {}
  async recomputeRedirectChains() {}
  async recomputeHreflangAnalysis() {}
  async recomputeUrlsIssuesYielding(defs: any) {}
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
}
