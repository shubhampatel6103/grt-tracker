import { Collection, Db } from 'mongodb';
import { User } from './user';
import { BusStop } from './busStop';

export interface DatabaseCollections {
  users: Collection<User>;
  busStops: Collection<BusStop>;
}

export interface Database {
  db: Db;
  collections: DatabaseCollections;
}
