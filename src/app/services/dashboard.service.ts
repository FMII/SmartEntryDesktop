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

  // Obtener grupos
  getGroups(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/groups/list`);
  }

  // Mapear asistencias con nombre de grupo (si solo hay ID)
  mapAttendancesWithGroupNames(attendances: any[], groups: any[]): any[] {
    const groupMap = groups.reduce((acc, group) => {
      acc[group.id] = group.name;
      return acc;
    }, {} as { [id: number]: string });
    return attendances.map(a => ({
      ...a,
      grupo: a.grupo || groupMap[a.group_id] || a.group_id || 'Sin grupo'
    }));
  }
}
