import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/prisma/enums";

// Debug route to get raw session data
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      // Get the session ID from the query string if provided
      const { searchParams } = new URL(req.url);
      const sessionId = searchParams.get('id');
      
      let query: any = {
        include: {
          fieldTimestamps: {
            include: {
              updatedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          sealTags: true,
          company: {
            select: {
              id: true,
              name: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      };
      
      // If a specific session ID was provided, use it
      if (sessionId) {
        query.where = { id: sessionId };
      }
      
      // Get either a specific session or the first session
      const session = sessionId
        ? await prisma.session.findUnique(query)
        : await prisma.session.findFirst(query);

      if (!session) {
        return NextResponse.json({ error: "No session found" }, { status: 404 });
      }

      // Get activity logs for this session to check timestamps
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: session.id,
          targetResourceType: 'session'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Extract timestamp data from activity logs
      let timestampData = {};
      let tripDetails = {};
      
      for (const log of activityLogs) {
        if (log.details && typeof log.details === 'object') {
          const details = log.details as any;
          
          if (details.timestamps) {
            // This could contain loadingDetails, imagesForm, etc.
            timestampData = { ...timestampData, ...details.timestamps };
          }
          
          if (details.tripDetails) {
            tripDetails = { ...tripDetails, ...details.tripDetails };
          }
        }
      }

      // Process the raw data
      const rawSession = {
        ...session,
        activityLogs: activityLogs.map(log => ({
          id: log.id,
          action: log.action,
          createdAt: log.createdAt,
          details: log.details
        })),
        extractedData: {
          timestampData,
          tripDetails
        }
      };

      // Use type assertion to safely access session properties
      const fieldTimestampCount = (session as any).fieldTimestamps?.length || 0;
      const activityLogCount = activityLogs.length;

      return NextResponse.json({
        session: rawSession,
        fieldTimestampCount,
        activityLogCount
      });
    } catch (error) {
      console.error("[DEBUG API] Error:", error);
      return NextResponse.json(
        { error: "Failed to retrieve session data", details: error },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 