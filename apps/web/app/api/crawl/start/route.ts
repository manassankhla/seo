import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Crawler } from '@freecrawl/core';

let activeCrawler: any = null;

export async function POST(request: NextRequest) {
  console.log('>>> [API] RECEIVED REQUEST AT /api/crawl/start');
  try {
    const rawBody = await request.text();
    console.log('>>> [API] RAW BODY:', rawBody);
    
    let config;
    try {
      config = JSON.parse(rawBody);
    } catch (pe) {
      console.error('>>> [API] JSON PARSE ERROR:', pe);
      return NextResponse.json({ success: false, error: 'Malformed JSON' }, { status: 400 });
    }

    console.log('>>> [API] CONFIG OBJECT:', JSON.stringify(config, null, 2));
    
    if (!config || typeof config !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid config payload' }, { status: 400 });
    }

    const db = await getDb();
    console.log('>>> [API] DB CONNECTED SUCCESSFULLY');

    // Inject safe defaults so the engine never crashes on missing required fields
    const crawlConfig = {
      userAgent: 'Mozilla/5.0 (compatible; FreeCrawlBot/0.2.7; +https://freecrawl.dev)',
      requestTimeoutMs: 15000,
      maxUrls: 500,
      maxDepth: 3,
      maxConcurrency: 5,
      maxRps: 2,
      retryAttempts: 2,
      retryInitialBackoffMs: 500,
      followRedirects: true,
      respectRobots: true,
      discoverSitemaps: false,
      storeNofollow: false,
      crawlExternal: false,
      includePatterns: [],
      excludePatterns: [],
      mode: 'spider' as const,
      ...config,
    };

    const crawler = new Crawler(crawlConfig, db as any, {
      writeFetchedUrl: async (payload: any) => {
        if (!payload) return { urlId: 0 };
        return db.writeFetchedUrl(payload);
      }
    });

    if (activeCrawler) {
      try { activeCrawler.stop(); } catch (e) {}
    }
    activeCrawler = crawler;

    // Attach event listeners BEFORE start() to prevent unhandledRejection crashes
    crawler.on('error', (msg: string) => {
      console.error('>>> [CRAWLER] ERROR:', msg);
    });
    crawler.on('warn', (msg: string) => {
      console.warn('>>> [CRAWLER] WARN:', msg);
    });
    crawler.on('info', (msg: string) => {
      console.log('>>> [CRAWLER] INFO:', msg);
    });

    console.log('>>> [API] STARTING CRAWLER ENGINE...');
    crawler.start().catch((err: unknown) => {
      console.error('>>> [API] CRAWLER RUNTIME ERROR:', err);
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Crawl started',
      debug_info: { startUrl: config.startUrl }
    });
  } catch (err: any) {
    const isSslError = err?.message?.includes('SSL') || err?.message?.includes('0A000438');
    const displayError = isSslError 
      ? 'MONGODB_IP_WHITELIST_ERROR: Please add your IP 157.48.247.16 to MongoDB Atlas Network Access.'
      : (err?.message || 'INTERNAL_SERVER_ERROR');

    console.error('--- !!! API ROUTE FATAL ERROR !!! ---');
    console.error('Error:', displayError);
    if (err?.stack) console.error('Stack:', err.stack);
    
    return NextResponse.json({ 
      success: false, 
      error: displayError,
      is_database_error: true
    }, { status: 500 });
  }
}
