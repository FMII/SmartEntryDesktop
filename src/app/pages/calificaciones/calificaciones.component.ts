// src/app/pages/calificaciones/calificaciones.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from "@angular/router";

@Component({
  selector: 'app-calificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './calificaciones.component.html',
  styleUrls: ['./calificaciones.component.css'],
})
export class CalificacionesComponent implements OnInit {
  alumnos = [/* tu data */];

  ngOnInit(): void {}

  calcularPromedio(alumno: any): number {
    const promedio = (alumno.u1 + alumno.u2 + alumno.u3) / 3;
    return parseFloat(promedio.toFixed(1));
  }

  guardarCalificaciones(alumno: any): void {
    alert(`Guardadas: ${alumno.nombre}`);
  }
}
