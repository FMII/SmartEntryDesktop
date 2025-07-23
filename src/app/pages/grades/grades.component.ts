import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-grades',
  standalone: true,
  templateUrl: './grades.component.html',
  styleUrls: ['./grades.component.css'],
  imports: [CommonModule, FormsModule, RouterLink]
})
export class GradesComponent implements OnInit {
  // Datos de ejemplo (deberías reemplazarlos con tus datos reales)
  grupos = [
    { id: 1, nombre: 'Grupo A' },
    { id: 2, nombre: 'Grupo B' },
    { id: 3, nombre: 'Grupo C' }
  ];

  alumnos = [
    { id: 1, matricula: '2023001', nombre: 'Juan Pérez', grupo: 'Grupo A', grupoId: 1, materia: 'Matemáticas', u1: 85, u2: 90, u3: 88 },
    { id: 2, matricula: '2023002', nombre: 'María García', grupo: 'Grupo A', grupoId: 1, materia: 'Matemáticas', u1: 92, u2: 95, u3: 93 },
    { id: 3, matricula: '2023003', nombre: 'Carlos López', grupo: 'Grupo B', grupoId: 2, materia: 'Matemáticas', u1: 78, u2: 85, u3: 80 },
    { id: 4, matricula: '2023004', nombre: 'Ana Martínez', grupo: 'Grupo C', grupoId: 3, materia: 'Matemáticas', u1: 88, u2: 82, u3: 90 }
  ];

  // Variables para filtrado
  searchQuery: string = '';
  selectedGroup: any = null;
  activeTab: string = '1';
  alumnosFiltrados: any[] = [];

  ngOnInit(): void {
    this.filtrarAlumnos();
  }

  // Filtra alumnos por grupo y búsqueda
  filtrarAlumnos(): void {
    this.alumnosFiltrados = this.alumnos.filter(alumno => {
      const matchesSearch = !this.searchQuery || 
        alumno.nombre.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        alumno.matricula.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesGroup = !this.selectedGroup || alumno.grupoId == this.selectedGroup;
      
      return matchesSearch && matchesGroup;
    });
  }

  // Calcula el promedio de un alumno
  calcularPromedio(alumno: any): number {
    return Math.round((alumno.u1 + alumno.u2 + alumno.u3) / 3);
  }

  // Guarda las calificaciones (simulado)
  guardarCalificaciones(alumno: any): void {
    // Aquí iría la lógica para guardar en el backend
    console.log('Guardando calificaciones:', alumno);
    alert(`Calificaciones de ${alumno.nombre} guardadas correctamente`);
  }

  // Cambia la pestaña activa
  changeTab(tab: string): void {
    this.activeTab = tab;
    // Aquí podrías cargar datos diferentes según el periodo seleccionado
    console.log('Cambiando a periodo:', tab);
  }

  // Método alternativo para filtrar solo por grupo
  filtrarGrupo(): void {
    this.filtrarAlumnos();
  }
}