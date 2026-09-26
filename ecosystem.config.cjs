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
        DOTENV_QUIET: 'true', // dotenv loguea por stderr y el notificador lo reportaría como 'error'
      },

      // Logs y Monitoreo del Servidor
      error_file: `${APP_PATH}/shared/logs/err.log`,
      out_file: `${APP_PATH}/shared/logs/out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      // Alertas PM2 -> Slack con formato propio (SLACK_WEBHOOK_URL vive en shared/.env)
      name: 'pda03-alertas',
      cwd: `${APP_PATH}/current/alerts`,
      script: 'notifier.cjs',
      instances: 1,
      exec_mode: 'fork',

      env_production: {
        DOTENV_PATH: `${APP_PATH}/shared/.env`,
        ALERT_APPS: 'pda03-api',
        ALERT_SERVER: 'aws-pda06 (sa-east-1)',
        ALERT_PUBLIC_URL: 'https://pda06-brando.duckdns.org',
        ALERT_TZ: 'America/Guayaquil',
      },

      error_file: `${APP_PATH}/shared/logs/alertas-err.log`,
      out_file: `${APP_PATH}/shared/logs/alertas-out.log`,
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
        'cd backend && npm ci --include=dev && npm run build && cd ../alerts && npm ci --omit=dev && cd .. && pm2 reload ecosystem.config.cjs --env production && pm2 save',
      ssh_options: 'StrictHostKeyChecking=accept-new',
      key: '~/.ssh/pda06-aws.pem',
    },
  },
};
