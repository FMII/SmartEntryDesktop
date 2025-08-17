import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, BehaviorSubject } from 'rxjs';
import { catchError, timeout, shareReplay, map } from 'rxjs/operators';

export interface Grupo {
  id: number;
  name: string;
  grade?: string;
}

export interface Materia {
  id: number;
  name: string;
  subject_id?: number;
}

export interface Asistencia {
  id: number;
  user_id: number; // Cambiado de student_id a user_id para coincidir con la API
  student_name?: string; // Opcional porque se agrega después del join
  date: string;
  status: 'present' | 'absent' | 'late';
  subject_id: number;
  subject_name?: string; // Opcional porque se agrega después del join
  group_id?: number; // Opcional porque se obtiene del alumno
  group_name?: string; // Opcional porque se agrega después del join
  check_in_time?: string;
  sensor_id?: number;
  notes?: string;
}

export interface EstadisticasAsistencia {
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceHistoryService {
  private apiUrl = 'https://api.smartentry.space/api/academic'; // Tu API real
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private http: HttpClient) {}

  private getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}${params ? JSON.stringify(params) : ''}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  private clearCache(): void {
    this.cache.clear();
  }

  private clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  private handleError(error: HttpErrorResponse): Observable<any> {
    let errorMessage = 'Ocurrió un error inesperado';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 0:
          errorMessage = 'No se puede conectar al servidor. Verifica que el servidor esté ejecutándose.';
          break;
        case 400:
          errorMessage = 'Solicitud incorrecta. Verifica los datos enviados.';
          break;
        case 401:
          errorMessage = 'No autorizado. Verifica tus credenciales.';
          break;
        case 403:
          errorMessage = 'Acceso denegado. No tienes permisos para esta acción.';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado. Verifica la URL del endpoint.';
          break;
        case 500:
          errorMessage = 'Error interno del servidor. Intenta más tarde.';
          break;
        default:
          errorMessage = `Error del servidor: ${error.status} - ${error.message}`;
      }
    }
    
    console.error('Error en AttendanceHistoryService:', error);
    return throwError(() => new Error(errorMessage));
  }

  getGrupos(): Observable<Grupo[]> {
    const cacheKey = this.getCacheKey('grupos');
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
              console.log('Grupos desde cache:', cached.data);
      return of(cached.data);
    }

    console.log('📡 Enviando GET /api/groups/list');
    return this.http.get<{data: Grupo[]}>(`${this.apiUrl}/groups/list`).pipe(
      timeout(10000),
      map(response => {
        console.log('Respuesta raw de grupos:', response);
        console.log('Tipo de respuesta:', typeof response);
        console.log('Es array?', Array.isArray(response));
        
        // Extraer data del objeto de respuesta
        let processedResponse: Grupo[] = [];
        if (response && typeof response === 'object') {
          if (response.data && Array.isArray(response.data)) {
            processedResponse = response.data;
          } else if (Array.isArray(response)) {
            processedResponse = response;
          }
        }
        
        console.log('Grupos procesados:', processedResponse);
        
        this.cache.set(cacheKey, { data: processedResponse, timestamp: Date.now() });
        return processedResponse;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  getMaterias(): Observable<Materia[]> {
    const cacheKey = this.getCacheKey('materias');
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
              console.log('Materias desde cache:', cached.data);
      return of(cached.data);
    }

    console.log('📡 Enviando GET /api/subjects');
    return this.http.get<{data: Materia[]}>(`${this.apiUrl}/subjects`).pipe(
      timeout(10000),
      map(response => {
        console.log('Respuesta raw de materias:', response);
        console.log('Tipo de respuesta:', typeof response);
        console.log('Es array?', Array.isArray(response));
        
        // Extraer data del objeto de respuesta
        let processedResponse: Materia[] = [];
        if (response && typeof response === 'object') {
          if (response.data && Array.isArray(response.data)) {
            processedResponse = response.data;
          } else if (Array.isArray(response)) {
            processedResponse = response;
          }
        }
        
        console.log('Materias procesadas:', processedResponse);
        
        this.cache.set(cacheKey, { data: processedResponse, timestamp: Date.now() });
        return processedResponse;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  getHistorialAsistencia(
    groupId?: number,
    subjectId?: number,
    startDate?: string,
    endDate?: string,
    searchTerm?: string
  ): Observable<Asistencia[]> {
    // Validar que al menos se proporcione un groupId
    if (!groupId) {
      console.warn('⚠️ getHistorialAsistencia llamado sin groupId');
      return of([]);
    }

    const params: any = {};
    
    // Usar los nombres de parámetros que espera tu nueva API
    if (subjectId) params.subject_id = subjectId;
    if (startDate) {
      params.startDate = startDate; // Cambio: start_date -> startDate
      console.log('📅 Enviando startDate:', startDate, 'Tipo:', typeof startDate);
    }
    if (endDate) {
      params.endDate = endDate; // Cambio: end_date -> endDate
      console.log('📅 Enviando endDate:', endDate, 'Tipo:', typeof endDate);
    }
    if (searchTerm) params.search = searchTerm;

    // Usar la nueva ruta con groupId en la URL
    const url = `${this.apiUrl}/attendance/group/${groupId}`;
    
    
    return this.http.get<any>(url, { params }).pipe(
      timeout(15000),
      map(response => {
        console.log('Respuesta raw de historial (nueva API):', response);
        
        // Extraer data del objeto de respuesta según la nueva estructura
        let processedResponse: Asistencia[] = [];
        
        if (response && response.status === 'success' && response.data && Array.isArray(response.data)) {
          // Procesar cada registro de asistencia
          processedResponse = response.data.map((item: any) => {
            // Extraer información del usuario
            const userData = item.users_attendance_user_idTousers || {};
            const studentName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
            
            // Extraer información de la materia
            const subjectName = item.subjects?.name || 'Sin materia';
            
            return {
              id: item.id,
              user_id: item.user_id, // Este campo debería venir en la respuesta
              student_name: studentName,
              date: item.date,
              status: item.status,
              subject_id: subjectId || 0, // Usar el subjectId del parámetro
              subject_name: subjectName,
              group_id: groupId, // Usar el groupId del parámetro
              group_name: '', // Se llenará después con el join en el componente
              check_in_time: item.check_in_time,
              sensor_id: item.sensor_id,
              notes: item.notes
            } as Asistencia;
          });
        } else if (Array.isArray(response)) {
          // Fallback si la respuesta es directamente un array
          processedResponse = response;
        }
        
        console.log('Historial procesado (nueva API):', processedResponse);
        console.log(`✅ Se procesaron ${processedResponse.length} registros de asistencia`);
        
        return processedResponse;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  actualizarAsistencia(asistenciaId: number, status: 'present' | 'absent' | 'late'): Observable<any> {
    return this.http.put(`${this.apiUrl}/attendance/${asistenciaId}`, { status }).pipe(
      timeout(10000),
      map(() => {
        // Clear cache for attendance data
        this.clearCacheByPattern('historial');
        return { success: true };
      }),
      catchError(this.handleError)
    );
  }

  getEstadisticasAsistencia(
    groupId?: number,
    subjectId?: number,
    startDate?: string,
    endDate?: string
  ): Observable<EstadisticasAsistencia> {
    const params: any = {};
    
    if (groupId) params.group_id = groupId;
    if (subjectId) params.subject_id = subjectId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const cacheKey = this.getCacheKey('estadisticas', params);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return of(cached.data);
    }

    return this.http.get<EstadisticasAsistencia>(`${this.apiUrl}/attendance`, { params }).pipe(
      timeout(10000),
      map(response => {
        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
        return response;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Method to clear cache when needed
  clearAllCache(): void {
    this.clearCache();
  }

  // Obtener asignaciones del profesor
  getTeacherAssignments(teacherId: number): Observable<any[]> {
    console.log('📡 Obteniendo asignaciones del profesor:', teacherId);
    return this.http.get<any>(`${this.apiUrl}/teacher-subject-groups/teacher/${teacherId}`).pipe(
      timeout(10000),
      map((res: any) => {
        console.log('Respuesta raw de asignaciones:', res);
        
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
        
        console.log('Asignaciones del profesor obtenidas:', assignments);
        return assignments;
      }),
      catchError((error: any) => {
        console.error('Error al obtener asignaciones del profesor:', error);
        return of([]); // Devolver array vacío en caso de error
      }),
      shareReplay(1)
    );
  }

  // Obtener materias asignadas al profesor
  getMateriasAsignadas(teacherId: number): Observable<Materia[]> {
    return this.getTeacherAssignments(teacherId).pipe(
      map(assignments => {
        const materias = assignments.map((assignment: any) => ({
          id: assignment.subjects?.id || assignment.subject_id,
          name: assignment.subjects?.name || 'Sin nombre',
          subject_id: assignment.subject_id
        }));
        
        // Eliminar duplicados basándose en el ID de la materia
        const uniqueMaterias = materias.filter((materia, index, self) => 
          index === self.findIndex(m => m.id === materia.id)
        );
        
        console.log('Materias asignadas al profesor:', uniqueMaterias);
        return uniqueMaterias;
      })
    );
  }

  // Obtener grupos asignados al profesor
  getGruposAsignados(teacherId: number): Observable<Grupo[]> {
    return this.getTeacherAssignments(teacherId).pipe(
      map(assignments => {
        const grupos = assignments.map((assignment: any) => ({
          id: assignment.groups?.id || assignment.group_id,
          name: assignment.groups?.name || 'Sin nombre',
          grade: assignment.groups?.grade
        }));
        
        // Eliminar duplicados basándose en el ID del grupo
        const uniqueGrupos = grupos.filter((grupo, index, self) => 
          index === self.findIndex(g => g.id === grupo.id)
        );
        
        console.log('Grupos asignados al profesor:', uniqueGrupos);
        return uniqueGrupos;
      })
    );
  }

  // Obtener alumnos del grupo
  getAlumnosDelGrupo(groupId: number): Observable<any[]> {
    console.log('📡 Obteniendo alumnos del grupo:', groupId);
    
    // Usar el endpoint correcto según la documentación del usuario
    return this.http.get<any>(`${this.apiUrl}/student-groups/${groupId}/students`).pipe(
      timeout(10000),
      map(response => {
        console.log('Respuesta alumnos del grupo específico:', response);
        let students: any[] = [];

        if (response && typeof response === 'object') {
          if (response.status === 'success' && response.data && response.data.students && Array.isArray(response.data.students)) {
            // Extraer la lista de estudiantes del objeto data.students
            students = response.data.students.map((student: any) => ({
              id: student.student_id,
              user_id: student.student_id,
              first_name: student.first_name,
              last_name: student.last_name,
              email: student.email,
              academic_year: student.academic_year,
              group_id: groupId
            }));
          } else if (response.data && Array.isArray(response.data)) {
            // Fallback si la estructura es diferente
            students = response.data;
          }
        }

        console.log('Alumnos del grupo', groupId, 'procesados:', students);
        return students;
      }),
      catchError(error => {
        console.log('Endpoint específico falló, intentando con endpoint general...');
        
        // Fallback: obtener todos los estudiantes y filtrar por grupo
        return this.http.get<any>(`${this.apiUrl}/student-groups/`).pipe(
          timeout(10000),
          map(response => {
            console.log('Respuesta todos los estudiantes (fallback):', response);
            const allStudents = response?.data || [];
            const students = Array.isArray(allStudents) ? allStudents : [];

            // Filtrar por grupo
            const groupStudents = students.filter((student: any) =>
              student.group_id === groupId
            );

            // Mapear a la estructura esperada
            const mappedStudents = groupStudents.map((student: any) => ({
              id: student.student_id || student.id,
              user_id: student.student_id || student.id,
              first_name: student.users?.first_name || student.first_name,
              last_name: student.users?.last_name || student.last_name,
              email: student.users?.email || student.email,
              academic_year: student.academic_year,
              group_id: groupId
            }));

            console.log('Alumnos del grupo', groupId, ' (fallback):', mappedStudents);
            return mappedStudents;
          })
        );
      }),
      shareReplay(1)
    );
  }


} 