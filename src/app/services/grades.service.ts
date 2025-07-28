import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, timeout, shareReplay, map, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class GradesService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<any> {
    let errorMessage = 'Ocurrió un error inesperado';
    
    console.error('❌ Error detallado en GradesService:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      message: error.message,
      error: error.error
    });
    
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
    console.log('📡 GET /api/groups/list');
    console.log('🔑 Token disponible:', !!localStorage.getItem('token'));
    console.log('🔑 Token completo:', localStorage.getItem('token'));
    console.log('🌐 URL completa:', `${this.apiUrl}/groups/list`);
    return this.http.get<any>(`${this.apiUrl}/groups/list`).pipe(
      timeout(10000),
      map(response => {
        console.log('📦 Respuesta grupos:', response);
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
    console.log('📡 GET /api/groups/');
    console.log('🔑 Token disponible:', !!localStorage.getItem('token'));
    return this.http.get<any>(`${this.apiUrl}/groups/`).pipe(
      timeout(10000),
      map(response => {
        console.log('📦 Respuesta grupos (alternativo):', response);
        const groups = response?.data || [];
        return Array.isArray(groups) ? groups : [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener alumnos de un grupo
  getStudentsByGroup(groupId: number): Observable<any[]> {
    console.log('📡 GET /api/student-groups/ (todos) y filtrar por grupo');
    console.log('🌐 URL completa:', `${this.apiUrl}/student-groups/`);
    console.log('🔍 Grupo ID a filtrar:', groupId);
    return this.http.get<any>(`${this.apiUrl}/student-groups/`).pipe(
      timeout(10000),
      map(response => {
        console.log('📦 Respuesta todas las asignaciones:', response);
        // Manejar la estructura real de la API: { status, data, msg }
        const allAssignments = response?.data || [];
        const assignments = Array.isArray(allAssignments) ? allAssignments : [];
        
        console.log('📦 Total de asignaciones encontradas:', assignments.length);
        console.log('📦 Ejemplo de asignación:', assignments[0]);
        
        // Filtrar por grupo
        const groupAssignments = assignments.filter((assignment: any) => {
          const matchesGroup = assignment.group_id === groupId;
          console.log(`🔍 Asignación ${assignment.id}: group_id=${assignment.group_id}, matches=${matchesGroup}`);
          return matchesGroup;
        });
        
        console.log('📦 Asignaciones filtradas por grupo:', groupAssignments);
        return groupAssignments;
      }),
      shareReplay(1),
      catchError(this.handleError)
    );
  }

  // Obtener todos los estudiantes (fallback)
  getAllStudents(): Observable<any[]> {
    console.log('📡 GET /api/student-groups/');
    return this.http.get<any>(`${this.apiUrl}/student-groups/`).pipe(
      timeout(10000),
      map(response => {
        console.log('📦 Respuesta todos los estudiantes:', response);
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
        console.log('📦 Respuesta calificaciones por estudiante:', response);
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
    console.log('📤 POST /api/grades con datos:', data);
    console.log('🔑 Token disponible:', !!localStorage.getItem('token'));
    return this.http.post(`${this.apiUrl}/grades`, data).pipe(
      timeout(10000),
      map(response => {
        console.log('✅ Calificación creada exitosamente:', response);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  // Actualizar calificación existente
  updateGrade(gradeId: number, data: any): Observable<any> {
    console.log('📤 PUT /api/grades/:gradeId con datos:', data);
    console.log('🔑 Token disponible:', !!localStorage.getItem('token'));
    return this.http.put(`${this.apiUrl}/grades/${gradeId}`, data).pipe(
      timeout(10000),
      map(response => {
        console.log('✅ Calificación actualizada exitosamente:', response);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  // Obtener calificaciones de todos los alumnos de un grupo
  getAllGradesForGroup(groupId: number): Observable<any[]> {
    return this.getStudentsByGroup(groupId);
  }

  // Obtener materias y grupos asignados a un profesor
  getTeacherAssignments(teacherId: number): Observable<any[]> {
    console.log('📡 GET /api/teacher-subject-groups/teacher/:teacherId para profesor:', teacherId);
    console.log('🔑 Token disponible:', !!localStorage.getItem('token'));
    return this.http.get<any>(`${this.apiUrl}/teacher-subject-groups/teacher/${teacherId}`).pipe(
      timeout(10000),
      map(response => {
        console.log('📦 Respuesta asignaciones:', response);
        const assignments = response?.data || [];
        console.log('📦 Asignaciones procesadas:', assignments);
        console.log('📦 Ejemplo de asignación:', assignments[0]);
        return Array.isArray(assignments) ? assignments : [];
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
        console.log('📦 Respuesta calificaciones por estudiante y materia:', response);
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
    console.log('📡 GET /api/subjects/:subjectId para unidades');
    console.log('🔑 Token disponible:', !!localStorage.getItem('token'));
    console.log('🌐 URL completa:', `${this.apiUrl}/subjects/${subjectId}`);
    console.log('🔢 Subject ID:', subjectId);
    
    return this.http.get<any>(`${this.apiUrl}/subjects/${subjectId}`).pipe(
      timeout(10000),
      map(response => {
        console.log('📦 Respuesta configuración de materia:', response);
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
        
        console.log('✅ Unidades configuradas para', subjectName, ':', units);
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

  // Obtener calificaciones por materia
  getGradesBySubject(subjectId: number): Observable<any> {
    console.log('📡 GET /api/grades/subject/:subjectId');
    return this.http.get<any>(`${this.apiUrl}/grades/subject/${subjectId}`).pipe(
      timeout(10000),
      map(response => {
        console.log('📦 Respuesta calificaciones por materia:', response);
        return response;
      }),
      catchError((error: any) => {
        console.error('❌ Error al obtener calificaciones por materia:', error);
        return of({ data: { grades: [] } });
      })
    );
  }
} 