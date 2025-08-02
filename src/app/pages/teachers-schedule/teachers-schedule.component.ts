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
  selectedSubject: string = '';
  grupos: any[] = [];
  materias: any[] = [];
  horarios: any[] = [];
  horariosFiltrados: any[] = [];
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
    console.log('TeachersScheduleComponent constructor ejecutado');
  }

  ngOnInit(): void {
    console.log('TeachersScheduleComponent ngOnInit iniciado');
    console.log('URL actual:', window.location.href);
    
    // Verificar autenticación
    const currentUser = this.authService.getCurrentUser();
    console.log('Usuario actual en horario:', currentUser);
    console.log('localStorage userId:', localStorage.getItem('userId'));
    console.log('localStorage email:', localStorage.getItem('email'));
    console.log('localStorage token:', localStorage.getItem('token'));
    
    if (!currentUser) {
      console.log('No hay usuario autenticado en horario. Por favor:');
      console.log('1. Ve a la página de login');
      console.log('2. Haz login nuevamente');
      console.log('3. Completa el 2FA si es necesario');
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

    // Cargar asignaciones del profesor y otros datos
    forkJoin({
      assignments: this.scheduleService.getTeacherAssignments(currentTeacher.id),
      materias: this.scheduleService.getSubjects()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        // Validar que assignments sea un array
        if (!data.assignments || !Array.isArray(data.assignments)) {
          console.log('Assignments no es un array válido en horario:', data.assignments);
          this.grupos = [];
        } else {
          // Procesar asignaciones para obtener grupos únicos del profesor
          const teacherGroups = new Map();
          
          data.assignments.forEach((assignment: any) => {
            const groupId = assignment.group_id || assignment.groups?.id;
            const groupName = assignment.groups?.name || assignment.group_name;
            
            console.log('📦 Procesando asignación en horario:', assignment);
            console.log('🆔 Group ID:', groupId);
            console.log('Group Name:', groupName);
            
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
      
      // Obtener todas las materias disponibles
      let allMaterias: any[] = [];
      if (data.materias && Array.isArray(data.materias)) {
        allMaterias = data.materias;
      } else if (data.materias && typeof data.materias === 'object' && 'data' in data.materias && Array.isArray((data.materias as any).data)) {
        allMaterias = (data.materias as any).data;
      }

      // Filtrar materias basándose en las asignaciones del profesor
      const teacherSubjects = new Map();
      if (data.assignments && Array.isArray(data.assignments)) {
        data.assignments.forEach((assignment: any) => {
          const subjectId = assignment.subject_id || assignment.subjects?.id;
          const subjectName = assignment.subjects?.name || assignment.subject_name;
          
                      console.log('Procesando materia del profesor:', { subjectId, subjectName });
          
          if (subjectId && subjectName) {
            if (!teacherSubjects.has(subjectId)) {
              teacherSubjects.set(subjectId, {
                id: subjectId,
                name: subjectName
              });
            }
          }
        });
      }
      
      // Asignar solo las materias del profesor
      this.materias = Array.from(teacherSubjects.values());
        
        console.log('Grupos del profesor en horario:', this.grupos);
        console.log('Materias disponibles:', this.materias);
        console.log('🔍 Tipo de grupos:', typeof this.grupos, Array.isArray(this.grupos));
        console.log('🔍 Tipo de materias:', typeof this.materias, Array.isArray(this.materias));
        
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
    console.log('Cargando horarios completos...');
    this.loading = true;
    this.error = '';

    const currentTeacher = this.authService.getCurrentUser();
    if (!currentTeacher?.id) {
      console.error('No hay profesor autenticado');
      this.loading = false;
      return;
    }

    this.scheduleService.getCompleteScheduleData(currentTeacher.id, Number(this.selectedGroup), Number(this.selectedSubject))
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response && response.schedules) {
            this.horarios = response.schedules || [];
            // No sobrescribir grupos y materias aquí, mantener los originales
            // this.grupos = response.groups || [];
            // this.materias = response.subjects || [];
          } else {
            this.horarios = [];
            // No limpiar grupos y materias aquí
            // this.grupos = [];
            // this.materias = [];
          }
          this.filtrarHorarios();
        },
        error: (error: any) => {
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
      filtrados = filtrados.filter(h => h.group_id == Number(this.selectedGroup));
    }

    if (this.selectedSubject) {
      filtrados = filtrados.filter(h => h.subject_id == Number(this.selectedSubject));
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

  onSubjectChange(): void {
    if (this.selectedSubject) {
      this.cargarHorariosCompletos();
    } else {
      this.filtrarHorarios();
    }
    this.cdr.markForCheck();
  }

  onGroupChange(): void {
    this.selectedSubject = ''; // Limpiar materia al cambiar grupo
    
    // Recargar datos para obtener materias específicas del grupo seleccionado
    if (this.selectedGroup) {
      this.cargarDatosIniciales();
      this.cargarHorariosCompletos();
    } else {
      this.filtrarHorarios();
    }
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
      selectedGroup: this.selectedGroup,
      selectedSubject: this.selectedSubject,
      currentUser: this.authService.getCurrentUser()
    });
    
    this.scheduleService.clearAllCache();
    this.cargarDatosIniciales();
    if (this.selectedGroup || this.selectedSubject) {
      this.cargarHorariosCompletos();
    }
  }

  private setupAutoRefresh(): void {
    this.clearAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      if (this.selectedGroup || this.selectedSubject) {
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
    this.selectedSubject = '';
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