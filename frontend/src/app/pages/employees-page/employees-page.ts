import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { EmployeeForm } from '../../components/employee-form/employee-form';
import { EmployeeTable } from '../../components/employee-table/employee-table';
import { Employee, EmployeeInput } from '../../models/employee.model';
import { EmployeeService } from '../../services/employee.service';

/**
 * Smart component / orquestador (Reto 4): consume los Observables del servicio con
 * `async` pipe y delega la presentación a los dumb components.
 */
@Component({
  selector: 'app-employees-page',
  imports: [AsyncPipe, CurrencyPipe, EmployeeForm, EmployeeTable],
  templateUrl: './employees-page.html',
  styleUrl: './employees-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesPage implements OnInit {
  private readonly service = inject(EmployeeService);

  readonly employees$ = this.service.employees$;
  readonly loading$ = this.service.loading$;
  readonly error$ = this.service.error$;
  readonly stats$ = this.employees$.pipe(
    map((list) => ({
      total: list.length,
      departamentos: new Set(list.map((e) => e.departamento)).size,
      nomina: list.reduce((sum, e) => sum + e.sueldo, 0),
    })),
  );

  readonly selected = signal<Employee | null>(null);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  ngOnInit(): void {
    this.service.load();
  }

  reload(): void {
    this.service.load();
  }

  onEdit(employee: Employee): void {
    this.formError.set(null);
    this.selected.set(employee);
  }

  onCancel(): void {
    this.formError.set(null);
    this.selected.set(null);
  }

  onSave(input: EmployeeInput): void {
    const current = this.selected();
    const request$ = current ? this.service.update(current.id, input) : this.service.create(input);

    this.saving.set(true);
    this.formError.set(null);
    request$.subscribe({
      next: (e) => {
        this.saving.set(false);
        this.selected.set(null);
        this.notify(current ? `“${e.nombre}” actualizado` : `“${e.nombre}” agregado`);
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.formError.set(err.message);
      },
    });
  }

  onRemove(employee: Employee): void {
    this.deletingId.set(employee.id);
    this.service.remove(employee.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        if (this.selected()?.id === employee.id) this.selected.set(null);
        this.notify(`“${employee.nombre}” eliminado`);
      },
      error: (err: Error) => {
        this.deletingId.set(null);
        this.notify(err.message);
      },
    });
  }

  private notify(message: string): void {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 3000);
  }
}
