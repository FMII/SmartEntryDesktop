import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
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
  private apiUrl = 'http://localhost:3000/api'; // Tu API real
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

  getCompleteSchedule(teacherId?: number): Observable<CompleteSchedule> {
    const params: any = {};
    if (teacherId) params.teacher_id = teacherId;

    const cacheKey = this.getCacheKey('complete_schedule', params);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return of(cached.data);
    }

    return this.http.get<CompleteSchedule>(`${this.apiUrl}/teacher-subject-groups/`, { params }).pipe(
      timeout(20000),
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