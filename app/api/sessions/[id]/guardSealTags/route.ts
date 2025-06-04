import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const sessionId = params.id;

    // Fetch guard seal tags for the session
    const guardSealTags = await prisma.guardSealTag.findMany({
      where: { sessionId },
      include: {
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        media: {
          select: {
            id: true,
            type: true,
            mimeType: true,
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json(guardSealTags);
  } catch (error) {
    console.error("Error fetching guard seal tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch guard seal tags" },
      { status: 500 }
    );
  }
}

// This is a compatibility endpoint that forwards to the new sealTags/verify endpoint
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    // Forward the request to the new endpoint
    const response = await fetch(`${req.nextUrl.origin}/api/sessions/${sessionId}/sealTags/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
      },
      body: req.body
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error in compatibility endpoint:", error);
    return NextResponse.json(
      { error: "Failed to verify seal tag" },
      { status: 500 }
    );
  }
} 