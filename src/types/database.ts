import { Collection, Db } from 'mongodb';
import { User } from './user';
import { BusStop, BusStopData } from './busStop';

export interface DatabaseCollections {
  users: Collection<User>;
  busStops: Collection<BusStopData>;
}

export interface Database {
  db: Db;
  collections: DatabaseCollections;
}
