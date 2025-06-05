import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers/Providers";
import { headers } from 'next/headers';

const inter = Inter({ subsets: ["latin"] });

// Initialize server directories
async function initializeServer() {
  // Skip in development to avoid client/server mismatch errors
  if (process.env.NODE_ENV === 'development') return;
  
  try {
    // Call the server-init API directly without fetch
    // This avoids making HTTP requests to itself which can cause issues in serverless environments
    const { GET } = await import('./api/server-init/route');
    await GET(new Request('https://dummy-url.com/api/server-init'));
    console.log('Server initialization completed');
  } catch (error) {
    console.error('Failed to initialize server:', error);
  }
}

export const metadata: Metadata = {
  title: "CBUMS - Coin Based User Management System",
  description: "Role-based application with coin management",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Run server initialization
  await initializeServer();
  
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
