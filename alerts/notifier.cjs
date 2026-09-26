// Notificador de alertas PM2 -> Slack (reemplaza pm2-slack para controlar el formato)
const os = require('node:os');
const pm2 = require('pm2');

try {
  process.loadEnvFile(process.env.DOTENV_PATH);
} catch {
  // Sin archivo: se usan las variables ya presentes en el entorno
}

const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const APPS = (process.env.ALERT_APPS || 'pda03-api').split(',');
const SERVER = process.env.ALERT_SERVER || os.hostname();
const PUBLIC_URL = process.env.ALERT_PUBLIC_URL || '';
const TZ = process.env.ALERT_TZ || 'America/Guayaquil';
const BUFFER_MS = 3000; // agrupa los eventos de todos los workers del cluster

const EVENTS = {
  stop: { emoji: '🛑', title: 'Aplicación detenida' },
  exit: { emoji: '🚨', title: 'Proceso caído' },
  'restart overlimit': { emoji: '🔥', title: 'Demasiados reinicios, PM2 dejó de reiniciarla' },
  exception: { emoji: '💥', title: 'Excepción no controlada' },
  error: { emoji: '⚠️', title: 'Error en logs (stderr)' },
  online: { emoji: '✅', title: 'Aplicación recuperada' },
};

if (!WEBHOOK) {
  console.error('Falta SLACK_WEBHOOK_URL');
  process.exit(1);
}

const pending = new Map(); // "app|evento" -> { workers:Set, detail }
let timer = null;
const recentlyDown = new Set(); // apps caídas, para avisar cuando vuelven

const now = () =>
  new Date().toLocaleString('es-EC', { timeZone: TZ, dateStyle: 'short', timeStyle: 'medium' });

function queue(app, event, pmId, detail) {
  const key = `${app}|${event}`;
  const entry = pending.get(key) ?? { workers: new Set(), detail: '' };
  entry.workers.add(pmId);
  if (detail && !entry.detail) entry.detail = detail;
  pending.set(key, entry);
  timer ??= setTimeout(flush, BUFFER_MS);
}

function format(app, event, { workers, detail }) {
  const { emoji, title } = EVENTS[event];
  const lines = [
    `${emoji} *${title}*`,
    `• *App:* \`${app}\``,
    `• *Evento:* ${event}`,
    `• *Workers:* ${[...workers].sort().join(', ')}`,
    `• *Servidor:* ${SERVER}`,
    `• *Hora:* ${now()}`,
  ];
  if (PUBLIC_URL) lines.push(`• *URL:* ${PUBLIC_URL}`);
  if (detail) lines.push('```' + detail.slice(0, 500) + '```');
  return lines.join('\n');
}

async function flush() {
  timer = null;
  const batch = [...pending.entries()];
  pending.clear();
  for (const [key, entry] of batch) {
    const [app, event] = key.split('|');
    if (event === 'online') recentlyDown.delete(app);
    try {
      const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: format(app, event, entry) }),
      });
      if (!res.ok) console.error(`Slack respondió ${res.status}`);
    } catch (err) {
      console.error('No se pudo enviar a Slack:', err.message);
    }
  }
}

pm2.connect((err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  pm2.launchBus((busErr, bus) => {
    if (busErr) {
      console.error(busErr);
      process.exit(1);
    }
    console.log(`Escuchando eventos de: ${APPS.join(', ')}`);

    bus.on('process:event', ({ event, process: p }) => {
      if (!APPS.includes(p.name) || !EVENTS[event]) return;
      // 'online' solo interesa si la app venía caída
      if (event === 'online' && !recentlyDown.has(p.name)) return;
      if (event === 'stop' || event === 'exit') recentlyDown.add(p.name);
      queue(p.name, event, p.pm_id);
    });

    bus.on('process:exception', ({ process: p, data }) => {
      if (!APPS.includes(p.name)) return;
      queue(p.name, 'exception', p.pm_id, data?.stack || data?.message || String(data));
    });

    bus.on('log:err', ({ process: p, data }) => {
      if (!APPS.includes(p.name)) return;
      queue(p.name, 'error', p.pm_id, String(data).trim());
    });
  });
});

