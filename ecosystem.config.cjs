module.exports = {
  apps: [
    {
      name: 'thu-do-online',
      cwd: '/var/www/Thu-do-online',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
