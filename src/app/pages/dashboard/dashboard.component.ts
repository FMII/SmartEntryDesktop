import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  @ViewChild('attendanceChart', { static: false }) chartRef!: ElementRef;

  registros: any[] = [];
  grupos: any[] = [];
  ausenciasPorGrupo: { grupo: string, total: number }[] = [];
  fechaFiltro: string = '';
  chart: Chart | null = null;

  constructor(private dashboardService: DashboardService) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.dashboardService.getGroups().subscribe(groups => {
      this.grupos = groups;
      this.dashboardService.getAttendances().subscribe(attendances => {
        // Mapear nombres de grupo si es necesario
        const mapped = this.dashboardService.mapAttendancesWithGroupNames(attendances, groups);
        this.registros = mapped;
        this.actualizarAusenciasPorGrupo();
        this.renderChart();
      });
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

  onFechaFiltroChange(event: any): void {
    this.fechaFiltro = event.target.value;
    this.actualizarAusenciasPorGrupo();
    this.renderChart();
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
}