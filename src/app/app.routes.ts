import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { GradesComponent } from './pages/grades/grades.component';
import { TeachersScheduleComponent } from './pages/teachers-schedule/teachers-schedule.component';
import { AttendanceHistoryComponent } from './pages/attendance-history/attendance-history.component';
import { SidebarComponent } from './pages/sidebar/sidebar.component';
import { authGuard } from './guards/auth.guard';
import { noAuthGuard } from './guards/no-auth.guard';




export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
   canActivate: [noAuthGuard]
  },
  {
    path: '',
    component: SidebarComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'grades', component: GradesComponent },
      { path: 'teachers-schedule', component: TeachersScheduleComponent },
      { path: 'attendance-history', component: AttendanceHistoryComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, // Redirige a dashboard por defecto
    ]
  },
  { path: '**', redirectTo: 'login' } // Ruta comodín DEBE ir última
];