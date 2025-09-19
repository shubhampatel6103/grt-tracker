import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { busStopId, action } = body; // action: 'add' or 'remove'

    if (!busStopId || !action) {
      return NextResponse.json(
        { error: 'Bus stop ID and action are required' },
        { status: 400 }
      );
    }

    let user;
    if (action === 'add') {
      user = await UserService.addFavoriteBusStop(params.id, busStopId);
    } else if (action === 'remove') {
      user = await UserService.removeFavoriteBusStop(params.id, busStopId);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "add" or "remove"' },
        { status: 400 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: `Bus stop ${action}ed successfully`, user },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
