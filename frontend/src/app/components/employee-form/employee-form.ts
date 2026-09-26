import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Employee, EmployeeInput } from '../../models/employee.model';

/** Dumb component (Reto 4): solo recibe datos por @Input y emite eventos por @Output. */
@Component({
  selector: 'app-employee-form',
  imports: [ReactiveFormsModule],
  templateUrl: './employee-form.html',
  styleUrl: './employee-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeForm implements OnChanges {
  @Input() employee: Employee | null = null;
  @Input() saving = false;
  @Input() serverError: string | null = null;
  @Output() save = new EventEmitter<EmployeeInput>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(NonNullableFormBuilder);

  // Mismas reglas que el DTO Zod del backend
  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    cargo: ['', [Validators.required, Validators.minLength(2)]],
    departamento: ['', [Validators.required, Validators.minLength(2)]],
    sueldo: [0, [Validators.required, Validators.min(0.01)]],
  });

  ngOnChanges(): void {
    if (this.employee) {
      const { nombre, cargo, departamento, sueldo } = this.employee;
      this.form.setValue({ nombre, cargo, departamento, sueldo });
    } else {
      this.form.reset();
    }
  }

  invalid(field: keyof EmployeeInput): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({ ...value, sueldo: Number(value.sueldo) });
  }
}
