module.exports = {
  apps: [
    {
      name: 'flowtask-api',
      cwd: '/opt/flowtask/backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: '/opt/flowtask/backend/.env',
      error_file: '/var/log/flowtask/api-error.log',
      out_file: '/var/log/flowtask/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
