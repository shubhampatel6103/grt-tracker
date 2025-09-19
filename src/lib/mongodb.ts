import { MongoClient, Db } from 'mongodb';
import { DatabaseCollections } from '@/types/database';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is not set');
}
if (!process.env.MONGODB_DB) {
  throw new Error('MONGODB_DB is not set');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(process.env.MONGODB_DB);
}

export async function getCollections(): Promise<DatabaseCollections> {
  const db = await getDb();
  return {
    users: db.collection('users'),
    busStops: db.collection('busStops'),
  };
}