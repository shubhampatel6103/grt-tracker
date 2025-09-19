import { getCollections } from '../mongodb';
import { BusStopData } from '@/types/busStop';

export async function getAllBusStops(): Promise<BusStopData[]> {
  try {
    const { busStops } = await getCollections();
    const stops = await busStops.find({}).toArray();
    return stops as BusStopData[];
  } catch (error) {
    console.error('Error fetching bus stops:', error);
    throw new Error('Failed to fetch bus stops');
  }
}

export async function getBusStopById(stopId: number): Promise<BusStopData | null> {
  try {
    const { busStops } = await getCollections();
    const stop = await busStops.findOne({ StopID: stopId });
    return stop as BusStopData | null;
  } catch (error) {
    console.error('Error fetching bus stop by ID:', error);
    throw new Error('Failed to fetch bus stop');
  }
}

export async function searchBusStops(query: string): Promise<BusStopData[]> {
  try {
    const { busStops } = await getCollections();
    const stops = await busStops.find({
      $or: [
        { Street: { $regex: query, $options: 'i' } },
        { CrossStreet: { $regex: query, $options: 'i' } },
        { Municipality: { $regex: query, $options: 'i' } },
        { StopID: { $eq: parseInt(query) || 0 } }
      ]
    }).toArray();
    return stops as BusStopData[];
  } catch (error) {
    console.error('Error searching bus stops:', error);
    throw new Error('Failed to search bus stops');
  }
}
