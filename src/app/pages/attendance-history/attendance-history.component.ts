import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AttendanceHistoryService } from '../../services/attendance-history.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin, Subscription, timer, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-attendance-history',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './attendance-history.component.html',
  styleUrls: ['./attendance-history.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceHistoryComponent implements OnInit, OnDestroy {
  // Datos
  grupos: any[] = [];
  materias: any[] = [];
  registros: any[] = [];
  registrosFiltrados: any[] = [];
  estadisticas: any = null;

  // Filtros
  selectedGroup: any = null;
  selectedMateria: any = null;
  searchQuery: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';

  // Estados
  loading: boolean = false;
  error: string = '';
  autoRefreshEnabled: boolean = false; // Deshabilitado por defecto para evitar recargas automáticas
  autoRefreshInterval: any;

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 20; // Aumentado para mejor rendimiento
  totalItems: number = 0;

  // Optimización de rendimiento
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private cache = new Map<string, any[]>();

  // Utilidades
  Math = Math;
  console = console;

  constructor(
    private attendanceHistoryService: AttendanceHistoryService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    console.log('🚀 AttendanceHistoryComponent ngOnInit iniciado');
    
    // Verificar autenticación
    const currentUser = this.authService.getCurrentUser();
    console.log('Usuario actual en historial:', currentUser);
    console.log('localStorage userId:', localStorage.getItem('userId'));
    console.log('localStorage email:', localStorage.getItem('email'));
    console.log('localStorage token:', localStorage.getItem('token'));
    
    if (!currentUser) {
      console.log('No hay usuario autenticado en historial. Por favor:');
      console.log('1. Ve a la página de login');
      console.log('2. Haz login nuevamente');
      console.log('3. Completa el 2FA si es necesario');
      this.error = 'No hay usuario autenticado. Por favor inicia sesión.';
      return;
    }
    
    console.log('Usuario autenticado, continuando...');
    
    // TEMPORAL: Limpiar cache para forzar peticiones HTTP
    console.log('Limpiando cache temporalmente para debug...');
    this.cache.clear();
    
    console.log('Configurando search debounce...');
    this.setupSearchDebounce();
    
    console.log('Iniciando carga de datos iniciales...');
    this.cargarDatosIniciales();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
  }

  private setupSearchDebounce(): void {
    console.log('Configurando search debounce...');
    this.searchSubject.pipe(
      debounceTime(300), // Esperar 300ms antes de buscar
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      console.log('Ejecutando búsqueda con debounce...');
      this.filtrarRegistros();
    });
    console.log('Search debounce configurado');
  }

  cargarDatosIniciales(): void {
    console.log('Iniciando cargarDatosIniciales...');
    
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    // Obtener profesor autenticado
    const currentTeacher = this.authService.getCurrentUser();
    console.log('Historial - Profesor actual:', currentTeacher);
    
    if (!currentTeacher?.id) {
      console.log('No hay profesor autenticado en historial');
      this.error = 'No hay profesor autenticado';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    // Cargar grupos y materias asignadas al profesor
    const requests = [
      this.attendanceHistoryService.getGruposAsignados(currentTeacher.id),
      this.attendanceHistoryService.getMateriasAsignadas(currentTeacher.id)
    ];

    console.log('Enviando peticiones HTTP para datos filtrados por profesor...');

    forkJoin(requests)
      .pipe(
        catchError(error => {
          console.error('Error cargando datos iniciales:', error);
          this.error = 'Error al cargar los datos iniciales';
          return [];
        }),
        finalize(() => {
          console.log('Finalizando cargarDatosIniciales');
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(([grupos, materias]) => {
        console.log('Datos filtrados recibidos:', { grupos, materias });
        
        // Asignar grupos del profesor
        this.grupos = Array.isArray(grupos) ? grupos : [];
          
        // Asignar materias del profesor
        this.materias = Array.isArray(materias) ? materias : [];
        
        console.log('Grupos asignados al profesor:', this.grupos);
        console.log('Materias asignadas al profesor:', this.materias);
        
        if (this.grupos.length > 0) {
          this.selectedGroup = this.grupos[0].id;
          console.log('Grupo seleccionado:', this.selectedGroup);
        } else {
          console.log('No hay grupos disponibles para el profesor');
        }
        
        // Siempre cargar historial, con o sin grupo seleccionado
        console.log('Cargando historial de asistencia...');
        this.cargarHistorialAsistencia();
        
        this.cdr.markForCheck();
      });
  }

  cargarHistorialAsistencia(): void {
    console.log('Iniciando cargarHistorialAsistencia...', { selectedGroup: this.selectedGroup });
    
    // Solo cargar datos si hay un grupo seleccionado
    if (!this.selectedGroup) {
      console.log('No hay grupo seleccionado, tabla vacía');
      this.registros = [];
      this.registrosFiltrados = [];
      this.totalItems = 0;
      this.currentPage = 1;
      this.cdr.markForCheck();
      return;
    }
    
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const filtros = {
      grupoId: this.selectedGroup,
      materiaId: this.selectedMateria || undefined,
      fechaInicio: this.fechaInicio || undefined,
      fechaFin: this.fechaFin || undefined,
      search: this.searchQuery || undefined
    };

    console.log('🔍 Filtros aplicados:', filtros);

    // Cargar todos los datos en paralelo
    forkJoin([
    this.attendanceHistoryService.getHistorialAsistencia(
      filtros.grupoId,
      filtros.materiaId,
      filtros.fechaInicio,
      filtros.fechaFin,
      filtros.search
      ),
      this.attendanceHistoryService.getAlumnosDelGrupo(this.selectedGroup),
      this.attendanceHistoryService.getMaterias(),
      this.attendanceHistoryService.getGrupos()
    ]).pipe(
      catchError(error => {
        console.error('Error al cargar historial de asistencia:', error);
        this.error = error.message || 'Error al cargar el historial de asistencia';
        return [];
      }),
      finalize(() => {
        console.log('Finalizando cargarHistorialAsistencia');
        this.loading = false;
        this.cdr.markForCheck();
      }),
      takeUntil(this.destroy$)
    )
    .subscribe(([asistencias, alumnos, materias, grupos]) => {
      console.log('Datos recibidos:', { asistencias, alumnos, materias, grupos });
      
      // Hacer el join para mostrar los nombres
      this.registros = asistencias.map(reg => {
        // Buscar alumno por user_id
        const alumno = alumnos.find(a => a.student_id === reg.user_id || a.users?.id === reg.user_id);
        // Buscar materia
        const materia = materias.find(m => m.id === reg.subject_id);
        // Buscar grupo (usando group_id del alumno)
        const grupo = grupos.find(g => g.id === (alumno?.group_id));

        const registroCompleto = {
          ...reg,
          student_name: alumno ? `${alumno.users.first_name} ${alumno.users.last_name}` : 'Desconocido',
          group_name: grupo ? grupo.name : 'Desconocido',
          subject_name: materia ? materia.name : 'Desconocido'
        };

        console.log('Registro procesado:', registroCompleto);
        return registroCompleto;
      });

      this.registrosFiltrados = [...this.registros];
      this.totalItems = this.registrosFiltrados.length;
      
      // Solo resetear a página 1 si es una carga inicial o cambio de filtros
      // NO resetear si es una actualización de asistencia
      if (this.currentPage === 1 || this.currentPage > Math.ceil(this.totalItems / this.itemsPerPage)) {
      this.currentPage = 1;
      }
      
      console.log('Registros procesados:', this.registros.length, 'Página actual:', this.currentPage);
      
      this.cdr.markForCheck();
    });
  }

  private getCacheKey(): string {
    const key = `${this.selectedGroup || 'no-group'}-${this.selectedMateria || 'no-materia'}-${this.fechaInicio || 'no-fecha'}-${this.fechaFin || 'no-fecha'}-${this.searchQuery || 'no-search'}`;
    console.log('Cache key generado:', key);
    return key;
  }

  onGroupChange(): void {
    console.log('Grupo cambiado:', this.selectedGroup);
    this.cargarHistorialAsistencia();
  }

  onMateriaChange(): void {
    console.log('Materia cambiada:', this.selectedMateria);
    this.cargarHistorialAsistencia();
  }

  onFechaInicioChange(): void {
    console.log('Fecha inicio cambiada:', this.fechaInicio);
    if (this.selectedGroup) {
      this.cargarHistorialAsistencia();
    }
  }

  onFechaFinChange(): void {
    console.log('Fecha fin cambiada:', this.fechaFin);
    if (this.selectedGroup) {
      this.cargarHistorialAsistencia();
    }
  }

  onSearchChange(): void {
    console.log('Búsqueda cambiada:', this.searchQuery);
    this.searchSubject.next(this.searchQuery);
    
    // Si hay término de búsqueda, recargar datos para incluir alumnos del grupo
    if (this.searchQuery.trim()) {
      console.log('Recargando datos para búsqueda...');
      this.cargarHistorialAsistencia();
    } else {
      // Si no hay término de búsqueda, solo filtrar los registros existentes
      this.filtrarRegistros();
    }
  }

  filtrarRegistros(): void {
    if (!this.registros.length) return;

    this.registrosFiltrados = this.registros.filter(reg => {
      // Buscar por nombre del alumno (sin matrícula ya que la eliminamos)
      const matchesSearch = !this.searchQuery || 
        reg.student_name?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        reg.nombre?.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesGroup = !this.selectedGroup || reg.group_id == this.selectedGroup || reg.grupoId == this.selectedGroup;
      const matchesMateria = !this.selectedMateria || reg.subject_id == this.selectedMateria || reg.materiaId == this.selectedMateria;
      
      return matchesSearch && matchesGroup && matchesMateria;
    });
    
    this.totalItems = this.registrosFiltrados.length;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  cambiarEstadoAsistencia(registro: any, nuevoEstado: 'present' | 'absent' | 'late'): void {
    if (!registro || !registro.id) {
      console.error('Registro inválido para actualizar');
      return;
    }

    // Guardar la página actual y posición para preservarla
    const paginaActual = this.currentPage;
    const totalItemsActual = this.totalItems;
    console.log('Preservando posición - Página:', paginaActual, 'Total items:', totalItemsActual);

    this.loading = true;
    this.error = '';

    this.attendanceHistoryService.actualizarAsistencia(registro.id, nuevoEstado)
      .pipe(
        catchError(error => {
          console.error('Error al actualizar asistencia:', error);
          this.error = error.message || 'Error al actualizar la asistencia';
          return [];
        }),
        finalize(() => {
          this.loading = false;
          // Restaurar la página actual y asegurar que no se recargue
          this.currentPage = paginaActual;
          this.totalItems = totalItemsActual;
          console.log('Posición restaurada - Página:', this.currentPage);
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          console.log('Asistencia actualizada exitosamente:', response);
          // Actualizar SOLO el estado local del registro específico
          registro.status = nuevoEstado;
          registro.asistencia = nuevoEstado;
          
          // NO recargar nada más para evitar volver al inicio
          console.log('Estado local actualizado sin recargar tabla');
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al actualizar asistencia:', error);
          this.error = error.message || 'Error al actualizar la asistencia';
        }
      });
  }

  cargarEstadisticas(): void {
    if (!this.selectedGroup) { // Assuming selectedGroup is the filter for statistics
      this.estadisticas = null;
      return;
    }

    this.attendanceHistoryService.getEstadisticasAsistencia(
      this.selectedGroup,
      this.selectedMateria, // Assuming selectedMateria is the filter for statistics
      this.fechaInicio,
      this.fechaFin
    ).subscribe({
      next: (data) => {
        this.estadisticas = data;
      },
      error: (error) => {
        console.error('Error al cargar estadísticas:', error);
        this.estadisticas = null;
      }
    });
  }

  toggleAutoRefresh(): void {
    // TEMPORAL: Deshabilitar completamente el auto-refresh
    console.log('Auto-refresh completamente deshabilitado');
    this.autoRefreshEnabled = false;
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = null;
    }
    this.cdr.markForCheck();
    
    // Código original comentado:
    // this.autoRefreshEnabled = !this.autoRefreshEnabled;
    // 
    // if (this.autoRefreshEnabled) {
    //   console.log('Auto-refresh activado - esto puede causar recargas automáticas');
    //   this.autoRefreshInterval = setInterval(() => {
    //     console.log('Auto-refresh ejecutándose...');
    //     this.cargarHistorialAsistencia();
    //   }, 60000); // Aumentado a 60 segundos para mejor rendimiento
    // } else {
    //   console.log('Auto-refresh deshabilitado');
    //   if (this.autoRefreshInterval) {
    //     clearInterval(this.autoRefreshInterval);
    //     this.autoRefreshInterval = null;
    //   }
    // }
    // this.cdr.markForCheck();
  }

  recargarDatos(): void {
    console.log('===== RECARGAR DATOS INICIADO =====');
    console.log('Recargando datos en historial...', {
      selectedGroup: this.selectedGroup,
      selectedMateria: this.selectedMateria,
      currentUser: this.authService.getCurrentUser()
    });
    
    console.log('Limpiando cache...');
    this.cache.clear(); // Limpiar cache
    this.attendanceHistoryService.clearAllCache(); // Limpiar cache del servicio
    
    console.log('Llamando a cargarHistorialAsistencia...');
    this.cargarHistorialAsistencia();
    console.log('===== RECARGAR DATOS FINALIZADO =====');
  }

  // Utilidades optimizadas
  getNombreGrupo(registro: any): string {
    const grupo = this.grupos.find(g => g.id === registro.grupoId);
    return grupo ? grupo.name : registro.grupo;
  }

  getNombreMateria(registro: any): string {
    const materia = this.materias.find(m => m.id === registro.materiaId);
    return materia ? materia.name : registro.materia;
  }

  formatearFecha(fecha: string | Date): string {
    if (!fecha) return '';
    
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getEstadoAsistenciaClass(estado: string): string {
    if (estado === 'present') return 'present';
    if (estado === 'late') return 'late';
    return 'absent';
  }

  getEstadoAsistenciaText(estado: string): string {
    if (estado === 'present') return 'PRESENTE';
    if (estado === 'late') return 'TARDANZA';
    return 'AUSENTE';
  }

  // Paginación optimizada
  get registrosPaginados(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.registrosFiltrados.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPages) {
      this.currentPage = pagina;
      this.cdr.markForCheck();
    }
  }

  get paginas(): number[] {
    const paginas: number[] = [];
    const maxPaginas = 5;
    let inicio = Math.max(1, this.currentPage - Math.floor(maxPaginas / 2));
    let fin = Math.min(this.totalPages, inicio + maxPaginas - 1);
    
    if (fin - inicio + 1 < maxPaginas) {
      inicio = Math.max(1, fin - maxPaginas + 1);
    }
    
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    
    return paginas;
  }
}