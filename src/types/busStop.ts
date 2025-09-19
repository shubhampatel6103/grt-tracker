export interface BusStop {
  stopNumber: string;
  stopName: string;
  direction: string;
  routeNumber: string[];
}

export interface BusStopData {
  _id: string;
  X: number;
  Y: number;
  StopID: number;
  Street?: string;
  CrossStreet?: string;
  Easting: number;
  Northing: number;
  Longitude: number;
  Latitude: number;
  Municipality?: string;
}

export interface FavoriteBusStop {
  _id?: string;
  userId: string;
  stopId: number;
  customName: string;
  createdAt: Date;
  updatedAt: Date;
} 