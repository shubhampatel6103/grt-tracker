import { NextRequest, NextResponse } from 'next/server';
import { removeFavorite, updateFavoriteName } from '@/lib/services/favoriteService';

export async function DELETE(request: NextRequest, { params }: { params: { stopId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    const stopId = parseInt(params.stopId);
    if (isNaN(stopId)) {
      return NextResponse.json(
        { error: 'Invalid stop ID' },
        { status: 400 }
      );
    }
    
    await removeFavorite(userId, stopId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in favorites DELETE API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove favorite' },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { stopId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { customName } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    if (!customName) {
      return NextResponse.json(
        { error: 'Custom name is required' },
        { status: 400 }
      );
    }
    
    const stopId = parseInt(params.stopId);
    if (isNaN(stopId)) {
      return NextResponse.json(
        { error: 'Invalid stop ID' },
        { status: 400 }
      );
    }
    
    await updateFavoriteName(userId, stopId, customName);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in favorites PUT API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update favorite' },
      { status: 400 }
    );
  }
}
