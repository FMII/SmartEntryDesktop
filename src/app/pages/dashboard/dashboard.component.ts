import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  @ViewChild('attendanceChart', { static: true }) chartRef!: ElementRef;
  
  // Datos de ejemplo
  registros = [
    { id: 1, nombre: 'Juan Pérez', fecha: new Date('2023-05-01'), asistencia: 'presente' },
    { id: 2, nombre: 'María García', fecha: new Date('2023-05-01'), asistencia: 'ausente' },
    { id: 3, nombre: 'Carlos López', fecha: new Date('2023-05-02'), asistencia: 'presente' },
    { id: 4, nombre: 'Ana Martínez', fecha: new Date('2023-05-02'), asistencia: 'ausente' },
    { id: 5, nombre: 'Pedro Sánchez', fecha: new Date('2023-05-03'), asistencia: 'presente' }
  ];

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.renderChart();
  }

  private renderChart(): void {
    const ctx = this.chartRef.nativeElement.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D'],
        datasets: [{
          label: 'Número de ausencias',
          data: [12, 19, 8, 15],
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