import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Employee } from '../../models/employee.model';

/** Dumb component (Reto 4): renderiza la lista y delega las acciones al padre. */
@Component({
  selector: 'app-employee-table',
  imports: [CurrencyPipe],
  templateUrl: './employee-table.html',
  styleUrl: './employee-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeTable {
  @Input({ required: true }) employees: Employee[] = [];
  @Input() selectedId: string | null = null;
  @Input() deletingId: string | null = null;
  @Output() edit = new EventEmitter<Employee>();
  @Output() remove = new EventEmitter<Employee>();

  /** Confirmación en dos pasos, sin window.confirm */
  confirmId: string | null = null;

  askRemove(employee: Employee): void {
    if (this.confirmId === employee.id) {
      this.confirmId = null;
      this.remove.emit(employee);
    } else {
      this.confirmId = employee.id;
    }
  }
}
