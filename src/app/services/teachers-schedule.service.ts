import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { catchError, timeout, shareReplay, map } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface Teacher {
  id: number;
  name: string;
  email: string;
}

export interface Group {
  id: number;
  name: string;
  grade?: string;
}

export interface Subject {
  id: number;
  name: string;
  subject_id?: number;
}

export interface Schedule {
  id: number;
  teacher_id: number;
  teacher_name: string;
  subject_id: number;
  subject_name: string;
  group_id: number;
  group_name: string;
  day: string;
  start_time: string;
  end_time: string;
  classroom?: string;
}

export interface CompleteSchedule {
  teacher: Teacher;
  groups: Group[];
  subjects: Subject[];
  schedules: Schedule[];
}

@Injectable({
  providedIn: 'root'
})
export class TeachersScheduleService {
  private apiUrl = 'http://localhost:3000/api/academic'; // Tu API real
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

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
    
    console.error('Error en TeachersScheduleService:', error);
    return throwError(() => new Error(errorMessage));
  }

  getGroups(): Observable<Group[]> {
    const cacheKey = this.getCacheKey('groups');
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return of(cached.data);
    }

    return this.http.get<Group[]>(`${this.apiUrl}/groups/list`).pipe(
      timeout(10000),
      map(response => {
        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
        return response;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  getTeachers(): Observable<Teacher[]> {
    const cacheKey = this.getCacheKey('teachers');
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return of(cached.data);
    }

    // Intentar obtener profesores del endpoint de asignaciones del profesor actual
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.id) {
      console.log('👤 Obteniendo profesores usando asignaciones del usuario actual');
      return this.getTeacherAssignments(currentUser.id).pipe(
        map(assignments => {
          // Extraer información de profesores de las asignaciones
          const teachers = new Map<number, Teacher>();
          
          assignments.forEach((assignment: any) => {
            if (assignment.teacher_id && assignment.teacher_name) {
              teachers.set(assignment.teacher_id, {
                id: assignment.teacher_id,
                name: assignment.teacher_name,
                email: assignment.teacher_email || ''
              });
            }
          });
          
          const teachersArray = Array.from(teachers.values());
          this.cache.set(cacheKey, { data: teachersArray, timestamp: Date.now() });
          return teachersArray;
        }),
        catchError(error => {
          console.log('⚠️ Error obteniendo profesores, devolviendo array vacío');
          return of([]);
        })
      );
    }

    // Fallback: devolver array vacío si no hay usuario autenticado
    console.log('⚠️ No hay usuario autenticado, devolviendo array vacío de profesores');
    return of([]);
  }

  getTeacherSchedule(teacherId: number): Observable<Schedule[]> {
    const cacheKey = this.getCacheKey('teacher_schedule', { teacherId });
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return of(cached.data);
    }

    return this.http.get<Schedule[]>(`${this.apiUrl}/teacher-subject-groups/`).pipe(
      timeout(15000),
      map(response => {
        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
        return response;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  getSubjects(): Observable<Subject[]> {
    const cacheKey = this.getCacheKey('subjects');
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return of(cached.data);
    }

    return this.http.get<Subject[]>(`${this.apiUrl}/subjects`).pipe(
      timeout(10000),
      map(response => {
        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
        return response;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  getSchedules(filters?: any): Observable<Schedule[]> {
    const params: any = {};
    
    if (filters?.teacherId) params.teacher_id = filters.teacherId;
    if (filters?.groupId) params.group_id = filters.groupId;
    if (filters?.subjectId) params.subject_id = filters.subjectId;
    if (filters?.day) params.day = filters.day;

    const cacheKey = this.getCacheKey('schedules', params);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return of(cached.data);
    }

    return this.http.get<Schedule[]>(`${this.apiUrl}/schedules`, { params }).pipe(
      timeout(15000),
      map(response => {
        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
        return response;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  getCompleteScheduleData(teacherId: number, groupId?: number, subjectId?: number): Observable<any> {
    const cacheKey = this.getCacheKey('complete_schedule_data', { teacherId, groupId, subjectId });
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return of(cached.data);
    }

    // Combinar múltiples endpoints usando forkJoin
    return forkJoin({
      teacherAssignments: this.http.get<any>(`${this.apiUrl}/teacher-subject-groups/teacher/${teacherId}`),
      groups: this.http.get<any>(`${this.apiUrl}/groups/list`),
      subjects: this.http.get<any>(`${this.apiUrl}/subjects/`),
      schedules: this.http.get<any>(`${this.apiUrl}/schedules/`)
    }).pipe(
      timeout(20000),
      map(response => {
        // Procesar y combinar los datos
        const processedData = this.processCombinedData(response, teacherId, groupId, subjectId);
        
        this.cache.set(cacheKey, { data: processedData, timestamp: Date.now() });
        return processedData;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  private processCombinedData(response: any, teacherId: number, groupId?: number, subjectId?: number): any {
    const { teacherAssignments, groups, subjects, schedules } = response;
    
    console.log('🔍 Procesando datos combinados:', { teacherAssignments, groups, subjects, schedules });
    
    // Filtrar asignaciones del profesor
    let filteredAssignments: any[] = teacherAssignments.data?.teacherSubjectGroups || teacherAssignments || [];
    
    if (groupId) {
      filteredAssignments = filteredAssignments.filter((assignment: any) => 
        assignment.group_id == groupId
      );
    }
    
    if (subjectId) {
      filteredAssignments = filteredAssignments.filter((assignment: any) => 
        assignment.subject_id == subjectId
      );
    }

    // Normalizar grupos - asegurar que sea un array
    let normalizedGroups: any[] = [];
    if (groups) {
      if (groups.data && Array.isArray(groups.data)) {
        normalizedGroups = groups.data;
      } else if (Array.isArray(groups)) {
        normalizedGroups = groups;
      } else if (groups.data && groups.data.groups && Array.isArray(groups.data.groups)) {
        normalizedGroups = groups.data.groups;
      }
    }

    // Normalizar materias - asegurar que sea un array
    let normalizedSubjects: any[] = [];
    if (subjects) {
      if (subjects.data && Array.isArray(subjects.data)) {
        normalizedSubjects = subjects.data;
      } else if (Array.isArray(subjects)) {
        normalizedSubjects = subjects;
      } else if (subjects.data && subjects.data.subjects && Array.isArray(subjects.data.subjects)) {
        normalizedSubjects = subjects.data.subjects;
      }
    }

    // Normalizar horarios - asegurar que sea un array
    let normalizedSchedules: any[] = [];
    if (schedules) {
      if (schedules.data && schedules.data.schedules && Array.isArray(schedules.data.schedules)) {
        normalizedSchedules = schedules.data.schedules;
      } else if (Array.isArray(schedules)) {
        normalizedSchedules = schedules;
      } else if (schedules.data && Array.isArray(schedules.data)) {
        normalizedSchedules = schedules.data;
      }
    }

    console.log('📊 Datos normalizados:', {
      filteredAssignments: filteredAssignments.length,
      normalizedGroups: normalizedGroups.length,
      normalizedSubjects: normalizedSubjects.length,
      normalizedSchedules: normalizedSchedules.length
    });

    // Combinar datos de horarios con asignaciones
    const combinedSchedules: any[] = [];
    
    filteredAssignments.forEach((assignment: any) => {
      const group = normalizedGroups.find((g: any) => g.id === assignment.group_id);
      const subject = normalizedSubjects.find((s: any) => s.id === assignment.subject_id);
      
      // Buscar horarios relacionados
      normalizedSchedules.forEach((schedule: any) => {
        // Convertir string de tiempo a formato HH:MM
        const formatTime = (timeString: string) => {
          if (!timeString) return '';
          try {
            // Si es un string ISO, extraer solo la parte de tiempo
            if (timeString.includes('T')) {
              return timeString.split('T')[1].slice(0, 5);
            }
            // Si ya es formato HH:MM, devolverlo tal como está
            if (timeString.includes(':')) {
              return timeString.slice(0, 5);
            }
            return timeString;
          } catch (error) {
            console.error('Error formateando tiempo:', timeString, error);
            return '';
          }
        };

        combinedSchedules.push({
          id: schedule.id,
          teacher_id: assignment.teacher_id,
          teacher_name: assignment.users?.first_name + ' ' + assignment.users?.last_name || 'Profesor',
          subject_id: assignment.subject_id,
          subject_name: subject?.name || 'Materia',
          group_id: assignment.group_id,
          group_name: group?.name || 'Grupo',
          day: schedule.weekday,
          start_time: formatTime(schedule.start_time),
          end_time: formatTime(schedule.end_time),
          classroom: assignment.classrooms?.name || ''
        });
      });
    });

    console.log('✅ Horarios combinados generados:', combinedSchedules.length);

    return {
      schedules: combinedSchedules,
      groups: normalizedGroups,
      subjects: normalizedSubjects
    };
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
        
        console.log('✅ Asignaciones del profesor obtenidas:', assignments);
        return assignments;
      }),
      catchError((error: any) => {
        console.error('❌ Error al obtener asignaciones del profesor:', error);
        return of([]); // Devolver array vacío en caso de error
      }),
      shareReplay(1)
    );
  }
} 