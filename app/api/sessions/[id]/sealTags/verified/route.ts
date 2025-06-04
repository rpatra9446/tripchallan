import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

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

    // Fetch verified seal tags for the session
    const verifiedSealTags = await prisma.sealTag.findMany({
      where: { 
        sessionId,
        guardUserId: { not: null } // Only get tags verified by guards
      },
      include: {
        guardUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json(verifiedSealTags);
  } catch (error) {
    console.error("Error fetching verified seal tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch verified seal tags" },
      { status: 500 }
    );
  }
} 