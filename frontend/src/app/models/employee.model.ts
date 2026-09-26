export interface Employee {
  id: string;
  nombre: string;
  cargo: string;
  departamento: string;
  sueldo: number;
}

export type EmployeeInput = Omit<Employee, 'id'>;

/** Response Wrapper del backend: { success, message?, data } */
export interface ApiResponse<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    message: string;
    details?: { campo: string; mensaje: string }[];
  };
}
