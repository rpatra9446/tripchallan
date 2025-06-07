import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// GET /api/sessions/[id]/comments
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }
    
    // Get session ID from params
    const sessionId = params.id;
    
    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    
    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Fetch comments for the session
    const comments = await prisma.comment.findMany({
      where: { sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json(comments);
  } catch (error: any) {
    console.error("Error fetching session comments:", error);
    
    return NextResponse.json(
      { error: `Failed to fetch session comments: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST /api/sessions/[id]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }
    
    // Parse request body
    const data = await request.json();
    
    // Get session ID from params
    const sessionId = params.id;
    
    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    
    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Create new comment
    const comment = await prisma.comment.create({
      data: {
        sessionId,
        userId: session.user.id,
        message: data.message,
        imageUrl: data.imageUrl,
        urgency: data.urgency || "NA",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
          },
        },
      },
    });
    
    return NextResponse.json(comment, { status: 201 });
  } catch (error: any) {
    console.error("Error creating comment:", error);
    
    return NextResponse.json(
      { error: `Failed to create comment: ${error.message}` },
      { status: 500 }
    );
  }
} 