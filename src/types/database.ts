import { Collection, Db } from 'mongodb';
import { User } from './user';
import { BusStopData, FavoriteBusStop } from './busStop';

export interface DatabaseCollections {
  users: Collection<User>;
  busStops: Collection<BusStopData>;
  favoriteBusStops: Collection<FavoriteBusStop>;
}

export interface Database {
  db: Db;
  collections: DatabaseCollections;
}
