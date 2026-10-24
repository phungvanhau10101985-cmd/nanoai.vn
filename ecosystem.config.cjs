/**
 * PM2 production config for NanoAI (thu-do-online).
 *
 * Important: start `next` binary directly (not `npm start`) so
 * `max_memory_restart` applies to the real Node process.
 *
 * On VPS:
 *   cd /var/www/Thu-do-online
 *   pm2 delete thu-do-online worksheet-worker 2>/dev/null || true
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'thu-do-online',
      cwd: '/var/www/Thu-do-online',
      script: './node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      // Heap ceiling is 2048. When V8 cannot collect it sits in a GC spiral
      // around RSS ~2.25GB and stops accepting connections, but it does not
      // exit, so a 2560M kill line never fires (gudo.vn 2026-10-24: 499s,
      // Recv-Q full, PM2 still "online"). 2200M is above a healthy working
      // set and below that wedge, so PM2 restarts instead of hanging shops.
      max_memory_restart: '2200M',
      node_args: '--max-old-space-size=2048',
      kill_timeout: 10000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 200,
      max_restarts: 30,
      min_uptime: '15s',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=2048',
        // Keep inventory embed lighter under concurrent dashboard use.
        GEMINI_IMAGE_SEARCH_PARALLEL: '2',
        GEMINI_IMAGE_EMBED_SYNC_LIMIT: '400',
        MESSAGING_INVENTORY_EMBED_CRON_PARTNERS_PER_RUN: '3',
        MESSAGING_INVENTORY_EMBED_CRON_LIMIT_PER_PARTNER: '200',
      },
    },
    {
      name: 'worksheet-worker',
      cwd: '/var/www/Thu-do-online',
      script: 'npx',
      args: 'tsx scripts/worksheet-job-worker.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 8000,
      exp_backoff_restart_delay: 200,
      max_restarts: 30,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=768',
      },
    },
  ],
}
