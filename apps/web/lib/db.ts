import clientPromise from './mongodb';
import { ProjectDb } from '@freecrawl/db-mongodb';

export async function getDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Missing MONGO_URI');
  const db = new ProjectDb(uri, 'freecrawl');
  await db.connect(); // In a real app, we'd want to reuse the connection better
  return db;
}
