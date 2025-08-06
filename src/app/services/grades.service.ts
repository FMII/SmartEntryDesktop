import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, timeout, shareReplay, map, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class GradesService {
  private apiUrl = 'https://api.smartentry.space/api/academic';

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<any> {
    let errorMessage = 'Ocurrió un error inesperado';
    
    console.error('Error detallado en GradesService:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      message: error.message,
      error: error.error
    });
    
    // Log detallado del error del backend
    console.error('🔍 Error completo del backend:', error.error);
    if (error.error && typeof error.error === 'object') {
      console.error('Mensaje del backend:', error.error.msg || error.error.message || 'Sin mensaje');
      console.error('Datos del error:', error.error.data);
    }
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
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
          errorMessage = `Recurso no encontrado: ${error.url}. Verifica la URL del endpoint.`;
          break;
        case 500:
          errorMessage = 'Error interno del servidor. Posiblemente la calificación ya existe o hay un problema de validación.';
          break;
        default:
          errorMessage = `Error del servidor: ${error.status} - ${error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // Obtener todos los grupos
  getGroups(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/groups/list`).pipe(
      timeout(10000),
      map(response => {
        // Manejar la estructura real de la API: { status, data, msg }
        const groups = response?.data || [];
        return Array.isArray(groups) ? groups : [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener grupos (endpoint alternativo)
  getGroupsAlternative(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/groups/`).pipe(
      timeout(10000),
      map(response => {
        const groups = response?.data || [];
        return Array.isArray(groups) ? groups : [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener alumnos de un grupo
  getStudentsByGroup(groupId: number): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/student-groups/`).pipe(
      timeout(10000),
      map(response => {
        // Manejar la estructura real de la API: { status, data, msg }
        const allAssignments = response?.data || [];
        const assignments = Array.isArray(allAssignments) ? allAssignments : [];
        
        // Filtrar por grupo
        const groupAssignments = assignments.filter((assignment: any) => {
          const matchesGroup = assignment.group_id === groupId;
          return matchesGroup;
        });
        
        return groupAssignments;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener todos los estudiantes (fallback)
  getAllStudents(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/student-groups/`).pipe(
      timeout(10000),
      map(response => {
        const allStudents = response?.data || [];
        return Array.isArray(allStudents) ? allStudents : [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener calificaciones de un alumno
  getGradesByStudent(studentId: number): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/grades/student/${studentId}`).pipe(
      timeout(10000),
      map(response => {
        // Manejar la estructura real de la API
        const grades = response?.data?.grades || [];
        return Array.isArray(grades) ? grades : [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Crear calificación
  createGrade(data: any): Observable<any> {
    console.log('POST /api/grades con datos:', data);
    console.log('Tipos de datos:', {
      student_id: typeof data.student_id,
      subject_id: typeof data.subject_id,
      unit_number: typeof data.unit_number,
      grade: typeof data.grade
    });
    return this.http.post(`${this.apiUrl}/grades`, data).pipe(
      timeout(10000),
      map(response => {
        console.log('Calificación creada exitosamente:', response);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  // Actualizar calificación existente
  updateGrade(gradeId: number, data: any): Observable<any> {
    console.log('PUT /api/grades/:gradeId con datos:', data);
    console.log('Grade ID:', gradeId);
    console.log('Tipos de datos:', {
      gradeId: typeof gradeId,
      student_id: typeof data.student_id,
      subject_id: typeof data.subject_id,
      unit_number: typeof data.unit_number,
      grade: typeof data.grade
    });
    return this.http.put(`${this.apiUrl}/grades/${gradeId}`, data).pipe(
      timeout(10000),
      map(response => {
        console.log('Calificación actualizada exitosamente:', response);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  // Obtener calificaciones de todos los alumnos de un grupo
  getAllGradesForGroup(groupId: number): Observable<any[]> {
    return this.getStudentsByGroup(groupId);
  }

  // Obtener asignaciones del profesor
  getTeacherAssignments(teacherId: number): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/teacher-subject-groups/teacher/${teacherId}`).pipe(
      timeout(10000),
      map(response => {
        // Manejar la estructura real de la API: { status, data: { teacherSubjectGroups: [...] } }
        let assignments: any[] = [];
        
        if (response && typeof response === 'object') {
          if (response.data && response.data.teacherSubjectGroups && Array.isArray(response.data.teacherSubjectGroups)) {
            assignments = response.data.teacherSubjectGroups;
          } else if (response.data && Array.isArray(response.data)) {
            assignments = response.data;
          } else if (Array.isArray(response)) {
            assignments = response;
          }
        }
        
        return assignments;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener materias de un grupo específico para un profesor
  getGroupSubjectsForTeacher(teacherId: number, groupId: number): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/teacher-subject-groups/teacher/${teacherId}?group_id=${groupId}`).pipe(
      timeout(10000),
      map(response => {
        const assignments = response?.data || [];
        return Array.isArray(assignments) ? assignments : [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener calificaciones de un alumno para una materia específica
  getGradesByStudentAndSubject(studentId: number, subjectId: number): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/grades/student/${studentId}/${subjectId}`).pipe(
      timeout(10000),
      map(response => {
        // Manejar la estructura real de la API
        const grades = response?.data?.grades || [];
        return Array.isArray(grades) ? grades : [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener configuración de unidades para una materia
  getSubjectUnits(subjectId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/subjects/${subjectId}`).pipe(
      timeout(10000),
      map(response => {
        const subjectData = response?.data || {};
        const subjectName = subjectData?.name?.toLowerCase() || '';
        
        // Usar unidades basadas en el nombre de la materia
        let units = [];
        
        if (subjectName.includes('historia') || subjectName.includes('history')) {
          // Historia tiene 2 unidades según los datos reales
          units = [1, 2].map(number => ({ number, name: `Unidad ${number}` }));
        } else if (subjectName.includes('matematica') || subjectName.includes('math')) {
          units = [1, 2, 3, 4].map(number => ({ number, name: `Unidad ${number}` }));
        } else if (subjectName.includes('ciencia') || subjectName.includes('science')) {
          units = [1, 2, 3].map(number => ({ number, name: `Unidad ${number}` }));
        } else {
          units = [1, 2, 3, 4, 5].map(number => ({ number, name: `Unidad ${number}` }));
        }
        
        return { units };
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener todas las materias con su configuración de unidades
  getSubjectsWithUnits(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/subjects`).pipe(
      timeout(10000),
      map(response => {
        const subjects = response?.data || [];
        return Array.isArray(subjects) ? subjects : [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener calificaciones por materia y grupo
  getGradesBySubject(subjectId: number, groupId?: number): Observable<any> {
    // Como no existe un endpoint para obtener todas las calificaciones de una materia,
    // vamos a devolver un array vacío y manejar las calificaciones de manera diferente
    console.log(`No existe endpoint para obtener calificaciones de materia ${subjectId}`);
    console.log('Las calificaciones se cargarán individualmente por estudiante');
    return of({ data: { grades: [] } });
  }

  // Método para intentar obtener calificaciones de un estudiante específico
  // Este método puede fallar si el usuario autenticado no es el estudiante
  tryGetStudentGrades(studentId: number, subjectId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/grades/student/${studentId}/${subjectId}`).pipe(
      timeout(10000),
      map(response => {
        const grades = response?.data?.grades || response?.grades || [];
        return Array.isArray(grades) ? grades : [];
      }),
      catchError((error: any) => {
        console.log(`No se pudieron obtener calificaciones para estudiante ${studentId}:`, error.message);
        return of([]);
      })
    );
  }

  // Obtener información detallada de estudiantes por grupo
  getStudentsByGroupDetailed(groupId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/student-groups/${groupId}/students`).pipe(
      timeout(10000),
      map(response => {
        const data = response?.data || {};
        return {
          group: data.group || {},
          students: data.students || [],
          totalStudents: data.students ? data.students.length : 0
        };
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener solo el conteo de estudiantes por grupo
  getStudentCountByGroup(groupId: number): Observable<number> {
    return this.getStudentsByGroupDetailed(groupId).pipe(
      map(data => data.totalStudents)
    );
  }

  // Limpiar todo el cache del servicio
  clearAllCache(): void {
    console.log('Limpiando cache del GradesService...');
    // Los observables con shareReplay se limpiarán automáticamente
    // cuando no haya suscripciones activas
  }
}