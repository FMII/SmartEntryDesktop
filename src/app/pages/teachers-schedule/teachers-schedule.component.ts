import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-teachers-schedule',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './teachers-schedule.component.html',
  styleUrls: ['./teachers-schedule.component.css']
})
export class TeachersScheduleComponent implements OnInit {
  // Filtros
  selectedGroup: string = '';
  selectedDocente: string = '';
  
  // Datos de ejemplo (deberías reemplazarlos con datos reales de tu API)
  grupos: any[] = [
    { id: '1', nombre: 'Grupo A' },
    { id: '2', nombre: 'Grupo B' },
    { id: '3', nombre: 'Grupo C' }
  ];
  
  docentes: any[] = [
    { id: '1', nombre: 'Profesor García' },
    { id: '2', nombre: 'Profesora Martínez' },
    { id: '3', nombre: 'Profesor López' }
  ];
  
  horarios: any[] = [
    { id: 1, materia: 'Matemáticas', grupo: 'Grupo A', inicio: '08:00', fin: '10:00', dia: 'Lunes' },
    { id: 2, materia: 'Historia', grupo: 'Grupo B', inicio: '10:00', fin: '12:00', dia: 'Martes' },
    { id: 3, materia: 'Ciencias', grupo: 'Grupo C', inicio: '14:00', fin: '16:00', dia: 'Miércoles' },
    { id: 4, materia: 'Literatura', grupo: 'Grupo A', inicio: '16:00', fin: '18:00', dia: 'Jueves' },
    { id: 5, materia: 'Educación Física', grupo: 'Grupo B', inicio: '08:00', fin: '10:00', dia: 'Viernes' }
  ];
  
  horariosFiltrados: any[] = [];

  ngOnInit(): void {
    this.horariosFiltrados = [...this.horarios];
  }

  filtrarHorarios(): void {
    if (!this.selectedGroup && !this.selectedDocente) {
      this.horariosFiltrados = [...this.horarios];
      return;
    }

    this.horariosFiltrados = this.horarios.filter(horario => {
      const cumpleGrupo = !this.selectedGroup || 
                         horario.grupo === this.grupos.find(g => g.id === this.selectedGroup)?.nombre;
      
      // Aquí deberías implementar la lógica para filtrar por docente
      const cumpleDocente = !this.selectedDocente || true;
      
      return cumpleGrupo && cumpleDocente;
    });
  }
}