// .cjs: backend/package.json declara "type": "module", PM2 necesita CommonJS
const APP_PATH = '/var/www/pda03-api';

module.exports = {
  apps: [
    {
      name: 'pda03-api',
      cwd: `${APP_PATH}/current/backend`,
      script: 'dist/index.js',
      instances: 'max', // Modo Cluster: un worker por vCPU
      exec_mode: 'cluster',

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Secretos (MONGO_URI) fuera del repo: los carga dotenv desde shared/.env en el servidor
        DOTENV_PATH: `${APP_PATH}/shared/.env`,
      },

      // Logs y Monitoreo del Servidor
      error_file: `${APP_PATH}/shared/logs/err.log`,
      out_file: `${APP_PATH}/shared/logs/out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],

  // Automatización del Despliegue desde la PC local
  deploy: {
    production: {
      user: 'ubuntu',
      host: '15.229.143.47',
      ref: 'origin/main',
      repo: 'git@github.com:NightMare2210/pda06-despliegue.git',
      path: APP_PATH,
      'pre-setup': 'mkdir -p /var/www/pda03-api/shared/logs',
      'post-deploy':
        'cd backend && npm ci --include=dev && npm run build && cd .. && pm2 reload ecosystem.config.cjs --env production && pm2 save',
      ssh_options: 'StrictHostKeyChecking=accept-new',
      key: '~/.ssh/pda06-aws.pem',
    },
  },
};
