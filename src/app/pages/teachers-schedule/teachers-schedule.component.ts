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
  
  // Flag para evitar llamadas múltiples
  private isLoadingData = false;
  
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
    // Evitar llamadas múltiples
    if (this.isLoadingData) {
      console.log('cargarDatosIniciales ya está en ejecución, ignorando llamada...');
      return;
    }
    
    console.log('Iniciando cargarDatosIniciales en horarios...');
    this.isLoadingData = true;
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
        
        console.log('Grupos extraídos:', this.grupos);
        console.log('Estructura de un schedule de ejemplo:', schedules[0]);
        console.log('Grupos disponibles:', this.grupos);
        console.log('Materias disponibles (vacío al inicio):', this.materias);
        
        this.error = null;
      },
      error: (error) => {
        console.error('Error al cargar horarios:', error);
        this.error = error.message || 'Error al cargar los horarios';
        this.horarios = [];
        this.horariosFiltrados = [];
        this.grupos = [];
        this.materias = [];
      },
      complete: () => {
        this.isLoadingData = false;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onGroupChange(): void {
    console.log('Grupo cambiado:', this.selectedGroup);
    console.log('Horarios disponibles:', this.horarios);
    
    // Limpiar materia al cambiar grupo
    this.selectedSubject = '';
    
    // Filtrar las materias solo por el grupo seleccionado
    if (this.selectedGroup) {
      const materiasDelGrupo = new Map();
      
      console.log('Filtrando materias para el grupo:', this.selectedGroup);
      console.log('Tipo de selectedGroup:', typeof this.selectedGroup);
      
      this.horarios.forEach(schedule => {
        console.log('Revisando schedule:', {
          schedule_group_id: schedule.group_id,
          schedule_group_id_type: typeof schedule.group_id,
          schedule_grupo: schedule.grupo,
          schedule_grupo_type: typeof schedule.grupo,
          selectedGroup: this.selectedGroup,
          selectedGroup_type: typeof this.selectedGroup,
          match: schedule.group_id == this.selectedGroup,
          subject_id: schedule.subject_id,
          materia: schedule.materia
        });
        
        // Comparar usando múltiples criterios para manejar diferentes tipos de datos
        const grupoCoincide = schedule.group_id == this.selectedGroup || 
                              schedule.grupo == this.selectedGroup ||
                              schedule.group_id == parseInt(this.selectedGroup) ||
                              schedule.grupo == this.selectedGroup;
        
        if (grupoCoincide && schedule.subject_id && schedule.materia) {
          materiasDelGrupo.set(schedule.subject_id, {
            id: schedule.subject_id,
            name: schedule.materia
          });
          console.log('Materia agregada:', schedule.materia);
        }
      });
      
      this.materias = Array.from(materiasDelGrupo.values());
      console.log(`Materias del grupo ${this.selectedGroup}:`, this.materias);
      console.log('Total de materias encontradas:', this.materias.length);
      console.log('Estado de materias después de asignar:', {
        materias: this.materias,
        materiasLength: this.materias.length,
        materiasType: typeof this.materias,
        isArray: Array.isArray(this.materias)
      });
      
      // Debug adicional
      this.debugMateriasFiltrado();
      
      // Forzar la detección de cambios de Angular
      this.cdr.detectChanges();
      console.log('Change detection forzado después de actualizar materias');
    } else {
      // Si no hay grupo seleccionado, no mostrar materias
      this.materias = [];
      console.log('No hay grupo seleccionado, materias vacías');
    }
    
    this.filtrarHorarios();
    this.cdr.markForCheck();
    console.log('Estado final después de onGroupChange:', {
      selectedGroup: this.selectedGroup,
      materias: this.materias,
      materiasLength: this.materias.length,
      showSubjectDropdown: this.selectedGroup && this.materias.length > 0,
      showNoSubjectsMessage: this.selectedGroup && this.materias.length === 0
    });
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
      console.log('Auto-refresh ejecutándose...');
      
      // NO recargar datos completos si ya hay un grupo seleccionado
      // Solo actualizar los horarios existentes
      if (this.selectedGroup && this.horarios.length > 0) {
        console.log('Auto-refresh: Grupo ya seleccionado, solo actualizando horarios...');
        this.actualizarHorariosSinResetearMaterias();
      } else {
        console.log('Auto-refresh: Sin grupo seleccionado, recargando datos completos...');
        this.cargarDatosIniciales();
      }
    }, 30000); // 30 segundos
  }

  // Método para actualizar horarios sin resetear materias
  private actualizarHorariosSinResetearMaterias(): void {
    console.log('Actualizando horarios sin resetear materias...');
    
    const currentTeacher = this.authService.getCurrentUser();
    if (!currentTeacher?.id) {
      console.log('No hay profesor autenticado para actualizar horarios');
      return;
    }

    // Solo actualizar horarios, mantener grupos y materias
    this.scheduleService.getFormattedSchedules(currentTeacher.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (schedules) => {
        console.log('Horarios actualizados:', schedules);
        
        // Actualizar solo los horarios
        this.horarios = schedules;
        
        // Re-aplicar filtros con los datos actualizados
        this.filtrarHorarios();
        
        // NO resetear materias - mantener las del grupo seleccionado
        console.log('Horarios actualizados, materias preservadas:', this.materias);
        
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al actualizar horarios:', error);
        // No mostrar error al usuario para auto-refresh
      }
    });
  }

  private clearAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  // Método de debug para verificar el filtrado
  private debugMateriasFiltrado(): void {
    console.log('=== DEBUG MATERIAS FILTRADO ===');
    console.log('Grupo seleccionado:', this.selectedGroup);
    console.log('Tipo de grupo seleccionado:', typeof this.selectedGroup);
    console.log('Total de horarios:', this.horarios.length);
    
    const horariosDelGrupo = this.horarios.filter(schedule => {
      const match = schedule.group_id == this.selectedGroup || 
                    schedule.grupo == this.selectedGroup ||
                    schedule.group_id == parseInt(this.selectedGroup) ||
                    schedule.grupo == this.selectedGroup;
      return match;
    });
    
    console.log('Horarios del grupo:', horariosDelGrupo);
    console.log('Materias únicas del grupo:', [...new Set(horariosDelGrupo.map(h => h.materia))]);
    console.log('=== FIN DEBUG ===');
  }
}
