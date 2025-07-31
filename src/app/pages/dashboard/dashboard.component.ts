import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  @ViewChild('attendanceChart', { static: false }) chartRef!: ElementRef;

  grupos: any[] = [];
  grupoSeleccionado: number | null = null;
  registros: any[] = [];
  ausenciasPorGrupo: { grupo: string, total: number }[] = [];
  fechaFiltro: string = '';
  chart: Chart | null = null;
  vista: 'grafica' | 'tabla' = 'grafica';

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService
  ) {
    console.log('🏗️ DashboardComponent constructor ejecutado');
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    console.log('🚀 DashboardComponent ngOnInit iniciado');
    // Cargar solo los grupos del profesor autenticado
    const currentTeacher = this.authService.getCurrentUser();
    console.log('🔍 Dashboard - Profesor actual:', currentTeacher);
    
    if (!currentTeacher?.id) {
      console.log('❌ No hay profesor autenticado en dashboard');
      return;
    }
    
    // Cargar asignaciones del profesor
    this.dashboardService.getTeacherAssignments(currentTeacher.id).subscribe({
      next: (assignments: any) => {
        console.log('✅ Asignaciones del profesor en dashboard:', assignments);
        
        // Validar que assignments sea un array
        if (!assignments || !Array.isArray(assignments)) {
          console.log('⚠️ Assignments no es un array válido:', assignments);
          this.grupos = [];
          this.cargarDatos(); // Para la gráfica
          return;
        }
        
        // Procesar asignaciones para obtener grupos únicos del profesor
        const teacherGroups = new Map();
        
        assignments.forEach((assignment: any) => {
          const groupId = assignment.group_id || assignment.groups?.id;
          const groupName = assignment.groups?.name || assignment.group_name;
          
          console.log('📦 Procesando asignación:', assignment);
          console.log('🆔 Group ID:', groupId);
          console.log('📝 Group Name:', groupName);
          
          if (groupId && groupName) {
            if (!teacherGroups.has(groupId)) {
              teacherGroups.set(groupId, {
                id: groupId,
                name: groupName
              });
            }
          }
        });
        
        // Asignar solo los grupos del profesor
        this.grupos = Array.from(teacherGroups.values());
        console.log('✅ Grupos del profesor en dashboard:', this.grupos);
        
        if (this.grupos.length > 0) {
          this.grupoSeleccionado = this.grupos[0].id;
          this.cargarTabla();
        }
        
        this.cargarDatos(); // Para la gráfica
      },
      error: (error: any) => {
        console.error('❌ Error al cargar asignaciones del profesor en dashboard:', error);
        this.grupos = [];
        this.cargarDatos(); // Para la gráfica
      }
    });
  }

  cargarTabla(fecha?: string): void {
    console.log('📊 cargarTabla ejecutado con fecha:', fecha);
    if (!this.grupoSeleccionado) {
      console.log('❌ No hay grupo seleccionado');
      return;
    }
    
    console.log('📊 Cargando tabla para grupo:', this.grupoSeleccionado);
    console.log('📅 Fecha seleccionada:', fecha);
    
    // Si hay una fecha específica seleccionada, usar solo esa fecha
    let startDate: string, endDate: string;
    if (fecha && fecha.trim() !== '') {
      // Usar solo la fecha seleccionada
      startDate = fecha;
      endDate = fecha;
      console.log('🎯 Filtrando por fecha específica:', fecha);
    } else {
      // Por defecto, usar el mes actual
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      console.log('📅 Usando rango del mes actual:', { startDate, endDate });
    }
    
    console.log('📅 Rango de fechas final:', { startDate, endDate });
    
    // Cargar todos los alumnos del grupo y sus registros de asistencia
    forkJoin({
      students: this.dashboardService.getStudentsByGroup(this.grupoSeleccionado),
      attendance: this.dashboardService.getAttendanceByGroup(this.grupoSeleccionado, startDate, endDate)
    }).subscribe({
      next: (data) => {
        console.log('✅ Alumnos del grupo:', data.students);
        console.log('✅ Registros de asistencia:', data.attendance);
        console.log('📊 Total de registros de asistencia:', data.attendance.length);
        
        // Mostrar fechas únicas en los registros
        const uniqueDates = [...new Set(data.attendance.map((record: any) => {
          const date = new Date(record.date || record.fecha);
          return date.toISOString().slice(0, 10);
        }))];
        console.log('📅 Fechas únicas en registros:', uniqueDates);
        
        // Mostrar las fechas originales que llegan del backend
        console.log('🔍 Fechas originales del backend:');
        data.attendance.forEach((record: any, index: number) => {
          console.log(`  Registro ${index}: ${record.date || record.fecha}`);
        });
        
        const grupo = this.grupos.find(g => g.id === this.grupoSeleccionado);
        
        // Crear un mapa de registros de asistencia por estudiante
        const attendanceMap = new Map();
        data.attendance.forEach((record: any) => {
          const studentId = record.user_id || record.student_id;
          if (!attendanceMap.has(studentId)) {
            attendanceMap.set(studentId, []);
          }
          attendanceMap.get(studentId).push(record);
        });
        
        // Si estamos filtrando por fecha específica, solo mostrar alumnos con registros ese día
        if (fecha && fecha.trim() !== '') {
          console.log('🎯 Filtrando solo alumnos con registros en fecha específica:', fecha);
          this.registros = data.students
            .map((student: any) => {
              const studentAttendance = attendanceMap.get(student.id) || [];
              
              // Filtrar registros que coincidan con la fecha seleccionada
              const recordsForDate = studentAttendance.filter((record: any) => {
                // Extraer solo la parte YYYY-MM-DD de la fecha del registro, sin conversión de zona horaria
                const recordDateStr = (record.date || record.fecha).split('T')[0];
                const selectedDateStr = fecha;
                
                console.log(`📅 Comparando: ${recordDateStr} vs ${selectedDateStr} para estudiante ${student.id}`);
                return recordDateStr === selectedDateStr;
              });
              
              // Solo incluir si tiene registros de asistencia para esa fecha específica
              if (recordsForDate.length > 0) {
                const recordForDate = recordsForDate[0]; // Tomar el primer registro de esa fecha
                console.log(`✅ Encontrado registro para fecha ${fecha} del estudiante ${student.id}:`, recordForDate);
                return {
                  ...recordForDate,
                  id: student.id,
                  first_name: student.first_name,
                  last_name: student.last_name,
                  grupo: grupo ? grupo.name : '',
                  user: student
                };
              }
              console.log(`❌ No se encontraron registros para fecha ${fecha} del estudiante ${student.id}`);
              return null; // No incluir alumnos sin registros para esa fecha
            })
            .filter(record => record !== null); // Filtrar registros nulos
        } else {
          // Mostrar todos los alumnos del grupo (comportamiento original)
          console.log('📋 Mostrando todos los alumnos del grupo');
          this.registros = data.students.map((student: any) => {
            const studentAttendance = attendanceMap.get(student.id) || [];
            
            // Si no hay registros de asistencia, crear uno por defecto
            if (studentAttendance.length === 0) {
              return {
                id: student.id,
                first_name: student.first_name,
                last_name: student.last_name,
                date: startDate,
                status: 'present',
                grupo: grupo ? grupo.name : '',
                user: student
              };
            }
            
            // Usar el primer registro de asistencia
            const firstRecord = studentAttendance[0];
            return {
              ...firstRecord,
              id: student.id,
              first_name: student.first_name,
              last_name: student.last_name,
              grupo: grupo ? grupo.name : '',
              user: student
            };
          });
        }
        
        console.log('✅ Registros procesados:', this.registros);
      },
      error: (error) => {
        console.error('❌ Error al cargar tabla:', error);
        this.registros = [];
      }
    });
  }

  cargarDatos(): void {
    // Obtener profesor autenticado
    const currentTeacher = this.authService.getCurrentUser();
    console.log('🔍 Dashboard - Profesor actual para gráfica:', currentTeacher);
    
    if (!currentTeacher?.id) {
      console.log('❌ No hay profesor autenticado para gráfica');
      return;
    }
    
    // Por defecto, usar el mes actual
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    
    // Cargar solo datos de los grupos del profesor
    this.dashboardService.getTeacherAssignments(currentTeacher.id).subscribe({
      next: (assignments) => {
        console.log('✅ Asignaciones del profesor para gráfica:', assignments);
        
        // Procesar asignaciones para obtener grupos únicos del profesor
        const teacherGroups = new Map();
        
        assignments.forEach((assignment: any) => {
          const groupId = assignment.group_id || assignment.groups?.id;
          const groupName = assignment.groups?.name || assignment.group_name;
          
          if (groupId && groupName) {
            if (!teacherGroups.has(groupId)) {
              teacherGroups.set(groupId, {
                id: groupId,
                name: groupName
              });
            }
          }
        });
        
        // Solo cargar datos de los grupos del profesor
        const teacherGroupIds = Array.from(teacherGroups.keys());
        console.log('📊 Grupos del profesor para gráfica:', teacherGroupIds);
        
        if (teacherGroupIds.length > 0) {
          // Cargar datos solo para los grupos del profesor
          this.dashboardService.getTopAbsencesByGroup(startDate, endDate).subscribe(data => {
            // Filtrar solo los grupos del profesor
            const filteredData = data.filter((g: any) => 
              teacherGroupIds.includes(g.group_id)
            );
            
            this.ausenciasPorGrupo = filteredData.map((g: any) => ({
              grupo: g.group_name,
              total: g.top_student ? g.top_student.absences : 0
            }));
            
            console.log('✅ Datos filtrados para gráfica:', this.ausenciasPorGrupo);
            this.renderChart();
          });
        } else {
          console.log('⚠️ No hay grupos asignados al profesor para gráfica');
          this.ausenciasPorGrupo = [];
          this.renderChart();
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar asignaciones para gráfica:', error);
        this.ausenciasPorGrupo = [];
        this.renderChart();
      }
    });
  }

  actualizarAusenciasPorGrupo(): void {
    // Filtrar por fecha si hay filtro
    let registrosFiltrados = this.registros;
    if (this.fechaFiltro) {
      registrosFiltrados = registrosFiltrados.filter(r => {
        const fecha = new Date(r.date || r.fecha);
        return fecha.toISOString().slice(0, 10) === this.fechaFiltro;
      });
    }
    // Agrupar ausencias por grupo
    const groupMap: { [grupo: string]: number } = {};
    registrosFiltrados.forEach(r => {
      if ((r.status || r.estado)?.toLowerCase() === 'absent' || (r.status || r.estado)?.toLowerCase() === 'ausente') {
        const grupo = r.grupo || 'Sin grupo';
        groupMap[grupo] = (groupMap[grupo] || 0) + 1;
      }
    });
    this.ausenciasPorGrupo = Object.entries(groupMap).map(([grupo, total]) => ({ grupo, total }));
  }

  actualizarAsistencia(registro: any, nuevoStatus: string) {
    const valorAnterior = registro.status;
    registro.status = nuevoStatus;
    this.dashboardService.updateAttendanceStatus(registro.id, { status: nuevoStatus }).subscribe({
      next: () => {},
      error: () => {
        registro.status = valorAnterior; // Revertir si falla
        alert('No se pudo actualizar la asistencia.');
      }
    });
  }

  onGrupoChange(event: any): void {
    this.grupoSeleccionado = +event.target.value;
    this.cargarTabla(this.fechaFiltro);
  }

  onFechaFiltroChange(event: any): void {
    console.log('🎯 onFechaFiltroChange ejecutado');
    this.fechaFiltro = event.target.value;
    console.log('📅 Fecha seleccionada en filtro:', this.fechaFiltro);
    
    if (this.fechaFiltro && this.fechaFiltro.trim() !== '') {
      console.log('🎯 Filtrando por fecha específica:', this.fechaFiltro);
    } else {
      console.log('📋 Mostrando todos los registros del mes');
    }
    
    this.cargarDatos(); // Actualiza gráfica
    this.cargarTabla(this.fechaFiltro); // Actualiza tabla
  }

  renderChart(): void {
    if (!this.chartRef) return;
    const ctx = this.chartRef.nativeElement.getContext('2d');
    if (this.chart) {
      this.chart.destroy();
    }
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.ausenciasPorGrupo.map(a => a.grupo),
        datasets: [{
          label: 'Número de ausencias',
          data: this.ausenciasPorGrupo.map(a => a.total),
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'x', // Regresa a barras verticales
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Número de ausencias'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Grupos'
            }
          }
        }
      }
    });
  }

  setVista(v: 'grafica' | 'tabla') {
    this.vista = v;
    if (v === 'grafica') {
      setTimeout(() => this.renderChart(), 0);
    }
  }

  recargarDatos(): void {
    console.log('🔄 Recargando datos del dashboard...');
    
    // Limpiar datos actuales
    this.registros = [];
    this.ausenciasPorGrupo = [];
    
    // Recargar datos
    this.cargarDatos(); // Recargar gráfica
    this.cargarTabla(this.fechaFiltro); // Recargar tabla
    
    console.log('✅ Datos recargados desde la API');
  }
}