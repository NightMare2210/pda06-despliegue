import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Request, Response } from 'express';
import { EmployeeController } from './employee.controller.js';
import type { Empleado, IEmployeeRepository } from '../repositories/employee.repository.interface.js';
import type { IEventPublisher } from '../events/employee-events.js';

describe('🧪 Unit Test: EmployeeController (Mantenibilidad & Testabilidad)', () => {
  let controller: EmployeeController;
  let mockRepository: jest.Mocked<IEmployeeRepository>;
  let mockPublisher: jest.Mocked<IEventPublisher>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    // 1. Crear un Mock 100% aislado de la interfaz (Cero dependencia de Mongoose)
    mockRepository = {
      findAll: jest.fn<IEmployeeRepository['findAll']>(),
      findById: jest.fn<IEmployeeRepository['findById']>(),
      create: jest.fn<IEmployeeRepository['create']>(),
      update: jest.fn<IEmployeeRepository['update']>(),
      delete: jest.fn<IEmployeeRepository['delete']>(),
    };

    mockPublisher = { publish: jest.fn<IEventPublisher['publish']>() };

    controller = new EmployeeController(mockRepository, mockPublisher);

    // 2. Mockear los objetos del ciclo de vida de Express
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = { status: statusMock as unknown as Response['status'] };
  });

  it('Debería retornar un estado 200 y la lista de empleados de la abstracción', async () => {
    const fakeEmployees: Empleado[] = [
      { id: '1', nombre: 'Andrés Mendoza', cargo: 'Arquitecto', departamento: 'TI', sueldo: 4000 },
    ];

    // Configurar el comportamiento esperado de la abstracción
    mockRepository.findAll.mockResolvedValue(fakeEmployees);
    mockRequest = {};

    await controller.getEmployees(mockRequest as Request, mockResponse as Response);

    // Verificaciones asertivas del contrato (sendSuccess envuelve la respuesta en { success, message, data })
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ success: true, message: undefined, data: fakeEmployees });
    expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
  });

  const fakeEmployee: Empleado = {
    id: '64b7f0c2a1b2c3d4e5f60718',
    nombre: 'Andrés Mendoza',
    cargo: 'Arquitecto',
    departamento: 'TI',
    sueldo: 4000,
  };
  const { id, ...employeeInput } = fakeEmployee;

  describe('getEmployeeById', () => {
    it('Debería retornar 200 y el empleado cuando existe', async () => {
      mockRepository.findById.mockResolvedValue(fakeEmployee);
      mockRequest = { params: { id } };

      await controller.getEmployeeById(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.findById).toHaveBeenCalledWith(id);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, message: undefined, data: fakeEmployee });
    });

    it('Debería lanzar NotFoundError (404) cuando el repositorio no encuentra el empleado', async () => {
      mockRepository.findById.mockResolvedValue(null);
      mockRequest = { params: { id } };

      await expect(
        controller.getEmployeeById(mockRequest as Request, mockResponse as Response),
      ).rejects.toMatchObject({ name: 'NotFoundError', statusCode: 404 });
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('createEmployee', () => {
    it('Debería delegar el body al repositorio y retornar 201', async () => {
      mockRepository.create.mockResolvedValue(fakeEmployee);
      mockRequest = { body: employeeInput };

      await controller.createEmployee(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.create).toHaveBeenCalledWith(employeeInput);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, message: 'Empleado guardado', data: fakeEmployee });
    });
  });

  describe('updateEmployee', () => {
    it('Debería retornar 200 con el empleado actualizado', async () => {
      const cambios = { sueldo: 5000 };
      const actualizado = { ...fakeEmployee, ...cambios };
      mockRepository.update.mockResolvedValue(actualizado);
      mockRequest = { params: { id }, body: cambios };

      await controller.updateEmployee(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.update).toHaveBeenCalledWith(id, cambios);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, message: 'Empleado actualizado', data: actualizado });
    });

    it('Debería lanzar NotFoundError (404) si el empleado no existe', async () => {
      mockRepository.update.mockResolvedValue(null);
      mockRequest = { params: { id }, body: { sueldo: 5000 } };

      await expect(
        controller.updateEmployee(mockRequest as Request, mockResponse as Response),
      ).rejects.toMatchObject({ name: 'NotFoundError', statusCode: 404 });
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('deleteEmployee', () => {
    it('Debería retornar 200 cuando el repositorio confirma la eliminación', async () => {
      mockRepository.delete.mockResolvedValue(fakeEmployee);
      mockRequest = { params: { id } };

      await controller.deleteEmployee(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.delete).toHaveBeenCalledWith(id);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, message: 'Empleado eliminado', data: null });
    });

    it('Debería lanzar NotFoundError (404) si no había nada que eliminar', async () => {
      mockRepository.delete.mockResolvedValue(null);
      mockRequest = { params: { id } };

      await expect(
        controller.deleteEmployee(mockRequest as Request, mockResponse as Response),
      ).rejects.toMatchObject({ name: 'NotFoundError', statusCode: 404 });
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('📣 Eventos de dominio (Observer)', () => {
    const snapshot = { id, nombre: 'Andrés Mendoza', cargo: 'Arquitecto', departamento: 'TI' };

    it('Debería publicar employee.created SIN el sueldo al crear', async () => {
      mockRepository.create.mockResolvedValue(fakeEmployee);
      mockRequest = { body: employeeInput };

      await controller.createEmployee(mockRequest as Request, mockResponse as Response);

      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
      const event = mockPublisher.publish.mock.calls[0]![0];
      expect(event).toMatchObject({ type: 'employee.created', employee: snapshot });
      expect(event.employee).not.toHaveProperty('sueldo');
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('Debería publicar employee.updated con los NOMBRES de los campos cambiados (no sus valores)', async () => {
      mockRepository.update.mockResolvedValue({ ...fakeEmployee, sueldo: 5000, cargo: 'CTO' });
      mockRequest = { params: { id }, body: { sueldo: 5000, cargo: 'CTO' } };

      await controller.updateEmployee(mockRequest as Request, mockResponse as Response);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'employee.updated',
          employee: { ...snapshot, cargo: 'CTO' },
          changedFields: ['sueldo', 'cargo'],
        }),
      );
    });

    it('Debería publicar employee.deleted con los datos del empleado eliminado', async () => {
      mockRepository.delete.mockResolvedValue(fakeEmployee);
      mockRequest = { params: { id } };

      await controller.deleteEmployee(mockRequest as Request, mockResponse as Response);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'employee.deleted', employee: snapshot }),
      );
    });

    it('NO debería publicar nada cuando la operación falla con 404', async () => {
      mockRepository.update.mockResolvedValue(null);
      mockRepository.delete.mockResolvedValue(null);

      await expect(
        controller.updateEmployee({ params: { id }, body: { sueldo: 1 } } as unknown as Request, mockResponse as Response),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        controller.deleteEmployee({ params: { id } } as unknown as Request, mockResponse as Response),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });

    it('Debería responder 201 aunque el publicador falle (fire-and-forget)', async () => {
      mockRepository.create.mockResolvedValue(fakeEmployee);
      mockPublisher.publish.mockImplementation(() => {
        throw new Error('Slack caído');
      });
      mockRequest = { body: employeeInput };

      await controller.createEmployee(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });
});
