import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GradesService {
  private API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // Obtener todos los grupos
  getGroups(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/groups/list`);
  }

  // Obtener alumnos de un grupo
  getStudentsByGroup(groupId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/student-groups/${groupId}/students`);
  }

  // Obtener calificaciones de un alumno
  getGradesByStudent(studentId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/grades/student/${studentId}`);
  }

  // Actualizar calificación
  updateGrade(gradeId: number, data: any): Observable<any> {
    return this.http.put(`${this.API_URL}/grades/${gradeId}`, data);
  }

  // Crear calificación
  createGrade(data: any): Observable<any> {
    return this.http.post(`${this.API_URL}/grades`, data);
  }

  // Obtener calificaciones de todos los alumnos de un grupo
  getAllGradesForGroup(groupId: number): Observable<any[]> {
    return this.getStudentsByGroup(groupId);
    // El componente hará forkJoin para obtener las calificaciones de cada alumno
  }
} 