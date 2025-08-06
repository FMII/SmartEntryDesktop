import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TeachersScheduleService } from '../../services/teachers-schedule.service';
import { AuthService } from '../../services/auth.service';
import { Subject, takeUntil, finalize } from 'rxjs';

@Component({
  selector: 'app-teachers-schedule',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './teachers-schedule.component.html',
  styleUrls: ['./teachers-schedule.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeachersScheduleComponent implements OnInit, OnDestroy {
  selectedGroup: string = '';
  selectedSubject: string = '';
  grupos: any[] = [];
  materias: any[] = [];
  horarios: any[] = [];
  horariosFiltrados: any[] = [];
  currentUser: any = null; // Usuario actual autenticado
  
  // Estados
  loading = false;
  error: string | null = null;
  autoRefreshEnabled = false;
  autoRefreshInterval: any;
  
  private destroy$ = new Subject<void>();

  constructor(
    private scheduleService: TeachersScheduleService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    console.log('TeachersScheduleComponent constructor ejecutado');
  }

  ngOnInit(): void {
    console.log('TeachersScheduleComponent ngOnInit iniciado');
    
    // Verificar autenticación
    const currentUser = this.authService.getCurrentUser();
    this.currentUser = currentUser;
    console.log('Usuario actual en horario:', currentUser);
    
    if (!currentUser) {
      console.log('No hay usuario autenticado en horario');
      this.error = 'No hay usuario autenticado. Por favor inicia sesión.';
      return;
    }
    
    console.log('Usuario autenticado, cargando datos iniciales...');
    this.cargarDatosIniciales();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
  }

  cargarDatosIniciales(): void {
    console.log('Iniciando cargarDatosIniciales en horarios...');
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    // Obtener profesor autenticado
    const currentTeacher = this.authService.getCurrentUser();
    console.log('🔍 Horario - Profesor actual:', currentTeacher);
    
    if (!currentTeacher?.id) {
      console.log('No hay profesor autenticado en horario');
      this.error = 'No hay profesor autenticado';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    // Cargar horarios formateados del profesor
    this.scheduleService.getFormattedSchedules(currentTeacher.id).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (schedules) => {
        console.log('Horarios formateados obtenidos:', schedules);
        
        this.horarios = schedules;
        this.horariosFiltrados = schedules;
        
        // Extraer grupos únicos para el filtro
        const gruposUnicos = new Map();
        schedules.forEach(schedule => {
          if (schedule.group_id && schedule.grupo) {
            gruposUnicos.set(schedule.group_id, {
              id: schedule.group_id,
              name: schedule.grupo
            });
          }
        });
        this.grupos = Array.from(gruposUnicos.values());
        
        // Extraer materias únicas para el filtro
        const materiasUnicas = new Map();
        schedules.forEach(schedule => {
          if (schedule.subject_id && schedule.materia) {
            materiasUnicas.set(schedule.subject_id, {
              id: schedule.subject_id,
              name: schedule.materia
            });
          }
        });
        this.materias = Array.from(materiasUnicas.values());
        
        console.log('Grupos disponibles:', this.grupos);
        console.log('Materias disponibles:', this.materias);
        
        this.error = null;
      },
      error: (error) => {
        console.error('❌ Error al cargar horarios:', error);
        this.error = error.message || 'Error al cargar los horarios';
        this.horarios = [];
        this.horariosFiltrados = [];
        this.grupos = [];
        this.materias = [];
      }
    });
  }

  onGroupChange(): void {
    this.selectedSubject = ''; // Limpiar materia al cambiar grupo
    this.filtrarHorarios();
    this.cdr.markForCheck();
  }

  onSubjectChange(): void {
    this.filtrarHorarios();
    this.cdr.markForCheck();
  }

  private filtrarHorarios(): void {
    let horariosFiltrados = [...this.horarios];

    // Filtrar por grupo si está seleccionado
    if (this.selectedGroup) {
      horariosFiltrados = horariosFiltrados.filter(horario => 
        horario.group_id == this.selectedGroup
      );
    }

    // Filtrar por materia si está seleccionada
    if (this.selectedSubject) {
      horariosFiltrados = horariosFiltrados.filter(horario => 
        horario.subject_id == this.selectedSubject
      );
    }

    this.horariosFiltrados = horariosFiltrados;
    console.log('Horarios filtrados:', this.horariosFiltrados);
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      this.setupAutoRefresh();
    } else {
      this.clearAutoRefresh();
    }
    this.cdr.markForCheck();
  }

  recargarDatos(): void {
    console.log('===== RECARGAR DATOS COMPLETOS DESDE API =====');
    console.log('Recargando TODA la vista desde la API...');
    
    // Limpiar TODOS los datos actuales
    this.selectedGroup = '';
    this.selectedSubject = '';
    this.grupos = [];
    this.materias = [];
    this.horarios = [];
    this.horariosFiltrados = [];
    this.error = null;
    this.loading = false;
    
    console.log('Estado después de limpiar:', {
      selectedGroup: this.selectedGroup,
      selectedSubject: this.selectedSubject,
      grupos: this.grupos.length,
      materias: this.materias.length,
      horarios: this.horarios.length
    });
    
    // Limpiar cache del servicio
    this.scheduleService.clearAllCache();
    
    // Recargar TODOS los datos desde cero
    this.cargarDatosIniciales();
    
    console.log('===== RECARGA COMPLETA FINALIZADA =====');
  }

  private setupAutoRefresh(): void {
    this.clearAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      this.cargarDatosIniciales();
    }, 30000); // 30 segundos
  }

  private clearAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }
}
