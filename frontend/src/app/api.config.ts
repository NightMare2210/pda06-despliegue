import { InjectionToken } from '@angular/core';

/** Base URL de la API desplegada en AWS (EC2 + Nginx + PM2). */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => 'https://pda06-brando.duckdns.org/api/v1',
});
