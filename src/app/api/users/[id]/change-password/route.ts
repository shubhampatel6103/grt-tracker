import { NextRequest, NextResponse } from 'next/server';
import { changeUserPassword } from '@/lib/services/userService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { currentPassword, newPassword } = await request.json();
    
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }
    
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long' },
        { status: 400 }
      );
    }
    
    const userId = (await params).id;
    
    await changeUserPassword(userId, currentPassword, newPassword);
    
    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error in change password API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to change password' },
      { status: 400 }
    );
  }
}