"use server";

import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { EmployeeSubrole } from "@/prisma/enums";
import VerifyClient from "./client";

export default async function VerifyPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  // Get the user session to check if they're a guard
  const session = await getServerSession(authOptions);
  
  // Only guards should access this page
  if (session?.user.subrole !== EmployeeSubrole.GUARD) {
    redirect('/dashboard/sessions');
  }

  // Pass the sessionId to the client component
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyClient sessionId={params.id} />
    </Suspense>
  );
} 