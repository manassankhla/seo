'use client';

import { useEffect, useState } from 'react';
import { webApi } from '@/lib/api';

export default function Home() {
  const [summary, setSummary] = useState<any>(null);
  const [url, setUrl] = useState('https://example.com');
  const [crawling, setCrawling] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      const s = await webApi.summaryGet();
      setSummary(s);
    };
    fetchSummary();
    const timer = setInterval(fetchSummary, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleStart = async () => {
    setCrawling(true);
    await webApi.crawlStart({
      startUrl: url,
      maxDepth: 2,
      maxConcurrency: 5,
      maxRps: 2
    } as any);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 border-b border-zinc-800 pb-8">
          <h1 className="text-5xl font-black tracking-tighter uppercase">
            SEO Spider <span className="text-zinc-600">v0.2.7</span>
          </h1>
          <p className="text-zinc-500 mt-2 uppercase text-xs tracking-widest font-bold">
            Cloud-Native Engine — High Performance SEO Auditing
          </p>
        </header>

        <main className="grid gap-8">
          <section className="bg-zinc-950 p-8 border border-zinc-800 shadow-2xl">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Execution Console</h2>
            <div className="flex gap-0 border border-zinc-800">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-black text-white px-6 py-4 focus:outline-none placeholder:text-zinc-700 border-r border-zinc-800"
                placeholder="TARGET_URL_STRING"
              />
              <button
                onClick={handleStart}
                disabled={crawling}
                className="bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 px-10 py-4 font-black uppercase tracking-tighter transition-all active:scale-95"
              >
                {crawling ? 'EXEC_ACTIVE' : 'RUN_CRAWL'}
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-zinc-800 bg-zinc-800">
            <div className="bg-black p-8 border-r border-zinc-800">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Index Counts</p>
              <p className="text-4xl font-black mt-2">{summary?.total || 0}</p>
            </div>
            <div className="bg-black p-8 border-r border-zinc-800">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Latency (avg)</p>
              <p className="text-4xl font-black mt-2 text-white">{summary?.avgResponseTimeMs || 0}<span className="text-lg">ms</span></p>
            </div>
            <div className="bg-black p-8">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Engine State</p>
              <p className={`text-4xl font-black mt-2 ${crawling ? 'text-white underline' : 'text-zinc-700'}`}>
                {crawling ? 'ACTIVE' : 'STBY'}
              </p>
            </div>
          </section>
          
          <div className="bg-zinc-900 border border-zinc-800 p-6 text-zinc-400 text-[10px] leading-relaxed uppercase tracking-wider font-bold">
            <span className="text-white bg-zinc-700 px-2 mr-2">NOTICE</span> 
            Crawler is running on high-availability railway cloud. Connection to MongoDB cluster is established via primary connection string.
          </div>
        </main>
      </div>
    </div>
  );
}
