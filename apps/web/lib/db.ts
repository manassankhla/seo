
import { ProjectDb } from '@freecrawl/db-mongodb';
import { InMemoryDb } from './in-memory-db';

let globalInMemoryDb: InMemoryDb | null = null;

export async function getDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.warn('[DB] MONGO_URI not configured. Falling back to InMemoryDb.');
    if (!globalInMemoryDb) {
      globalInMemoryDb = new InMemoryDb();
    }
    return globalInMemoryDb;
  }
  
  const db = new ProjectDb(uri, 'freecrawl');
  
  // Exponential backoff or simple retry for DNS issues
  let lastErr: Error | undefined;
  for (let i = 0; i < 3; i++) {
    try {
      await db.connect();
      return db;
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[DB] Connection attempt ${i+1} failed: ${lastErr.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.warn(`[DB] MongoDB connection failed: ${lastErr?.message || 'Unknown'}. Falling back to InMemoryDb.`);
  if (!globalInMemoryDb) {
    globalInMemoryDb = new InMemoryDb();
  }
  return globalInMemoryDb;
}

