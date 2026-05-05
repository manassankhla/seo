import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Crawler } from '@freecrawl/core';

let activeCrawler: any = null;

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    console.log('--- CRAWL START REQUEST ---');
    console.log('Config:', JSON.stringify(config, null, 2));
    
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
    console.error('API ROUTE ERROR:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
