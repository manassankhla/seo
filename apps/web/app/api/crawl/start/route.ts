import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Crawler } from '@freecrawl/core';

let activeCrawler: any = null;

export async function POST(request: NextRequest) {
  const config = await request.json();
  const db = await getDb();

  // In a serverless environment, this 'activeCrawler' won't persist across requests.
  // To make this work on Vercel, you'd need a background job worker.
  // For now, we'll implement it so it *starts*, but it will likely time out.
  
  if (activeCrawler) {
    // In serverless, this is unlikely to be the same instance, but good practice
    // await activeCrawler.stop();
  }

  const crawler = new Crawler(config, db as any, {
    writeFetchedUrl: async (payload) => {
      return db.writeFetchedUrl(payload);
    }
  });

  // We don't await crawler.start() here because it would time out the request.
  // We fire and forget, knowing it might be killed.
  crawler.start().catch(console.error);

  return NextResponse.json({ success: true, message: 'Crawl started (Note: Serverless environments may kill long-running crawls)' });
}
