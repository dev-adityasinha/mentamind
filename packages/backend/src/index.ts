import path from 'path';
import { execSync } from 'child_process';
import { createApp } from './app.js';
import { config } from './config/env.js';

// Run pending migrations before starting the server.
// This ensures the DB schema is always in sync regardless of
// how the process is launched (Render dashboard, Docker, etc.).
function runMigrations(): void {
  try {
    console.log('🔄 Running database migrations...');
    // __dirname in CJS build = packages/backend/dist
    // prisma schema lives at packages/backend/prisma/schema.prisma
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, { stdio: 'inherit' });
    console.log('✅ Migrations applied.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    // Don't crash — server can still run if schema is already in sync
  }
}

runMigrations();

const { app } = createApp();

app.listen(config.PORT, () => {
  console.log(`🚀 Mentamind API running on port ${config.PORT}`);
  console.log(`📋 Environment: ${config.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${config.PORT}/api/health`);
});
