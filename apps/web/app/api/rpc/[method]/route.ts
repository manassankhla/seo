import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { method: string } }
) {
  const method = (await params).method;
  const input = await request.json().catch(() => ({}));
  const db = await getDb();

  try {
    // Dynamically call the method on the DB class
    if (typeof (db as any)[method] === 'function') {
      const result = await (db as any)[method](input);
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: `Method ${method} not found` }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
