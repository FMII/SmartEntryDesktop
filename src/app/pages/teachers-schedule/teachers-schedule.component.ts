import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TeachersScheduleService } from '../../services/teachers-schedule.service';
import { AuthService } from '../../services/auth.service';
import { Subject, forkJoin, takeUntil, debounceTime, distinctUntilChanged, finalize } from 'rxjs';

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
  selectedDocente: string = '';
  grupos: any[] = [];
  docentes: any[] = [];
  horarios: any[] = [];
  horariosFiltrados: any[] = [];
  materias: any[] = [];
  schedules: any[] = [];
  
  // Estados
  loading = false;
  error: string | null = null;
  autoRefreshEnabled = false;
  autoRefreshInterval: any;
  
  // Cache local
  private cache = new Map<string, any>();
  private destroy$ = new Subject<void>();

  constructor(
    private scheduleService: TeachersScheduleService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    console.log('🏗️ TeachersScheduleComponent constructor ejecutado');
  }

  ngOnInit(): void {
    console.log('🚀 TeachersScheduleComponent ngOnInit iniciado');
    console.log('📍 URL actual:', window.location.href);
    
    // Verificar autenticación
    const currentUser = this.authService.getCurrentUser();
    console.log('👤 Usuario actual en horario:', currentUser);
    console.log('🔑 localStorage userId:', localStorage.getItem('userId'));
    console.log('📧 localStorage email:', localStorage.getItem('email'));
    console.log('🎫 localStorage token:', localStorage.getItem('token'));
    
    if (!currentUser) {
      console.log('⚠️ No hay usuario autenticado en horario. Por favor:');
      console.log('1. Ve a la página de login');
      console.log('2. Haz login nuevamente');
      console.log('3. Completa el 2FA si es necesario');
      this.error = 'No hay usuario autenticado. Por favor inicia sesión.';
      return;
    }
    
    console.log('✅ Usuario autenticado, cargando datos iniciales...');
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
    console.log('📊 Iniciando cargarDatosIniciales en horarios...');
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    // Obtener profesor autenticado
    const currentTeacher = this.authService.getCurrentUser();
    console.log('🔍 Horario - Profesor actual:', currentTeacher);
    
    if (!currentTeacher?.id) {
      console.log('❌ No hay profesor autenticado en horario');
      this.error = 'No hay profesor autenticado';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    // Cargar asignaciones del profesor y otros datos
    forkJoin({
      assignments: this.scheduleService.getTeacherAssignments(currentTeacher.id),
      docentes: this.scheduleService.getTeachers(),
      materias: this.scheduleService.getSubjects()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        // Validar que assignments sea un array
        if (!data.assignments || !Array.isArray(data.assignments)) {
          console.log('⚠️ Assignments no es un array válido en horario:', data.assignments);
          this.grupos = [];
        } else {
          // Procesar asignaciones para obtener grupos únicos del profesor
          const teacherGroups = new Map();
          
          data.assignments.forEach((assignment: any) => {
            const groupId = assignment.group_id || assignment.groups?.id;
            const groupName = assignment.groups?.name || assignment.group_name;
            
            console.log('📦 Procesando asignación en horario:', assignment);
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
        }
        
        this.docentes = data.docentes || [];
        this.materias = data.materias || [];
        
        console.log('✅ Grupos del profesor en horario:', this.grupos);
        
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar los datos iniciales';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  cargarHorariosCompletos(): void {
    this.loading = true;
    this.error = '';

    this.scheduleService.getCompleteSchedule(Number(this.selectedDocente))
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response && response.schedules) {
            this.horarios = response.schedules || [];
            this.grupos = response.groups || [];
            this.materias = response.subjects || [];
          } else {
            this.horarios = [];
            this.grupos = [];
            this.materias = [];
          }
          this.filtrarHorarios();
        },
        error: (error) => {
          console.error('Error al cargar horarios completos:', error);
          this.error = error.message || 'Error al cargar los horarios';
          this.horarios = [];
          this.grupos = [];
          this.materias = [];
        }
      });
  }

  filtrarHorarios(): void {
    let filtrados = [...this.horarios];
    
    if (this.selectedGroup) {
      filtrados = filtrados.filter(h => h.group_id == this.selectedGroup);
    }

    // Enriquecer con nombres de grupo y materia
    this.horariosFiltrados = filtrados.map(h => ({
      ...h,
      grupo: this.getNombreGrupo(h.group_id),
      materia: this.getNombreMateria(h.subject_id),
      dia: this.formatearDia(h.day || h.dia),
      inicio: this.formatearHora(h.start_time || h.inicio),
      fin: this.formatearHora(h.end_time || h.fin)
    }));
  }

  onDocenteChange(): void {
    this.cargarHorariosCompletos();
  }

  onGroupChange(): void {
    this.filtrarHorarios();
    this.cdr.markForCheck();
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
    console.log('Recargando datos en horario...', {
      selectedDocente: this.selectedDocente,
      selectedGroup: this.selectedGroup,
      currentUser: this.authService.getCurrentUser()
    });
    
    this.scheduleService.clearAllCache();
    this.cargarDatosIniciales();
    if (this.selectedDocente) {
      this.cargarHorariosCompletos();
    }
  }

  private setupAutoRefresh(): void {
    this.clearAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      if (this.selectedDocente) {
        this.cargarHorariosCompletos();
      }
    }, 30000); // 30 segundos
  }

  private clearAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  // Métodos de utilidad
  getNombreGrupo(groupId: any): string {
    const grupo = this.grupos.find(g => g.id == groupId);
    return grupo ? (grupo.nombre || grupo.name || `Grupo ${groupId}`) : `Grupo ${groupId}`;
  }

  getNombreMateria(subjectId: any): string {
    const materia = this.materias.find(m => m.id == subjectId);
    return materia ? (materia.nombre || materia.name || `Materia ${subjectId}`) : `Materia ${subjectId}`;
  }

  formatearDia(dia: string): string {
    if (!dia) return 'N/A';
    
    const dias: { [key: string]: string } = {
      'monday': 'Lunes',
      'tuesday': 'Martes', 
      'wednesday': 'Miércoles',
      'thursday': 'Jueves',
      'friday': 'Viernes',
      'saturday': 'Sábado',
      'sunday': 'Domingo',
      'lunes': 'Lunes',
      'martes': 'Martes',
      'miércoles': 'Miércoles',
      'jueves': 'Jueves',
      'viernes': 'Viernes',
      'sábado': 'Sábado',
      'domingo': 'Domingo'
    };
    
    return dias[dia.toLowerCase()] || dia;
  }

  formatearHora(hora: string): string {
    if (!hora) return 'N/A';
    
    // Si ya está en formato HH:MM, devolverlo tal como está
    if (hora.match(/^\d{2}:\d{2}$/)) {
      return hora;
    }
    
    // Si está en formato HH:MM:SS, extraer solo HH:MM
    if (hora.match(/^\d{2}:\d{2}:\d{2}$/)) {
      return hora.substring(0, 5);
    }
    
    // Si es un timestamp o formato diferente, intentar parsearlo
    try {
      const date = new Date(hora);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      }
    } catch (e) {
      // Si falla el parsing, devolver el valor original
    }
    
    return hora;
  }

  limpiarFiltros(): void {
    this.selectedGroup = '';
    this.selectedDocente = '';
    this.horarios = [];
    this.horariosFiltrados = [];
    this.error = null;
    this.cdr.markForCheck();
  }

  limpiarCache(): void {
    this.scheduleService.clearAllCache();
    console.log('Cache limpiado');
  }
}