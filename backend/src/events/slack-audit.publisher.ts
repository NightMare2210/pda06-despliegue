import type { EmployeeEvent, IEventPublisher } from './employee-events.js';

interface Options {
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  timeZone?: string;
  source?: string;
}

const TITLES: Record<EmployeeEvent['type'], { emoji: string; title: string }> = {
  'employee.created': { emoji: '🟢', title: 'Empleado creado' },
  'employee.updated': { emoji: '✏️', title: 'Empleado actualizado' },
  'employee.deleted': { emoji: '🔴', title: 'Empleado eliminado' },
};

/** Publica eventos de negocio en Slack. Nunca lanza: un fallo de Slack no afecta a la API. */
export class SlackAuditPublisher implements IEventPublisher {
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly timeZone: string;
  private readonly source: string;

  constructor(
    private readonly webhookUrl: string,
    { fetchFn = fetch, logger = console, timeZone = 'America/Guayaquil', source = 'pda03-api' }: Options = {},
  ) {
    this.fetchFn = fetchFn;
    this.logger = logger;
    this.timeZone = timeZone;
    this.source = source;
  }

  async publish(event: EmployeeEvent): Promise<void> {
    try {
      const res = await this.fetchFn(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: this.format(event) }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) this.logger.error(`[audit] Slack respondió ${res.status}`);
    } catch (err) {
      this.logger.error(`[audit] No se pudo notificar a Slack: ${(err as Error).message}`);
    }
  }

  private format(event: EmployeeEvent): string {
    const { emoji, title } = TITLES[event.type];
    const { id, nombre, cargo, departamento } = event.employee; // campos explícitos: el sueldo no entra
    const lines = [
      `${emoji} *${title}*`,
      `• *Nombre:* ${nombre}`,
      `• *Cargo:* ${cargo}`,
      `• *Departamento:* ${departamento}`,
    ];
    if (event.type === 'employee.updated') lines.push(`• *Campos modificados:* ${event.changedFields.join(', ')}`);
    lines.push(
      `• *ID:* \`${id}\``,
      `• *Hora:* ${event.occurredAt.toLocaleString('es-EC', { timeZone: this.timeZone, dateStyle: 'short', timeStyle: 'medium' })}`,
      `• *Origen:* ${this.source}`,
    );
    return lines.join('\n');
  }
}
