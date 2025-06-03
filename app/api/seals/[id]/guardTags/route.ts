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

    const sealId = params.id;

    // Check if the seal exists
    const seal = await prisma.seal.findUnique({
      where: { id: sealId },
    });

    if (!seal) {
      return NextResponse.json({ error: "Seal not found" }, { status: 404 });
    }

    // First try to get guard seal tags from the new structured model
    const guardSealTags = await prisma.guardSealTag.findMany({
      where: { sealId },
      orderBy: { createdAt: 'asc' },
    });

    // If there are no guard seal tags in the new model, try to extract them from verificationData
    if (guardSealTags.length === 0 && seal.verificationData) {
      try {
        const verificationData = seal.verificationData as any;
        const extractedTags = [];

        // Handle legacy format with guardImages
        if (verificationData.guardImages) {
          for (const [key, value] of Object.entries(verificationData.guardImages)) {
            if (
              (key.toLowerCase().includes('seal') || key.toLowerCase().includes('tag') || key.toLowerCase().includes('barcode')) && 
              (typeof value === 'string' || (typeof value === 'object' && value !== null))
            ) {
              if (typeof value === 'string') {
                // Simple string value, assume it's an image URL
                extractedTags.push({
                  id: `extracted-${extractedTags.length}`,
                  barcode: key,
                  method: 'digital',
                  imageUrl: value,
                  createdAt: new Date().toISOString(),
                  verified: true
                });
              } else if (typeof value === 'object' && value !== null) {
                const valueObj = value as Record<string, any>;
                if (Array.isArray(value)) {
                  // Array of values, assume it's an array of images
                  value.forEach((item, index) => {
                    if (typeof item === 'string') {
                      extractedTags.push({
                        id: `extracted-${extractedTags.length}`,
                        barcode: `${key}_${index + 1}`,
                        method: 'digital',
                        imageUrl: item,
                        createdAt: new Date().toISOString(),
                        verified: true
                      });
                    }
                  });
                } else {
                  // Object with properties
                  extractedTags.push({
                    id: `extracted-${extractedTags.length}`,
                    barcode: valueObj.id || valueObj.barcode || key,
                    method: valueObj.method || 'digital',
                    imageUrl: valueObj.imageUrl || valueObj.image,
                    createdAt: new Date().toISOString(),
                    verified: valueObj.verified !== undefined ? valueObj.verified : true
                  });
                }
              }
            }
          }
        }
        
        return NextResponse.json(extractedTags);
      } catch (error) {
        console.error("Error extracting guard seal tags from verificationData:", error);
        // Just return empty array if extraction fails
        return NextResponse.json([]);
      }
    }

    return NextResponse.json(guardSealTags);
  } catch (error) {
    console.error("Error fetching guard seal tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch guard seal tags" },
      { status: 500 }
    );
  }
} 