import { NextRequest, NextResponse } from 'next/server';
import { getUserFavorites, addFavorite } from '@/lib/services/favoriteService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    const favorites = await getUserFavorites(userId);
    return NextResponse.json(favorites);
  } catch (error) {
    console.error('Error in favorites GET API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, stopId, customName } = await request.json();
    
    if (!userId || !stopId || !customName) {
      return NextResponse.json(
        { error: 'User ID, stop ID, and custom name are required' },
        { status: 400 }
      );
    }
    
    const favorite = await addFavorite(userId, stopId, customName);
    return NextResponse.json(favorite);
  } catch (error) {
    console.error('Error in favorites POST API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add favorite' },
      { status: 400 }
    );
  }
}
