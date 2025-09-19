import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = await UserService.verifyLogin({ username, password });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Don't return the password
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json(
      { message: 'Login successful', user: userWithoutPassword },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
