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
    console.log('DB Connected');

    const crawler = new Crawler(config, db as any, {
      writeFetchedUrl: async (payload) => {
        console.log('Writing fetched URL:', payload?.upsert?.url);
        return db.writeFetchedUrl(payload);
      }
    });

    // We don't await crawler.start() here because it would time out the request.
    // We fire and forget, knowing it might be killed.
    console.log('Starting crawler engine...');
    crawler.start().catch(err => {
      console.error('CRAWLER ENGINE ERROR:', err);
    });

    return NextResponse.json({ success: true, message: 'Crawl started' });
  } catch (err: any) {
    console.error('--- !!! API ROUTE FATAL ERROR !!! ---');
    console.error('Name:', err?.name);
    console.error('Message:', err?.message);
    console.error('Code:', err?.code);
    console.error('Stack:', err?.stack);
    console.error('---------------------------------------');
    return NextResponse.json({ 
      success: false, 
      error: err?.message || 'INTERNAL_SERVER_ERROR',
      debug_code: err?.code
    }, { status: 500 });
  }
}
