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
  todosLosAlumnos: any[] = []; // Nueva propiedad para todos los alumnos del grupo

  // Filtros
  selectedGroup: any = null;
  selectedMateria: any = null;
  fechaInicio: string = '';
  fechaFin: string = '';
  
  // Propiedad para controlar visibilidad del dropdown de materias
  showSubjectDropdown: boolean = false;
  currentUser: any = null;

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
    console.log('AttendanceHistoryComponent ngOnInit iniciado');
    
    // Verificar autenticación
    const currentUser = this.authService.getCurrentUser();
    this.currentUser = currentUser;
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

    // Cargar solo grupos asignados al profesor (las materias se cargarán cuando se seleccione un grupo)
    this.attendanceHistoryService.getGruposAsignados(currentTeacher.id)
      .pipe(
        catchError(error => {
          console.error('Error cargando grupos:', error);
          this.error = 'Error al cargar los grupos';
          return [];
        }),
        finalize(() => {
          console.log('Finalizando cargarDatosIniciales');
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((grupos) => {
        console.log('Grupos asignados al profesor:', grupos);
        
        // Asignar grupos del profesor
        this.grupos = Array.isArray(grupos) ? grupos : [];
        
        if (this.grupos.length > 0) {
          this.selectedGroup = this.grupos[0].id;
          console.log('Grupo seleccionado:', this.selectedGroup);
          
          // Cargar las materias del primer grupo seleccionado
          this.attendanceHistoryService.getMateriasDelGrupo(currentTeacher.id, this.selectedGroup)
            .subscribe(materiasDelGrupo => {
              console.log('Materias del grupo inicial:', materiasDelGrupo);
              
              // Asignar materias del grupo
              this.materias = Array.isArray(materiasDelGrupo) ? materiasDelGrupo : [];
              
              // Aplicar la lógica del dropdown condicional para el grupo inicial
              if (this.materias && this.materias.length > 1) {
                // Si hay múltiples materias, mostrar el dropdown
                this.showSubjectDropdown = true;
                this.selectedMateria = null;
              } else if (this.materias && this.materias.length === 1) {
                // Si solo hay una materia, seleccionarla automáticamente
                this.showSubjectDropdown = false;
                this.selectedMateria = this.materias[0].id;
              } else {
                // Si no hay materias
                this.showSubjectDropdown = false;
                this.selectedMateria = null;
              }
              
              this.cdr.markForCheck();
              
              // Cargar historial después de configurar las materias
              console.log('Cargando historial de asistencia...');
              this.cargarHistorialAsistencia();
            });
        } else {
          console.log('No hay grupos disponibles para el profesor');
          this.materias = [];
          this.showSubjectDropdown = false;
          this.selectedMateria = null;
        }
        
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
      search: undefined // Eliminado searchQuery
    };

    console.log('Filtros aplicados:', filtros);
    console.log('Fecha inicio validación:', {
      fechaInicio: this.fechaInicio,
      tipo: typeof this.fechaInicio,
      longitud: this.fechaInicio?.length,
      formato: this.fechaInicio ? 'YYYY-MM-DD esperado' : 'vacío'
    });
    console.log('Fecha fin validación:', {
      fechaFin: this.fechaFin,
      tipo: typeof this.fechaFin,
      longitud: this.fechaFin?.length,
      formato: this.fechaFin ? 'YYYY-MM-DD esperado' : 'vacío'
    });

    // Cargar datos principales usando los grupos ya cargados
    this.attendanceHistoryService.getHistorialAsistencia(
      filtros.grupoId,
      filtros.materiaId,
      filtros.fechaInicio,
      filtros.fechaFin,
      undefined // Eliminado filtros.search
    ).pipe(
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
    .subscribe((asistencias) => {
      console.log('Datos recibidos:', { asistencias });
      
      // Los datos ya vienen procesados del servicio, usar el grupo seleccionado
      this.registros = asistencias.map(reg => {
        const registroCompleto = {
          ...reg,
          // student_name y subject_name ya vienen del servicio
          group_name: this.getNombreGrupoSeleccionado(),
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
      
      // Cargar todos los alumnos del grupo
      this.cargarTodosLosAlumnos();
    });
  }

  private getCacheKey(): string {
    const key = `${this.selectedGroup || 'no-group'}-${this.selectedMateria || 'no-materia'}-${this.fechaInicio || 'no-fecha'}-${this.fechaFin || 'no-fecha'}-${undefined}`; // Eliminado searchQuery
    console.log('Cache key generado:', key);
    return key;
  }

  onGroupChange(): void {
    console.log('Grupo cambiado:', this.selectedGroup);
    
    // Obtener las materias del grupo seleccionado
    const selectedGroupData = this.grupos.find(g => g.id == this.selectedGroup);
    
    if (selectedGroupData) {
      console.log('Grupo encontrado:', selectedGroupData);
      
      // Obtener solo las materias del grupo seleccionado
      const currentTeacher = this.authService.getCurrentUser();
      if (currentTeacher?.id) {
        console.log('Obteniendo materias del grupo', this.selectedGroup, 'para el profesor', currentTeacher.id);
        
        this.attendanceHistoryService.getMateriasDelGrupo(currentTeacher.id, this.selectedGroup)
          .subscribe(materiasDelGrupo => {
            console.log('Materias del grupo seleccionado:', materiasDelGrupo);
            console.log('Total de materias encontradas para el grupo:', materiasDelGrupo.length);
            
            // Actualizar las materias disponibles solo con las del grupo
            this.materias = materiasDelGrupo;
            
            // Determinar si mostrar el dropdown de materias
            this.showSubjectDropdown = this.materias && this.materias.length > 1;
            
            if (this.showSubjectDropdown) {
              // Si hay múltiples materias, resetear la selección
              this.selectedMateria = null;
              console.log('Mostrando dropdown de materias (múltiples materias disponibles)');
            } else if (this.materias && this.materias.length === 1) {
              // Si solo hay una materia, seleccionarla automáticamente
              this.selectedMateria = this.materias[0].id;
              console.log('Materia única seleccionada automáticamente:', this.materias[0].name);
            } else {
              // Si no hay materias, resetear la selección
              this.selectedMateria = null;
              console.log('No hay materias disponibles para este grupo');
            }
            
            this.cdr.markForCheck();
            
            // Cargar historial después de configurar las materias
            console.log('Cargando historial de asistencia después de configurar materias...');
            this.cargarHistorialAsistencia();
            
            // Cargar todos los alumnos del grupo
            this.cargarTodosLosAlumnos();
          });
      } else {
        console.error('No se pudo obtener el profesor autenticado');
        this.materias = [];
        this.showSubjectDropdown = false;
        this.selectedMateria = null;
        
        // Cargar historial y alumnos de todas formas
        this.cargarHistorialAsistencia();
        this.cargarTodosLosAlumnos();
      }
    } else {
      console.log('No se encontró el grupo seleccionado');
      this.showSubjectDropdown = false;
      this.selectedMateria = null;
      this.materias = [];
      
      // Cargar historial y alumnos de todas formas
      this.cargarHistorialAsistencia();
      this.cargarTodosLosAlumnos();
    }
  }

  onMateriaChange(): void {
    console.log('Materia cambiada:', this.selectedMateria);
    this.cargarHistorialAsistencia();
  }

  onFechaInicioChange(): void {
    console.log('Fecha inicio cambiada:', this.fechaInicio);
    console.log('Tipo de fecha inicio:', typeof this.fechaInicio);
    if (this.selectedGroup) {
      this.cargarHistorialAsistencia();
    }
  }

  onFechaFinChange(): void {
    console.log('Fecha fin cambiada:', this.fechaFin);
    console.log('Tipo de fecha fin:', typeof this.fechaFin);
    if (this.selectedGroup) {
      this.cargarHistorialAsistencia();
    }
  }

  filtrarRegistros(): void {
    console.log('Filtrando registros...');
    console.log('Registros totales:', this.registros.length);
    console.log('Filtros actuales:', {
      grupo: this.selectedGroup,
      materia: this.selectedMateria,
      fechaInicio: this.fechaInicio,
      fechaFin: this.fechaFin
    });

    this.registrosFiltrados = this.registros.filter(registro => {
      // Filtro por grupo
      if (this.selectedGroup && registro.group_id != this.selectedGroup) {
        return false;
      }

      // Filtro por materia
      if (this.selectedMateria && registro.subject_id != this.selectedMateria) {
        return false;
      }

      // Filtro por fecha de inicio
      if (this.fechaInicio) {
        const fechaRegistro = new Date(registro.date);
        const fechaInicio = new Date(this.fechaInicio);
        if (fechaRegistro < fechaInicio) {
          return false;
        }
      }

      // Filtro por fecha de fin
      if (this.fechaFin) {
        const fechaRegistro = new Date(registro.date);
        const fechaFin = new Date(this.fechaFin);
        if (fechaRegistro > fechaFin) {
          return false;
        }
      }

      return true;
    });

    console.log('Registros filtrados:', this.registrosFiltrados.length);
    this.totalItems = this.registrosFiltrados.length;
    this.currentPage = 1; // Resetear a la primera página
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
    console.log('===== RECARGAR DATOS COMPLETOS DESDE API =====');
    console.log('Recargando TODA la vista desde la API...');
    
    // Limpiar TODOS los datos actuales
    this.selectedGroup = null;
    this.selectedMateria = null;
    this.fechaInicio = '';
    this.fechaFin = '';
    this.grupos = [];
    this.materias = [];
    this.registros = [];
    this.registrosFiltrados = [];
    this.estadisticas = null;
    this.error = '';
    this.loading = false;
    this.currentPage = 1;
    this.totalItems = 0;
    this.showSubjectDropdown = false;
    
    console.log('Estado después de limpiar:', {
      selectedGroup: this.selectedGroup,
      selectedMateria: this.selectedMateria,
      fechaInicio: this.fechaInicio,
      fechaFin: this.fechaFin,
      grupos: this.grupos.length,
      materias: this.materias.length,
      registros: this.registros.length
    });
    
    // Limpiar cache
    this.cache.clear();
    this.attendanceHistoryService.clearAllCache();
    
    // Recargar TODOS los datos desde cero
    this.cargarDatosIniciales();
    
    console.log('===== RECARGA COMPLETA FINALIZADA =====');
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
    
    console.log('🔍 formatearFecha recibió:', fecha, 'tipo:', typeof fecha);
    
    let date: Date;
    
    if (typeof fecha === 'string') {
      // Para fechas en formato string, crear la fecha de manera que preserve la fecha local
      // en lugar de interpretarla como UTC
      if (fecha.includes('T') || fecha.includes('Z')) {
        // Es una fecha ISO, extraer solo la parte de fecha
        const fechaPart = fecha.split('T')[0];
        const [year, month, day] = fechaPart.split('-').map(Number);
        date = new Date(year, month - 1, day); // month - 1 porque los meses en JS van de 0-11
        console.log('Fecha ISO detectada, extraída:', fechaPart, 'creada como:', date);
      } else {
        // Es una fecha simple YYYY-MM-DD
        const [year, month, day] = fecha.split('-').map(Number);
        date = new Date(year, month - 1, day);
        console.log('Fecha simple detectada, creada como:', date);
      }
    } else {
      date = fecha;
      console.log('Objeto Date recibido:', date);
    }
    
    // Verificar que la fecha sea válida
    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida:', fecha);
      return fecha.toString();
    }
    
    // Formatear a DD/MM/YYYY
    const fechaFormateada = date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    console.log('Fecha formateada:', fechaFormateada);
    return fechaFormateada;
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

  // Métodos para la nueva tabla de alumnos
  getNombreGrupoSeleccionado(): string {
    if (!this.selectedGroup || !this.grupos) {
      return 'Grupo no disponible';
    }
    
    const grupo = this.grupos.find(g => g.id == this.selectedGroup);
    return grupo ? grupo.name : 'Grupo no disponible';
  }

  getEstadoAsistenciaAlumnoActual(alumnoId: number): any {
    if (!this.registros || this.registros.length === 0) {
      return null;
    }

    // Buscar el registro más reciente para este alumno
    const registrosAlumno = this.registros.filter(reg => reg.user_id === alumnoId);
    return registrosAlumno.length > 0 ? 
      registrosAlumno.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : 
      null;
  }

  cargarTodosLosAlumnos(): void {
    if (!this.selectedGroup) {
      this.todosLosAlumnos = [];
      return;
    }

    // Usar el endpoint que ya tienes para obtener alumnos del grupo
    this.attendanceHistoryService.getAlumnosDelGrupo(this.selectedGroup)
      .subscribe(alumnos => {
        this.todosLosAlumnos = Array.isArray(alumnos) ? alumnos : [];
        this.cdr.markForCheck();
      });
  }

  // Método para probar formatos de fecha
  probarFormatosFecha(): void {
    console.log('PROBANDO FORMATOS DE FECHA');
    
    if (this.fechaInicio) {
      // Assuming dashboardService is available, otherwise this will cause an error.
      // For now, commenting out as it's not defined in the original file.
      // this.dashboardService.probarFormatosFecha(this.fechaInicio);
    } else {
      // Probar con una fecha de ejemplo
      // this.dashboardService.probarFormatosFecha('2025-08-10');
    }
  }

  // Pipe personalizado para formatear fechas
  formatearFechaPipe(fecha: string | Date): string {
    if (!fecha) return '';
    
    try {
      let date: Date;
      
      if (typeof fecha === 'string') {
        // Si es una fecha ISO completa, extraer solo la parte de fecha
        if (fecha.includes('T') || fecha.includes('Z')) {
          const fechaPart = fecha.split('T')[0];
          const [year, month, day] = fechaPart.split('-').map(Number);
          date = new Date(year, month - 1, day);
        } else {
          // Es una fecha simple YYYY-MM-DD
          const [year, month, day] = fecha.split('-').map(Number);
          date = new Date(year, month - 1, day);
        }
      } else {
        date = fecha;
      }
      
      // Verificar que la fecha sea válida
      if (isNaN(date.getTime())) {
        return fecha.toString();
      }
      
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error al formatear fecha:', error, 'fecha original:', fecha);
      return fecha.toString();
    }
  }

  // Método alternativo para formatear fechas (más simple)
  formatearFechaSimple(fecha: string | Date): string {
    if (!fecha) return '';
    
    try {
      // Si es string y contiene T o Z, extraer solo la parte de fecha
      if (typeof fecha === 'string' && (fecha.includes('T') || fecha.includes('Z'))) {
        const fechaPart = fecha.split('T')[0];
        // Convertir YYYY-MM-DD a DD/MM/YYYY
        const [year, month, day] = fechaPart.split('-');
        return `${day}/${month}/${year}`;
      }
      
      // Si es string simple en formato YYYY-MM-DD, convertirlo a DD/MM/YYYY
      if (typeof fecha === 'string' && fecha.includes('-') && fecha.length === 10) {
        const [year, month, day] = fecha.split('-');
        return `${day}/${month}/${year}`;
      }
      
      // Si es Date, formatearlo a DD/MM/YYYY
      if (fecha instanceof Date) {
        return fecha.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      return String(fecha);
    } catch (error) {
      console.error('Error en formatearFechaSimple:', error);
      return String(fecha);
    }
  }
}