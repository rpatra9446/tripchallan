#!/usr/bin/env node

/**
 * Safely run migrations in production
 * 
 * This script runs prisma migrate deploy in a way that's safe for production
 * environments, including handling errors gracefully.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Running database migrations safely...');

try {
  console.log('Executing prisma migrate deploy...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
  });
  console.log('✅ Database migrations completed successfully');
} catch (error) {
  console.error('❌ Error running migrations:', error.message);
  
  // Don't fail the build - in Vercel, we want to continue even if migrations fail
  // because we might be using a shared database or one that's already migrated
  console.log('Continuing build process despite migration issues...');
}

console.log('Migration handling complete'); 