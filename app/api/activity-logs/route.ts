import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { getActivityLogs } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";

// Define the ActivityLog type here to match what's returned from the database
type ActivityLog = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  targetResourceType?: string;
  targetResourceId?: string;
  userId: string;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  targetUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

async function handler(req: NextRequest) {
  // Debug flags for testing
  const url = new URL(req.url);
  const bypassPermissions = url.searchParams.get("debug") === "true";
  
  if (bypassPermissions) {
    console.log("DEBUG MODE: Bypassing permission filters for activity logs");
  }
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const userId = url.searchParams.get("userId") || undefined;
    const action = url.searchParams.get("action") || undefined;
    const targetResourceType = url.searchParams.get("targetResourceType") || undefined;
    const targetResourceId = url.searchParams.get("targetResourceId") || undefined;
    const deviceType = url.searchParams.get("deviceType") || undefined;
    
    // Parse date parameters if provided
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    
    if (url.searchParams.get("fromDate")) {
      fromDate = new Date(url.searchParams.get("fromDate")!);
    }
    
    if (url.searchParams.get("toDate")) {
      toDate = new Date(url.searchParams.get("toDate")!);
    }
    
    // Filter options based on user role
  const userIds: string[] = [];
  
  // DEBUG MODE: Skip permission filtering when debug flag is set
  if (bypassPermissions) {
    console.log("DEBUG MODE: Skipping user ID filtering for activity logs");
    // Continue with no userIds filter, which will return all logs
  } else {
    
    // SUPERADMIN can see activity for all users - no filtering needed
    if (session.user.role === UserRole.SUPERADMIN) {
      // If a specific userId filter was requested, use that
      if (userId) {
        userIds.push(userId);
      }
      // For SUPERADMIN, don't apply any userId filtering
      // No additional filtering needed - SUPERADMIN sees all activities
    }
    // ADMIN can see activity for users they created, so get those user IDs
    else if (session.user.role === UserRole.ADMIN) {
      if (userId) {
        // Check if this admin created the requested user
        const requestedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { createdById: true, role: true }
        });
        
        if (requestedUser?.createdById === session.user.id) {
          userIds.push(userId);
        } else {
          // If they didn't create this user, they can't see their activity
          return NextResponse.json({
            logs: [],
            meta: {
              currentPage: page,
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: limit,
              hasNextPage: false,
              hasPrevPage: false,
            }
          });
        }
      } else {
        // Get all users created by this admin (COMPANY and EMPLOYEE only)
        const createdUsers = await prisma.user.findMany({
          where: { 
            createdById: session.user.id,
            role: { in: [UserRole.COMPANY, UserRole.EMPLOYEE] }
          },
          select: { id: true }
        });
        
        // Add IDs of COMPANY and EMPLOYEE users they created
        userIds.push(...createdUsers.map((user: { id: string }) => user.id));
        
        // Important: Include the ADMIN's own ID to see their activities too
        // This lets admins see when they create users
        userIds.push(session.user.id);
      }
    }
    // COMPANY can see activity for their employees
    else if (session.user.role === UserRole.COMPANY) {
      if (userId) {
        // Check if this employee belongs to this company
        const employee = await prisma.user.findUnique({
          where: { 
            id: userId,
            role: UserRole.EMPLOYEE,
            companyId: session.user.companyId || undefined
          },
          select: { id: true }
        });
        
        if (employee) {
          userIds.push(userId);
        } else {
          // If this isn't their employee, they can only see their own non-login/logout activity
          return NextResponse.json({
            logs: [],
            meta: {
              currentPage: page,
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: limit,
              hasNextPage: false,
              hasPrevPage: false,
            }
          });
        }
      } else {
        // Get all employees for this company
        const employees = await prisma.user.findMany({
          where: { 
            role: UserRole.EMPLOYEE,
            companyId: session.user.companyId || undefined
          },
          select: { id: true }
        });
        
        // Add employee IDs to userIds for all types of activities (not just login/logout)
        // This ensures company can see all employee activities including session creation
        userIds.push(...employees.map((emp: { id: string }) => emp.id));
        
        // For non-login/logout activities, include the company's own ID too
        userIds.push(session.user.id);
      }
    }
    // EMPLOYEE can only see their own activity (excluding login/logout)
    else {
      if (action === "LOGIN" || action === "LOGOUT") {
        // Employees can't see any login/logout activities
        // Return empty result
        return NextResponse.json({
          logs: [],
          meta: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
            hasNextPage: false,
            hasPrevPage: false,
          }
        });
      } else {
        // For other types of activities, employees can see their own
        userIds.push(session.user.id);
      }
    }
    
      } // End of permission filtering
  
  // Get activity logs based on filtered user IDs
    let result: {
      logs: ActivityLog[];
      meta: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    };

    // Always fetch logs for SUPERADMIN or when in debug mode, even if userIds array is empty
    if (userIds.length > 0 || session.user.role === UserRole.SUPERADMIN || bypassPermissions) {
      // Custom filtering for deviceType if provided
      let customWhere: Record<string, unknown> | undefined = undefined;
      
      if (deviceType && (deviceType === 'mobile' || deviceType === 'desktop')) {
        // We need a custom where clause for this because it's within JSON
        customWhere = {
          OR: [
            {
              // Check device type in details JSON field (for newer format)
              details: {
                path: ['device'],
                equals: deviceType
              }
            },
            {
              // For login/logout activity with specific device type
              AND: [
                {
                  action: {
                    in: ['LOGIN', 'LOGOUT']
                  }
                },
                {
                  // Filter by userAgent for legacy records
                  userAgent: deviceType === 'mobile' 
                    ? { contains: 'mobile|android|iphone|ipad|ipod|blackberry', mode: 'insensitive' }
                    : { not: { contains: 'mobile|android|iphone|ipad|ipod|blackberry' } }
                }
              ]
            }
          ]
        };
      }
      
      // Log the query parameters to debug
      console.log("Activity logs query parameters:", {
        userId: userIds.length === 1 ? userIds[0] : undefined,
        userIds: userIds.length > 1 ? userIds : undefined,
        action,
        fromDate,
        toDate,
        deviceType
      });
      
      // Create an exclusion filter - but NOT for SUPERADMIN users
      let excludeSelfLoginFilter = {};
      
      // For SUPERADMIN, only exclude their own login/logout activities
      if (session.user.role === UserRole.SUPERADMIN) {
        excludeSelfLoginFilter = {
          NOT: {
            AND: [
              { userId: session.user.id },
              { action: { in: ['LOGIN', 'LOGOUT'] } }
            ]
          }
        };
      } else {
        // For other roles, exclude their login/logout as before
        excludeSelfLoginFilter = {
          NOT: {
            AND: [
              { userId: session.user.id },
              { action: { in: ['LOGIN', 'LOGOUT'] } }
            ]
          }
        };
      }
      
      // Merge the custom where clause with our self-exclusion filter
      if (customWhere) {
        customWhere = {
          AND: [
            customWhere,
            excludeSelfLoginFilter
          ]
        };
      } else {
        customWhere = excludeSelfLoginFilter;
      }
      
      // Add a special case for ADMIN to see their own CREATE activities
      if (session.user.role === UserRole.ADMIN) {
        // If no custom where clause exists yet, create one
        if (!customWhere) {
          customWhere = {};
        }

        // If userIds doesn't include admin's ID yet (e.g., for specific userId requests)
        // Modify the custom where to include the admin's CREATE activities
        if (!userIds.includes(session.user.id)) {
          customWhere = {
            OR: [
              customWhere,
              {
                AND: [
                  { userId: session.user.id },
                  { action: ActivityAction.CREATE }
                ]
              }
            ]
          };
        }
      }
      
      result = await getActivityLogs({
        action: action as ActivityAction | undefined,
        fromDate,
        toDate,
        targetResourceId,
        targetResourceType,
        page,
        limit,
        // For SUPERADMIN, don't filter by specific user IDs (see all users)
        userId: session.user.role === UserRole.SUPERADMIN ? undefined : (userIds.length === 1 ? userIds[0] : undefined),
        // For SUPERADMIN, don't filter by multiple user IDs (see all users)
        userIds: session.user.role === UserRole.SUPERADMIN ? undefined : (userIds.length > 1 ? userIds : undefined),
        // Always apply customWhere which has the correct filter for SUPERADMIN to exclude their own login/logout
        customWhere: customWhere,
        // CRITICAL: Always include auth activities by default
        includeAuthActivities: true
      });
    } else {
      // No visible users, return empty result
      result = {
        logs: [],
        meta: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNextPage: false,
          hasPrevPage: false,
        }
      };
    }
    
    // Debug log to help diagnose the issue
    if (result && result.logs) {
      console.log(`Returning ${result.logs.length} logs. Types:`, 
        [...new Set(result.logs.map((log: ActivityLog) => log.action))].join(', '));
      
      // Check specifically for login/logout activities
      const authActivities = result.logs.filter((log: ActivityLog) => 
        log.action === ActivityAction.LOGIN || log.action === ActivityAction.LOGOUT);
      console.log(`Auth activities in results: ${authActivities.length}`);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

// Allow only authenticated users
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE,
]); 