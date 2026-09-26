import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmployeesPage } from './pages/employees-page/employees-page';

@Component({
  selector: 'app-root',
  imports: [EmployeesPage],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
