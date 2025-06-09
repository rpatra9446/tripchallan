import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/prisma/enums";
import { formatTimestampExact } from "@/lib/date-utils";

// Debug route to check for hardcoded timestamps
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      // Get a single session to test
      const session = await prisma.session.findFirst({
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
          sealTags: true
        }
      });

      if (!session) {
        return NextResponse.json({ error: "No sessions found" }, { status: 404 });
      }

      // Process dates - find any that match Jan 15, 2024 14:30:22
      const hardcodedDateString = "Jan 15, 2024 14:30:22";
      const jan15Date = new Date("2024-01-15T14:30:22.000Z");
      
      // Check all dates in the session
      const dateChecks = {
        sessionCreatedAt: {
          value: session.createdAt.toISOString(),
          formatted: formatTimestampExact(session.createdAt),
          isJan15: formatTimestampExact(session.createdAt) === hardcodedDateString
        }
      };

      // Check field timestamps
      const fieldTimestampChecks = session.fieldTimestamps.map(ft => ({
        fieldName: ft.fieldName,
        value: ft.timestamp.toISOString(),
        formatted: formatTimestampExact(ft.timestamp),
        isJan15: formatTimestampExact(ft.timestamp) === hardcodedDateString
      }));

      // Get activity logs for this session to check timestamps
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: session.id,
          targetResourceType: 'session'
        }
      });

      // Extract timestamp data from activity logs
      let timestampData = {};
      for (const log of activityLogs) {
        if (log.details && typeof log.details === 'object') {
          const details = log.details as any;
          if (details.timestamps) {
            // This could be loadingDetails, imagesForm, etc.
            timestampData = { ...timestampData, ...details.timestamps };
          }
        }
      }

      return NextResponse.json({
        sessionId: session.id,
        dateChecks,
        fieldTimestampChecks,
        timestampData,
        // Include essential data for formatting check
        fieldTimestampCount: session.fieldTimestamps.length,
        hasSealTags: session.sealTags.length > 0,
        activityLogCount: activityLogs.length
      });
    } catch (error) {
      console.error("[DEBUG API] Error:", error);
      return NextResponse.json(
        { error: "Failed to check for hardcoded timestamps", details: error },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 