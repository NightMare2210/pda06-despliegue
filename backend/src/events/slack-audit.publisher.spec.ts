import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SlackAuditPublisher } from './slack-audit.publisher.js';
import type { EmployeeEvent } from './employee-events.js';

describe('🧪 Unit Test: SlackAuditPublisher', () => {
  const webhook = 'https://hooks.slack.com/services/TEST/TEST/TEST';
  const employee = { id: '64b7f0c2a1b2c3d4e5f60718', nombre: 'Ana Torres', cargo: 'DevOps', departamento: 'TI' };
  const occurredAt = new Date('2026-09-26T19:00:00Z');

  let fetchMock: jest.Mock<typeof fetch>;
  let logger: { error: jest.Mock };
  let publisher: SlackAuditPublisher;

  beforeEach(() => {
    fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response('ok', { status: 200 }));
    logger = { error: jest.fn() };
    publisher = new SlackAuditPublisher(webhook, { fetchFn: fetchMock, logger, timeZone: 'America/Guayaquil' });
  });

  const lastBody = () => JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as { text: string };

  it('Debería hacer POST JSON al webhook con un mensaje legible de alta', async () => {
    await publisher.publish({ type: 'employee.created', employee, occurredAt });

    expect(fetchMock).toHaveBeenCalledWith(
      webhook,
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }),
    );
    const { text } = lastBody();
    expect(text).toContain('🟢');
    expect(text).toContain('Empleado creado');
    expect(text).toContain('Ana Torres');
    expect(text).toContain('DevOps');
    expect(text).toContain('TI');
  });

  it('Debería listar los campos modificados en una actualización', async () => {
    await publisher.publish({ type: 'employee.updated', employee, changedFields: ['sueldo', 'cargo'], occurredAt });

    const { text } = lastBody();
    expect(text).toContain('✏️');
    expect(text).toContain('Empleado actualizado');
    expect(text).toContain('sueldo, cargo');
  });

  it('Debería informar la baja de un empleado', async () => {
    await publisher.publish({ type: 'employee.deleted', employee, occurredAt });

    const { text } = lastBody();
    expect(text).toContain('🔴');
    expect(text).toContain('Empleado eliminado');
    expect(text).toContain('Ana Torres');
  });

  it('NUNCA debería incluir montos de sueldo en el mensaje', async () => {
    const withSalary = { ...employee, sueldo: 4200 } as unknown as EmployeeEvent['employee'];
    await publisher.publish({ type: 'employee.created', employee: withSalary, occurredAt });

    expect(lastBody().text).not.toContain('4200');
  });

  it('NO debería lanzar si Slack falla: registra el error y sigue', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(publisher.publish({ type: 'employee.deleted', employee, occurredAt })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('Debería registrar el error si Slack responde con status no exitoso', async () => {
    fetchMock.mockResolvedValue(new Response('invalid_token', { status: 403 }));

    await publisher.publish({ type: 'employee.created', employee, occurredAt });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('403'));
  });
});
