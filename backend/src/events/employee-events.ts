import type { Empleado } from '../repositories/employee.repository.interface.js';

// Snapshot sin datos sensibles: el sueldo NUNCA viaja en los eventos
export type EmployeeSnapshot = Pick<Empleado, 'id' | 'nombre' | 'cargo' | 'departamento'>;

export type EmployeeEvent =
  | { type: 'employee.created'; employee: EmployeeSnapshot; occurredAt: Date }
  | { type: 'employee.updated'; employee: EmployeeSnapshot; changedFields: string[]; occurredAt: Date }
  | { type: 'employee.deleted'; employee: EmployeeSnapshot; occurredAt: Date };

// Observer: el controlador solo conoce esta abstracción, no a Slack
export interface IEventPublisher {
  publish(event: EmployeeEvent): void | Promise<void>;
}

export const toSnapshot = ({ id, nombre, cargo, departamento }: Empleado): EmployeeSnapshot => ({
  id,
  nombre,
  cargo,
  departamento,
});

export class NoopEventPublisher implements IEventPublisher {
  publish(): void {}
}
