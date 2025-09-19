import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  const db = await getDb();

  // Mirrors your isolated test: list collections
  const collections = await db.collections();
  const names = collections.map(c => c.collectionName);

  return NextResponse.json({ collections: names });
}