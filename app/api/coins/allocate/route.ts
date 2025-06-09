import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { ActivityAction, EmployeeSubrole, TransactionReason, UserRole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";
import { addActivityLog } from "@/lib/activity-logger";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const fromUserId = session.user.id;
    
    const body = await req.json();
    const { toUserId, amount, reasonText } = body;

    if (!toUserId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Missing required fields or invalid amount" },
        { status: 400 }
      );
    }

    // Check if sender exists
    const sender = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        coins: true,
      },
    });

    if (!sender) {
      return NextResponse.json(
        { error: "Sender not found" },
        { status: 404 }
      );
    }

    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: toUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subrole: true,
        companyId: true,
        createdById: true,
      },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "Receiver not found" },
        { status: 404 }
      );
    }

    // Perform authorization checks based on the specification
    // 1. SuperAdmin can allocate to Admins
    // 2. Admins can allocate to Operators only
    let isAuthorized = false;

    if (sender.role === UserRole.SUPERADMIN && receiver.role === UserRole.ADMIN) {
      isAuthorized = true;
    } else if (sender.role === UserRole.ADMIN && 
              receiver.role === UserRole.EMPLOYEE && 
              receiver.subrole === EmployeeSubrole.OPERATOR) {
      // Admin can only allocate to Operators they created
      isAuthorized = receiver.createdById === sender.id;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "You are not authorized to allocate coins to this user" },
        { status: 403 }
      );
    }

    // Check if sender has enough coins
    if (!sender.coins || sender.coins < amount) {
      return NextResponse.json(
        { error: "Insufficient coins" },
        { status: 400 }
      );
    }

    // Create transaction using Prisma transaction to ensure data consistency
    const transaction = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update sender's balance
      const updatedSender = await tx.user.update({
        where: { id: fromUserId },
        data: { coins: { decrement: amount } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          coins: true,
        },
      });

      // Update receiver's balance
      const updatedReceiver = await tx.user.update({
        where: { id: toUserId },
        data: { coins: { increment: amount } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          subrole: true,
          coins: true,
        },
      });

      // Create transaction record
      const coinTransaction = await tx.coinTransaction.create({
        data: {
          fromUserId,
          toUserId,
          amount,
          reasonText,
          reason: TransactionReason.COIN_ALLOCATION,
        },
      });

      return {
        sender: updatedSender,
        receiver: updatedReceiver,
        transaction: coinTransaction,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable, // Ensures transaction isolation
      maxWait: 5000, // 5 seconds max wait time
      timeout: 10000, // 10 seconds timeout
    });

    // IMPORTANT: We need to make sure the transaction has been committed
    // and the database is updated before returning a response.
    // Let's verify the sender's balance has been properly updated.
    const verifiedSenderData = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { id: true, name: true, coins: true }
    });

    // If the verified balance doesn't match what we expected after the transaction,
    // something went wrong and we need to fix it.
    if (verifiedSenderData && transaction.sender.coins !== verifiedSenderData.coins) {
      console.error(`Balance mismatch detected! Transaction shows ${transaction.sender.coins} coins, but actual balance is ${verifiedSenderData.coins} coins.`);
      
      // Let's force an update to the correct balance
      await prisma.user.update({
        where: { id: fromUserId },
        data: { coins: transaction.sender.coins }
      });
      
      console.log(`Fixed balance for user ${verifiedSenderData.name} (${fromUserId}): Set to ${transaction.sender.coins} coins`);
    }

    // Prepare the details object for activity logging
    const logDetails: {
      recipient: {
        id: string;
        name: string;
        role: string;
        subrole: EmployeeSubrole | null;
      };
      amount: number;
      reason: TransactionReason;
      reasonText?: string;
    } = {
      recipient: { 
        id: toUserId, 
        name: transaction.receiver?.name || "Unknown",
        role: transaction.receiver?.role || "Unknown",
        subrole: transaction.receiver?.subrole as EmployeeSubrole | null
      },
      amount,
      reason: TransactionReason.COIN_ALLOCATION
    };

    // Add reasonText if it exists
    if (reasonText) {
      logDetails.reasonText = reasonText;
    }

    // Log the activity
    await addActivityLog({
      userId: fromUserId,
      action: ActivityAction.ALLOCATE,
      details: logDetails,
      targetUserId: toUserId,
    });

    return NextResponse.json({
      ...transaction,
      verified: {
        sender: verifiedSenderData
      }
    }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error allocating coins:", error);
    return NextResponse.json(
      { error: "Failed to allocate coins" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin and Admin can allocate coins
export const POST = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
]); 