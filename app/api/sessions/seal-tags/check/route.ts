import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the tagId from the query parameters
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
    }

    console.log(`[API DEBUG] Checking if seal tag '${tagId}' exists`);

    // Check if the seal tag exists in any session using the updated SealTag model
    const existingSealTag = await prisma.sealTag.findFirst({
      where: {
        barcode: tagId,
      },
    });

    console.log(`[API DEBUG] Seal tag '${tagId}' exists: ${!!existingSealTag}`);

    // Return whether the tag exists
    return NextResponse.json({ exists: !!existingSealTag });
  } catch (error) {
    console.error('Error checking seal tag existence:', error);
    return NextResponse.json(
      { error: 'An error occurred while checking the seal tag' },
      { status: 500 }
    );
  }
} 