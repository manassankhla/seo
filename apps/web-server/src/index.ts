import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { join } from 'path';
import { Crawler } from '@freecrawl/core';
import { ProjectDb } from '@freecrawl/db';
import type { CrawlProgress, CrawlSummary } from '@freecrawl/shared-types';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const dbPath = './test-project.seoproject';
const db = new ProjectDb(dbPath);
db.reset(); // clear DB on start for testing

let activeCrawler: Crawler | null = null;

// Helper to format logs for the frontend
let logIdSeq = 0;
function emitLog(level: 'debug' | 'info' | 'warn' | 'error', source: string, message: string) {
  const entry = {
    id: ++logIdSeq,
    ts: new Date().toISOString(),
    level,
    source,
    message
  };
  io.emit('logs:batch', [entry]); // Match the IPC logs:batch shape
}

// Map endpoints for FreeCrawlApi

// Generic RPC Endpoint mapping all remaining API calls to ProjectDb
app.post('/api/rpc/:method', async (req, res) => {
  const method = req.params.method;
  const input = req.body;
  try {
    let result;
    switch (method) {
      case 'crawlStop':
        if (activeCrawler) { await activeCrawler.stop(); activeCrawler = null; }
        result = { success: true };
        break;
      case 'crawlPause':
        if (activeCrawler) { activeCrawler.pause(); }
        result = { success: true };
        break;
      case 'crawlResume':
        if (activeCrawler) { activeCrawler.resume(); }
        result = { success: true };
        break;
      case 'crawlClear':
        if (activeCrawler) { await activeCrawler.stop(); activeCrawler = null; }
        db.reset();
        result = { success: true };
        break;
      case 'urlsQuery': result = db.queryUrls(input); break;
      case 'urlDetailGet': result = db.getUrlDetail(input.id, input.linkLimit ?? 500); break;
      case 'urlSourceGet': {
         const r = db.getUrlSource(input.id);
         result = r || { body: null, bodyLength: 0, truncated: false, capturedAt: null };
         break;
      }
      case 'urlPageImages': result = { rows: db.pageImagesDetailed(input.id, input.limit ?? 5000) }; break;
      case 'urlCertInfo': {
         const r = db.getHostCertForUrl(input.id);
         result = r || { host: null, validFrom: null, validTo: null, daysUntilExpiry: null, issuer: null, subject: null, signatureAlgorithm: null, protocol: null, probeStatus: -1, probeError: null, probedAt: null };
         break;
      }
      case 'imagesQuery': result = db.queryImages(input); break;
      case 'brokenLinksQuery': result = db.queryBrokenLinks(input); break;
      case 'overviewGet': result = await db.getOverviewCountsAsync(); break;
      case 'summaryGet': result = db.getSummary(); break;
      case 'reportsPagesPerDirectory': result = db.getPagesPerDirectory({ depth: input.depth ?? 1, limit: input.limit ?? 500 }); break;
      case 'reportsStatusCodeHistogram': result = db.getStatusCodeHistogram(); break;
      case 'reportsDepthHistogram': result = db.getDepthHistogram(); break;
      case 'reportsResponseTimeHistogram': result = db.getResponseTimeHistogram(); break;
      case 'reportsTopUrls': {
         const col = input.metric === 'response-time' ? 'response_time_ms' : input.metric === 'inlinks' ? 'inlinks' : input.metric === 'outlinks' ? 'outlinks' : input.metric === 'depth' ? 'depth' : 'content_length';
         result = db.topUrlsBy(col as any, input.limit ?? 25);
         break;
      }
      case 'reportsExternalDomainHealth': result = db.externalDomainHealth(input.limit ?? 100); break;
      case 'reportsAnalyticsCoverage': result = db.analyticsCoverage(); break;
      case 'reportsLinkPositions': result = db.linkPositionBreakdown(); break;
      case 'reportsImageWeightPerPage': result = db.imageWeightPerPage(input.limit ?? 25); break;
      case 'reportsInlinksHistogram': result = db.inlinksHistogram(); break;
      case 'reportsWordCountHistogram': result = db.wordCountHistogram(); break;
      case 'reportsUrlLengthHistogram': result = db.urlLengthHistogram(); break;
      case 'reportsWordCountPerDirectory': result = db.wordCountPerDirectory({ depth: input.depth ?? 1, limit: input.limit ?? 500 }); break;
      case 'reportsSitemapOrphans': result = db.sitemapOrphans(input.limit ?? 1000); break;
      case 'reportsServerHeaders': result = db.serverHeaderBreakdown(); break;
      case 'graphSnapshot': result = db.graphSnapshot(input.nodeLimit ?? 1000); break;
      case 'topAnchorTexts': result = db.topAnchorTexts(input.limit ?? 1000); break;
      default:
        res.status(404).json({ error: `Method ${method} not implemented` });
        return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 3. Start Crawl
app.post('/api/crawl/start', async (req, res) => {
  const config = req.body;
  
  if (activeCrawler) {
    await activeCrawler.stop();
  }
  
  // Re-init db for a fresh start in testing
  db.reset();

  activeCrawler = new Crawler(config, db, {
    parseHtml: async (html: string, url: string, opts: any) => {
      // In web server, use inline parser or worker thread if available
      const { parseHtml } = await import('@freecrawl/core');
      return parseHtml(html, url, opts);
    },
    writeFetchedUrl: async (payload: any) => {
      const result = db.writeFetchedUrl(payload);
      io.emit('data:changed');
      return result;
    },
  });

  activeCrawler.on('progress', (p: CrawlProgress) => io.emit('crawl:progress', p));
  activeCrawler.on('done', (summary: CrawlSummary) => io.emit('crawl:done', summary));
  activeCrawler.on('error', (msg: string) => {
    console.error('Crawler emitted error:', msg);
    emitLog('error', 'crawler', msg);
    io.emit('crawl:error', msg);
  });
  activeCrawler.on('warn', (msg: string) => emitLog('warn', 'crawler', msg));
  activeCrawler.on('info', (msg: string) => emitLog('info', 'crawler', msg));
  activeCrawler.on('debug', (msg: string) => emitLog('debug', 'crawler', msg));

  activeCrawler.start().catch(e => {
    console.error("Crawl error", e);
    emitLog('error', 'crawler', String(e));
  });
  
  res.json({ success: true });
});

// Serve frontend static files in production
const frontendDistPath = join(__dirname, '../../desktop/dist');
app.use(express.static(frontendDistPath));

// Fallback for React Router
app.get('*', (req, res) => {
  res.sendFile(join(frontendDistPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Web Backend running on port ${PORT}`);
});
