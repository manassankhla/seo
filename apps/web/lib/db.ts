
import { ProjectDb } from '@freecrawl/db-mongodb';

export async function getDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI_NOT_CONFIGURED');
  
  const db = new ProjectDb(uri, 'freecrawl');
  
  // Exponential backoff or simple retry for DNS issues
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      await db.connect();
      return db;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[DB] Connection attempt ${i+1} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  throw new Error(`DATABASE_CONNECTION_FAILED: ${lastErr?.message || 'Unknown'}. TIP: Check if IP 157.48.247.16 is whitelisted in MongoDB Atlas.`);
}
