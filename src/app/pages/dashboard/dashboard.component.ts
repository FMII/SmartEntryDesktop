import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('attendanceChart', { static: false }) chartRef!: ElementRef;

  grupos: any[] = [];
  grupoSeleccionado: number | null = null;
  registros: any[] = [];
  ausenciasPorGrupo: { grupo: string, total: number, estudiante?: string }[] = [];
  fechaInicio: string = '';
  fechaFin: string = '';
  chart: Chart | null = null;
  currentUser: any = null;

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService
  ) {
    console.log('DashboardComponent constructor ejecutado');
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    console.log('DashboardComponent ngOnInit iniciado');
    
    // Obtener información del usuario actual
    this.currentUser = this.authService.getCurrentUser();
    
    // Inicializar fechas por defecto (último mes)
    const now = new Date();
    this.fechaFin = now.toISOString().slice(0, 10);
    this.fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    
    console.log('Fechas inicializadas:', { fechaInicio: this.fechaInicio, fechaFin: this.fechaFin });
    
    // Cargar datos inmediatamente
    this.cargarDatos();
  }

  cargarDatos(): void {
    console.log('Cargando datos para gráfica...');
    
    // Validar que tenemos fechas
    if (!this.fechaInicio || !this.fechaFin) {
      console.log('No hay fechas definidas');
      this.ausenciasPorGrupo = [
        { grupo: 'Sin fechas', total: 0, estudiante: 'Seleccione fechas' }
      ];
      setTimeout(() => this.renderChart(), 100);
      return;
    }
    
    // Mostrar información sobre el filtrado
    if (this.fechaInicio === this.fechaFin) {
      console.log('Filtrando por el mismo día:', this.fechaInicio);
    } else {
      console.log('Filtrando por rango de fechas:', {
        desde: this.fechaInicio,
        hasta: this.fechaFin
      });
    }
    
    console.log('Cargando datos de gráfica para rango:', { 
      fechaInicio: this.fechaInicio, 
      fechaFin: this.fechaFin 
    });
    
    // Cargar datos de top ausencias con el rango de fechas
    this.dashboardService.getTopAbsencesByGroup(this.fechaInicio, this.fechaFin).subscribe({
      next: (data) => {
        console.log('Datos de top ausencias recibidos:', data);
        
        if (data && Array.isArray(data) && data.length > 0) {
          // Mapear datos para la gráfica
          this.ausenciasPorGrupo = data.map((g: any) => ({
            grupo: g.group_name || 'Grupo sin nombre',
            total: g.top_student ? g.top_student.absences : 0,
            estudiante: g.top_student ? g.top_student.name : 'Sin datos'
          }));
          
          console.log(`Se encontraron ${this.ausenciasPorGrupo.length} grupos con datos`);
        } else {
          console.log('No hay datos en la respuesta de la API');
          this.ausenciasPorGrupo = [
            { grupo: 'Sin datos', total: 0, estudiante: 'No hay datos para este período' }
          ];
        }
        
        console.log('Datos procesados para gráfica:', this.ausenciasPorGrupo);
        setTimeout(() => this.renderChart(), 100);
      },
      error: (error) => {
        console.error('Error al cargar top ausencias:', error);
        console.error('Detalles del error:', error.message, error.status);
        
        // En caso de error, mostrar mensaje de error
        this.ausenciasPorGrupo = [
          { grupo: 'Error en API', total: 0, estudiante: 'Error al cargar datos' }
        ];
        
        setTimeout(() => this.renderChart(), 100);
      }
    });
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

  renderChart(): void {
    if (!this.chartRef) {
      console.log('No hay referencia al canvas');
      return;
    }
    
    const ctx = this.chartRef.nativeElement.getContext('2d');
    
    // Destruir gráfica anterior
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    
    console.log('Datos para gráfica:', this.ausenciasPorGrupo);
    
    // Usar datos de ejemplo si no hay datos reales
    let labels = ['Grupo A', 'Grupo B', 'Grupo C'];
    let data = [5, 3, 8];
    let students = ['Juan Pérez', 'María García', 'Carlos López'];
    
    if (this.ausenciasPorGrupo && this.ausenciasPorGrupo.length > 0) {
      labels = this.ausenciasPorGrupo.map(item => item.grupo);
      data = this.ausenciasPorGrupo.map(item => item.total);
      students = this.ausenciasPorGrupo.map(item => item.estudiante || 'Sin datos');
    }
    
    console.log('Renderizando con labels:', labels);
    console.log('Renderizando con data:', data);
    console.log('Renderizando con students:', students);
    
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Faltas',
          data: data,
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 205, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 205, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              title: function(context: any) {
                return 'Grupo: ' + context[0].label;
              },
              label: function(context: any) {
                const index = context.dataIndex;
                return students[index] + ': ' + context.parsed.y + ' faltas';
              }
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Número de faltas'
            },
            ticks: {
              stepSize: 1
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
    
    console.log('Gráfica creada exitosamente');
  }

  onFechaChange(): void {
    console.log('Fechas seleccionadas:', {
      inicio: this.fechaInicio,
      fin: this.fechaFin
    });
    
    if (this.fechaInicio && this.fechaFin) {
      // Validar que la fecha de inicio no sea mayor que la de fin
      if (this.fechaInicio > this.fechaFin) {
        console.warn('La fecha de inicio no puede ser mayor que la fecha de fin');
        // Intercambiar las fechas automáticamente
        const temp = this.fechaInicio;
        this.fechaInicio = this.fechaFin;
        this.fechaFin = temp;
        console.log('Fechas intercambiadas automáticamente:', {
          inicio: this.fechaInicio,
          fin: this.fechaFin
        });
      }
      
      // Si las fechas son iguales, mostrar mensaje informativo
      if (this.fechaInicio === this.fechaFin) {
        console.log('Filtrando por el mismo día:', this.fechaInicio);
      }
      
      this.cargarDatos();
    }
  }

  ngOnDestroy(): void {
    // Destruir gráfica al destruir el componente
    if (this.chart) {
      console.log('Destruyendo gráfica en ngOnDestroy');
      this.chart.destroy();
      this.chart = null;
    }
  }
}