'use client';

import { useEffect, useState } from 'react';
import { webApi } from '@/lib/api';

export default function Home() {
  const [summary, setSummary] = useState<any>(null);
  const [url, setUrl] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const s = await webApi.summaryGet();
        setSummary(s);
      } catch (err) {
        console.error('Failed to fetch summary');
      }
    };
    fetchSummary();
    const timer = setInterval(fetchSummary, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleStart = async () => {
    if (!url.trim()) {
      setError('PLEASE_ENTER_TARGET_URL');
      return;
    }
    try {
      setError(null);
      setCrawling(true);
      const res = await webApi.crawlStart({
        startUrl: url,
        maxDepth: 2,
        maxConcurrency: 5,
        maxRps: 2
      } as any) as any;
      
      if (res?.error) {
        setError(res.error);
        setCrawling(false);
      }
    } catch (err: any) {
      setError(err.message || 'ENGINE_FAILURE');
      setCrawling(false);
    }
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
            <div className="flex gap-0 border border-zinc-800 mb-4">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-black text-white px-6 py-4 focus:outline-none placeholder:text-zinc-800 border-r border-zinc-800"
                placeholder="https://example.com"
              />
              <button
                onClick={handleStart}
                disabled={crawling}
                className="bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 px-10 py-4 font-black uppercase tracking-tighter transition-all active:scale-95"
              >
                {crawling ? 'EXEC_ACTIVE' : 'RUN_CRAWL'}
              </button>
            </div>
            
            {error && (
              <div className="bg-red-950/30 border border-red-900 p-4 text-red-500 text-[10px] font-bold uppercase tracking-widest mb-4">
                ERROR :: {error}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-zinc-950 p-6 border border-zinc-800">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-4 flex justify-between">
                <span>Live_System_Logs</span>
                <span className="text-zinc-800">RDY_0.1</span>
              </h2>
              <div className="h-48 overflow-y-auto space-y-1 font-mono text-[9px] text-zinc-500">
                <p>{`> [${new Date().toLocaleTimeString()}] KERNEL_INIT_SUCCESS`}</p>
                <p>{`> [${new Date().toLocaleTimeString()}] MONGO_ATLAS_CONNECTED`}</p>
                {crawling && <p className="text-white animate-pulse">{`> [${new Date().toLocaleTimeString()}] CRAWL_ENGINE_ACTIVE_STREAMING`}</p>}
                <p>{`> [STBY] WAITING_FOR_INPUT...`}</p>
              </div>
            </section>

            <section className="bg-zinc-950 p-6 border border-zinc-800">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-4">Engine_Metrics</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-zinc-900 p-4">
                  <p className="text-[8px] text-zinc-700 uppercase font-bold">Threads</p>
                  <p className="text-xl font-black">05/05</p>
                </div>
                <div className="border border-zinc-900 p-4">
                  <p className="text-[8px] text-zinc-700 uppercase font-bold">Memory</p>
                  <p className="text-xl font-black">124MB</p>
                </div>
                <div className="border border-zinc-900 p-4">
                  <p className="text-[8px] text-zinc-700 uppercase font-bold">Uptime</p>
                  <p className="text-xl font-black">99.9%</p>
                </div>
                <div className="border border-zinc-900 p-4">
                  <p className="text-[8px] text-zinc-700 uppercase font-bold">Region</p>
                  <p className="text-xl font-black">US_EAST</p>
                </div>
              </div>
            </section>
          </div>

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
