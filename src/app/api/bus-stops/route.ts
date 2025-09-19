import { NextRequest, NextResponse } from 'next/server';
import { getAllBusStops, searchBusStops } from '@/lib/services/busStopService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    let busStops;
    if (query) {
      busStops = await searchBusStops(query);
    } else {
      busStops = await getAllBusStops();
    }
    
    return NextResponse.json(busStops);
  } catch (error) {
    console.error('Error in bus-stops API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bus stops' },
      { status: 500 }
    );
  }
}
