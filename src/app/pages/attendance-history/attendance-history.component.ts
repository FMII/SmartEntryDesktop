import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-attendance-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-history.component.html',
  styleUrls: ['./attendance-history.component.css']
})
export class AttendanceHistoryComponent implements OnInit {
  grupos = [
    { id: 1, nombre: 'Grupo A' },
    { id: 2, nombre: 'Grupo B' }
  ];
  
  materias = [
    { id: 1, nombre: 'Matemáticas' },
    { id: 2, nombre: 'Ciencias' }
  ];
  
  registros = [
    { 
      id: 1, 
      matricula: '2023001', 
      nombre: 'Juan Pérez', 
      grupo: 'Grupo A', 
      grupoId: 1,
      materia: 'Matemáticas', 
      materiaId: 1,
      fecha: new Date(2023, 5, 15),
      asistencia: 'presente'
    },
    { 
      id: 2, 
      matricula: '2023002', 
      nombre: 'María García', 
      grupo: 'Grupo A', 
      grupoId: 1,
      materia: 'Ciencias', 
      materiaId: 2,
      fecha: new Date(2023, 5, 16),
      asistencia: 'ausente'
    }
  ];
  
  selectedGroup: any = null;
  selectedMateria: any = null;
  searchQuery: string = '';
  registrosFiltrados: any[] = [];

  ngOnInit(): void {
    this.registrosFiltrados = [...this.registros];
  }

  filtrarRegistros(): void {
    this.registrosFiltrados = this.registros.filter(reg => {
      const matchesSearch = !this.searchQuery || 
        reg.nombre.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        reg.matricula.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesGroup = !this.selectedGroup || reg.grupoId == this.selectedGroup;
      const matchesMateria = !this.selectedMateria || reg.materiaId == this.selectedMateria;
      
      return matchesSearch && matchesGroup && matchesMateria;
    });
  }
  
  editarAsistencia(registro: any): void {
    registro.asistencia = registro.asistencia === 'presente' ? 'ausente' : 'presente';
    // Aquí normalmente harías una llamada API para guardar el cambio
  }
}