/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "localhost:3001"],
    },
  },
  
  // Temporarily disable TypeScript checking
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint errors from failing the build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Configure which pages should not be statically generated
  output: 'standalone',
  
  // Skip static generation for routes that access the database
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  
  // Increase bodyParser limit for API routes to handle larger image uploads
  api: {
    bodyParser: {
      sizeLimit: '8mb', // Increase to 8MB
    },
    responseLimit: '8mb', // Also increase response limit
  },
  
  // Add redirects for company and employee detail pages
  async redirects() {
    return [
      // Specific redirects for company and employee detail pages
      {
        source: '/dashboard/company/:id',
        destination: '/dashboard/companies/:id',
        permanent: false,
      },
      {
        source: '/dashboard/employees/:id',
        destination: '/dashboard/employee/:id',
        permanent: false,
      },
      // Add redirect for the new admin page
      {
        source: '/dashboard/admins/new',
        destination: '/dashboard/admins/create',
        permanent: false,
      }
    ];
  },
  
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  // Add headers to handle CORS issues
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
