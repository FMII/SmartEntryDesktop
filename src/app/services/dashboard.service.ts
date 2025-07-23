import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // Obtener asistencias
  getAttendances(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/attendance`);
  }

  // Agrupar ausencias por grupo
  getAbsencesByGroup(): Observable<any[]> {
    return this.getAttendances().pipe(
      map((data) => {
        const groupMap: { [group: string]: number } = {};

        data.forEach((a) => {
          if (a.estado.toLowerCase() === 'ausente') {
            const grupo = a.grupo || 'Sin grupo';
            groupMap[grupo] = (groupMap[grupo] || 0) + 1;
          }
        });

        return Object.entries(groupMap).map(([grupo, total]) => ({
          grupo,
          total
        }));
      })
    );
  }
}
