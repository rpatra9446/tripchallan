import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ActivityAction, UserRole } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";

async function handleGet(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const adminId = context.params.id;

    // First check if a user with this ID exists at all
    const userExists = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, role: true }
    });

    if (!userExists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // If user exists but is not an admin
    if (userExists.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "User exists but is not an admin" },
        { status: 400 }
      );
    }

    // Get admin user details
    const admin = await prisma.user.findUnique({
      where: { 
        id: adminId,
        role: UserRole.ADMIN 
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        coins: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Find companies created by this admin by querying users with createdById field
    const companies = await prisma.user.findMany({
      where: {
        role: UserRole.COMPANY,
        createdById: adminId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    }).catch((err: Error) => {
      console.error("Error fetching companies:", err);
      return [];
    });

    // Find employees created by this admin by querying users with createdById field
    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        createdById: adminId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        coins: true,
        role: true,
        subrole: true,
        company: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    }).catch((err: Error) => {
      console.error("Error fetching employees:", err);
      return [];
    });

    // Get company IDs for all companies created by this admin
    const companyIds = companies.map((company: { id: string }) => company.id);
    
    // Find operators created by this admin
    const operators = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        subrole: "OPERATOR",
        createdById: adminId,
      },
      select: {
        id: true,
      },
    }).catch((err: Error) => {
      console.error("Error fetching operators:", err);
      return [];
    });

    const operatorIds = operators.map((operator: { id: string }) => operator.id);
    
    // Count sessions for companies created by this admin
    // OR sessions created by operators created by this admin
    let sessionCount = 0;
    
    // Build the OR condition
    const sessionWhereClause: {
      OR: Array<{ companyId?: { in: string[] }; createdById?: { in: string[] } }>
    } = { OR: [] };
    
    if (companyIds.length > 0) {
      sessionWhereClause.OR.push({
        companyId: {
          in: companyIds
        }
      });
    }
    
    if (operatorIds.length > 0) {
      sessionWhereClause.OR.push({
        createdById: {
          in: operatorIds
        }
      });
    }
    
    // Only run the query if we have actual OR conditions
    if (sessionWhereClause.OR.length > 0) {
      sessionCount = await prisma.session.count({
        where: sessionWhereClause
      }).catch((err: Error) => {
        console.error("Error counting sessions:", err);
        return 0;
      });
    }

    return NextResponse.json({
      ...admin,
      createdCompanies: companies,
      createdEmployees: employees,
      stats: {
        totalCompanies: companies.length,
        totalEmployees: employees.length,
        totalSessions: sessionCount
      }
    });
  } catch (error) {
    console.error("Error fetching admin details:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Failed to fetch admin details: ${errorMessage}` },
      { status: 500 }
    );
  }
}

async function handleDelete(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const adminId = context.params.id;
    console.log(`API: Attempting to delete admin with ID: ${adminId}`);

    // Check if the admin exists and is actually an ADMIN
    const admin = await prisma.user.findUnique({
      where: {
        id: adminId,
        role: UserRole.ADMIN
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            createdUsers: true
          }
        }
      }
    });

    if (!admin) {
      console.log(`API: Admin with ID ${adminId} not found`);
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    console.log(`API: Found admin ${admin.name}, resource count: ${admin._count.createdUsers}`);

    // Check if admin has created any resources (companies, employees)
    if (admin._count.createdUsers > 0) {
      console.log(`API: Cannot delete - admin has ${admin._count.createdUsers} resources`);
      return NextResponse.json(
        { 
          error: "Cannot delete admin user with created resources. Reassign or delete their resources first.",
          resourceCount: admin._count.createdUsers
        },
        { status: 400 }
      );
    }

    // Delete the admin user
    await prisma.user.delete({
      where: {
        id: adminId
      }
    });

    console.log(`API: Successfully deleted admin ${admin.name}`);

    // Log the activity
    await addActivityLog({
      userId: session.user.id,
      action: ActivityAction.DELETE,
      details: {
        entityType: "USER",
        entityRole: "ADMIN",
        entityName: admin.name,
        entityEmail: admin.email
      },
      targetResourceId: adminId,
      targetResourceType: "USER"
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return NextResponse.json(
      { error: "Failed to delete admin user" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access admin details
export const GET = withAuth(handleGet, [UserRole.SUPERADMIN]);

// Only SuperAdmin can delete admin
export const DELETE = withAuth(handleDelete, [UserRole.SUPERADMIN]); 