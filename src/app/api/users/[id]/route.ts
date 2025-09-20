import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/mongodb";
import { UpdateUserData } from "@/types/user";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { users } = await getCollections();

    const userId = (await params).id;
    const updateData: UpdateUserData = await request.json();

    // Validate ObjectId
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // Remove sensitive fields that shouldn't be updated here
    const { password, ...safeUpdateData } = updateData;

    // Update user
    const result = await users.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: {
          ...safeUpdateData,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: "User updated successfully" 
    });

  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}