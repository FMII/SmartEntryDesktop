import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GradesService } from '../../services/grades.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-grades',
  standalone: true,
  templateUrl: './grades.component.html',
  styleUrls: ['./grades.component.css'],
  imports: [CommonModule, FormsModule, RouterLink]
})
export class GradesComponent implements OnInit {
  grupos: any[] = [];
  alumnos: any[] = [];
  alumnosFiltrados: any[] = [];
  searchQuery: string = '';
  selectedGroup: any = null;
  activeTab: string = '1';

  constructor(private gradesService: GradesService) {}

  ngOnInit(): void {
    this.cargarGrupos();
  }

  cargarGrupos(): void {
    this.gradesService.getGroups().subscribe(groups => {
      this.grupos = groups;
    });
  }

  onGroupChange(): void {
    if (!this.selectedGroup) return;
    this.gradesService.getStudentsByGroup(this.selectedGroup).subscribe(students => {
      // Para cada alumno, obtener sus calificaciones
      const requests = students.map((alumno: any) =>
        this.gradesService.getGradesByStudent(alumno.id)
      );
      forkJoin(requests).subscribe(gradesArr => {
        // Unir datos de alumno y sus calificaciones
        this.alumnos = students.map((alumno: any, idx: number) => {
          const grades = gradesArr[idx][0] || {};
          return {
            ...alumno,
            materia: grades.subject_name || '',
            u1: grades.u1 || 0,
            u2: grades.u2 || 0,
            u3: grades.u3 || 0,
            gradeId: grades.id || null
          };
        });
        this.filtrarAlumnos();
      });
    });
  }

  filtrarAlumnos(): void {
    this.alumnosFiltrados = this.alumnos.filter(alumno => {
      const matchesSearch = !this.searchQuery || 
        alumno.nombre?.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        alumno.matricula?.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesGroup = !this.selectedGroup || alumno.group_id == this.selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }

  calcularPromedio(alumno: any): number {
    return Math.round(((alumno.u1 || 0) + (alumno.u2 || 0) + (alumno.u3 || 0)) / 3);
  }

  guardarCalificaciones(alumno: any): void {
    const data = {
      u1: alumno.u1,
      u2: alumno.u2,
      u3: alumno.u3
    };
    if (alumno.gradeId) {
      this.gradesService.updateGrade(alumno.gradeId, data).subscribe(() => {
        alert(`Calificaciones de ${alumno.nombre} actualizadas correctamente`);
      });
    } else {
      // Crear nueva calificación
      const newData = {
        student_id: alumno.id,
        subject_id: alumno.subject_id, // Ajusta si tienes el id de materia
        ...data
      };
      this.gradesService.createGrade(newData).subscribe(() => {
        alert(`Calificaciones de ${alumno.nombre} guardadas correctamente`);
      });
    }
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
    // Aquí podrías cargar datos diferentes según el periodo seleccionado
  }

  filtrarGrupo(): void {
    this.filtrarAlumnos();
  }
}