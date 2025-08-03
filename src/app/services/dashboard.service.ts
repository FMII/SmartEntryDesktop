import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private API_URL = 'https://api.smartentry.space/api/academic';

  constructor(private http: HttpClient) {}

  // Obtener asistencias
  getAttendances(): Observable<any[]> {
    return this.http.get<any>(`${this.API_URL}/attendance`).pipe(
      map((res: any) => Array.isArray(res) ? res : res.data)
    );
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
    return this.http.get<any>(`${this.API_URL}/groups/list`).pipe(
      map((res: any) => Array.isArray(res) ? res : res.data)
    );
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

  // Obtener alumnos con más ausencias por grupo (API real)
  getTopAbsencesByGroup(startDate: string, endDate: string): Observable<any[]> {
    return this.http.get<any>(`${this.API_URL}/graphics/top-absences`, {
      params: { startDate, endDate }
    }).pipe(
      map((res: any) => Array.isArray(res.data) ? res.data : [])
    );
  }

  // Obtener asistencias de alumnos por grupo y rango de fechas (API real)
  getAttendanceByGroup(groupId: number, startDate: string, endDate: string): Observable<any[]> {
    console.log('📡 Llamando a getAttendanceByGroup con:', { groupId, startDate, endDate });
    
    return this.http.get<any>(`${this.API_URL}/attendance`, {
      params: { 
        group_id: groupId.toString(),
        start_date: startDate,
        end_date: endDate
      }
    }).pipe(
      map((res: any) => {
        console.log('📡 Respuesta raw de attendance:', res);
        
        let attendanceData: any[] = [];
        
        if (res && typeof res === 'object') {
          if (res.data && Array.isArray(res.data)) {
            attendanceData = res.data;
          } else if (Array.isArray(res)) {
            attendanceData = res;
          }
        }
        
        console.log('Datos de asistencia procesados:', attendanceData);
        return attendanceData;
      }),
      catchError((error) => {
        console.error('Error al obtener asistencia por grupo:', error);
        return of([]);
      })
    );
  }

  // Actualizar el status de asistencia
  updateAttendanceStatus(id: number, data: { status: string }) {
    return this.http.put(`${this.API_URL}/attendance/${id}`, data);
  }

  // Obtener asignaciones del profesor
  getTeacherAssignments(teacherId: number): Observable<any[]> {
    console.log('🔍 getTeacherAssignments - Teacher ID:', teacherId);
    console.log('🔍 getTeacherAssignments - Token disponible:', !!localStorage.getItem('token'));
    
    return this.http.get<any>(`${this.API_URL}/teacher-subject-groups/teacher/${teacherId}`).pipe(
      map((res: any) => {
        console.log('📡 Respuesta raw de asignaciones:', res);
        
        // Asegurar que siempre devuelva un array
        let assignments: any[] = [];
        
        if (res && typeof res === 'object') {
          if (res.data && res.data.teacherSubjectGroups && Array.isArray(res.data.teacherSubjectGroups)) {
            assignments = res.data.teacherSubjectGroups;
          } else if (Array.isArray(res)) {
            assignments = res;
          } else if (res.data && Array.isArray(res.data)) {
            assignments = res.data;
          } else if (res.assignments && Array.isArray(res.assignments)) {
            assignments = res.assignments;
          }
        }
        
        console.log('Asignaciones procesadas:', assignments);
        return assignments;
      }),
      catchError((error: any) => {
        console.error('Error al obtener asignaciones del profesor:', error);
        console.error('Status del error:', error.status);
        console.error('Mensaje del error:', error.message);
        console.error('URL que causó el error:', `${this.API_URL}/teacher-subject-groups/teacher/${teacherId}`);
        
        // Si es un error 403, verificar el token
        if (error.status === 403) {
          const token = localStorage.getItem('token');
          console.error('Error 403 - Token disponible:', !!token);
          console.error('Error 403 - Token completo:', token);
        }
        
        return of([]); // Devolver array vacío en caso de error
      })
    );
  }

  // Obtener alumnos de un grupo específico
  getStudentsByGroup(groupId: number): Observable<any[]> {
    return this.http.get<any>(`${this.API_URL}/student-groups/`).pipe(
      map((res: any) => {
        console.log('📡 Respuesta raw de student-groups:', res);
        
        // Asegurar que siempre devuelva un array
        let studentGroups: any[] = [];
        
        if (res && typeof res === 'object') {
          if (res.data && Array.isArray(res.data)) {
            studentGroups = res.data;
          } else if (Array.isArray(res)) {
            studentGroups = res;
          }
        }
        
        // Filtrar solo los estudiantes del grupo especificado
        const studentsInGroup = studentGroups.filter((sg: any) => 
          sg.group_id === groupId
        );
        
        // Extraer información de los estudiantes según la estructura real de la API
        const students = studentsInGroup.map((sg: any) => {
          // Según la estructura que me mostraste: { "student_id": 15, "users": { "id": 15, "first_name": "Juan", "last_name": "Pérez" } }
          const user = sg.users;
          return {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            student_id: sg.student_id,
            group_id: sg.group_id
          };
        });
        
        console.log('Estudiantes del grupo', groupId, ':', students);
        return students;
      }),
      catchError((error) => {
        console.error('Error al obtener estudiantes del grupo:', error);
        return of([]);
      })
    );
  }
}
