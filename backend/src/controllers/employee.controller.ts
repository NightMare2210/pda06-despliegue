import type { Request, Response } from 'express';
import type { IEmployeeRepository } from '../repositories/employee.repository.interface.js';
import { toSnapshot, type EmployeeEvent, type IEventPublisher } from '../events/employee-events.js';
import { NotFoundError } from '../errors/app-error.js';
import { sendSuccess } from '../utils/api-response.js';

// El controlador depende SOLO de abstracciones; las implementaciones concretas se inyectan desde afuera.
// Los métodos son arrow functions para conservar `this` al pasarlos como handlers de Express.
export class EmployeeController {
  constructor(
    private readonly employeeRepository: IEmployeeRepository,
    private readonly events: IEventPublisher,
  ) {}

  getEmployees = async (req: Request, res: Response): Promise<void> => {
    const empleados = await this.employeeRepository.findAll();
    sendSuccess(res, empleados);
  };

  getEmployeeById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const empleado = await this.employeeRepository.findById(id);
    if (!empleado) {
      throw new NotFoundError('Empleado no encontrado');
    }
    sendSuccess(res, empleado);
  };

  createEmployee = async (req: Request, res: Response): Promise<void> => {
    const empleado = await this.employeeRepository.create(req.body);
    sendSuccess(res, empleado, 201, 'Empleado guardado');
    this.emit({ type: 'employee.created', employee: toSnapshot(empleado), occurredAt: new Date() });
  };

  updateEmployee = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const empleado = await this.employeeRepository.update(id, req.body);
    if (!empleado) {
      throw new NotFoundError('Empleado no encontrado');
    }
    sendSuccess(res, empleado, 200, 'Empleado actualizado');
    this.emit({
      type: 'employee.updated',
      employee: toSnapshot(empleado),
      changedFields: Object.keys(req.body ?? {}),
      occurredAt: new Date(),
    });
  };

  deleteEmployee = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const eliminado = await this.employeeRepository.delete(id);
    if (!eliminado) {
      throw new NotFoundError('Empleado no encontrado');
    }
    sendSuccess(res, null, 200, 'Empleado eliminado');
    this.emit({ type: 'employee.deleted', employee: toSnapshot(eliminado), occurredAt: new Date() });
  };

  // Fire-and-forget: se emite DESPUÉS de responder y un fallo del publicador no afecta la respuesta
  private emit(event: EmployeeEvent): void {
    try {
      void Promise.resolve(this.events.publish(event)).catch(() => {});
    } catch {
      // publicador síncrono que lanzó: se ignora a propósito
    }
  }
}
