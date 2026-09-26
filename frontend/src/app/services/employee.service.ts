import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, map, tap, throwError } from 'rxjs';
import { API_URL } from '../api.config';
import { ApiErrorBody, ApiResponse, Employee, EmployeeInput } from '../models/employee.model';

/**
 * Servicio reactivo (Reto 3): el estado vive en BehaviorSubject privados y se expone
 * como Observable de solo lectura. Cada mutación crea un arreglo NUEVO (inmutabilidad).
 */
@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_URL)}/employees`;

  private readonly employeesSubject = new BehaviorSubject<Employee[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);

  readonly employees$ = this.employeesSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  load(): void {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    this.http
      .get<ApiResponse<Employee[]>>(this.baseUrl)
      .pipe(
        map((res) => res.data),
        finalize(() => this.loadingSubject.next(false)),
      )
      .subscribe({
        next: (employees) => this.employeesSubject.next(employees),
        error: (err: HttpErrorResponse) => this.errorSubject.next(toMessage(err)),
      });
  }

  create(input: EmployeeInput): Observable<Employee> {
    return this.http.post<ApiResponse<Employee>>(this.baseUrl, input).pipe(
      map((res) => res.data),
      tap((created) => this.employeesSubject.next([...this.employeesSubject.value, created])),
      catchError(rethrow),
    );
  }

  update(id: string, input: Partial<EmployeeInput>): Observable<Employee> {
    return this.http.put<ApiResponse<Employee>>(`${this.baseUrl}/${id}`, input).pipe(
      map((res) => res.data),
      tap((updated) =>
        this.employeesSubject.next(this.employeesSubject.value.map((e) => (e.id === id ? updated : e))),
      ),
      catchError(rethrow),
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`).pipe(
      map(() => undefined),
      tap(() => this.employeesSubject.next(this.employeesSubject.value.filter((e) => e.id !== id))),
      catchError(rethrow),
    );
  }
}

function toMessage(err: HttpErrorResponse): string {
  if (err.status === 0) return 'No se pudo conectar con la API. ¿Está en línea?';
  const body = err.error as ApiErrorBody | null;
  const details = body?.error?.details?.map((d) => `${d.campo}: ${d.mensaje}`).join(' · ');
  return details || body?.error?.message || `Error ${err.status}`;
}

function rethrow(err: HttpErrorResponse) {
  return throwError(() => new Error(toMessage(err)));
}
