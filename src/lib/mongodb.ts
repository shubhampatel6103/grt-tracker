import { MongoClient, Db } from 'mongodb';
import { DatabaseCollections } from '@/types/database';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  throw new Error('MONGODB_URI is not set');
}
if (!process.env.MONGODB_DB) {
  console.error('MONGODB_DB environment variable is not set');
  throw new Error('MONGODB_DB is not set');
}

const uri = process.env.MONGODB_URI;
const options = {
  // Connection options
  retryWrites: true,
  w: 'majority' as const,
  retryReads: true,
  // Additional options for better connection stability
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
};

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
  try {
    const connectedClient = await clientPromise;
    return connectedClient.db(process.env.MONGODB_DB);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Re-throw with a more descriptive error
    throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getCollections(): Promise<DatabaseCollections> {
  const db = await getDb();
  return {
    users: db.collection('users'),
    busStops: db.collection('busStops'),
    favoriteBusStops: db.collection('favoriteBusStops'),
  };
}