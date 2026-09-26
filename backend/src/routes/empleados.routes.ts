import { Router } from 'express';
import { EmployeeController } from '../controllers/employee.controller.js';
import { EmployeeRepository } from '../repositories/mongo-employee.repository.js';
import { NoopEventPublisher } from '../events/employee-events.js';
import { SlackAuditPublisher } from '../events/slack-audit.publisher.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createEmployeeSchema, updateEmployeeSchema, idParamSchema } from '../dto/employee.dto.js';

// Composition root: acá se eligen las implementaciones concretas y se inyectan en el controlador.
// Auditoría en Slack: canal propio si existe AUDIT_SLACK_WEBHOOK_URL, si no el de alertas; sin webhook, no-op.
const auditWebhook = process.env.AUDIT_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
const events = auditWebhook ? new SlackAuditPublisher(auditWebhook) : new NoopEventPublisher();
const controller = new EmployeeController(new EmployeeRepository(), events);

const router = Router();

router.get('/employees', controller.getEmployees);
router.get('/employees/:id', validate(idParamSchema, 'params'), controller.getEmployeeById);
router.post('/employees', validate(createEmployeeSchema, 'body'), controller.createEmployee);
router.put(
  '/employees/:id',
  validate(idParamSchema, 'params'),
  validate(updateEmployeeSchema, 'body'),
  controller.updateEmployee,
);
router.delete('/employees/:id', validate(idParamSchema, 'params'), controller.deleteEmployee);

export default router;
