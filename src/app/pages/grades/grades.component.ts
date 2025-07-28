import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GradesService } from '../../services/grades.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin, interval, Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-grades',
  standalone: true,
  templateUrl: './grades.component.html',
  styleUrls: ['./grades.component.css'],
  imports: [CommonModule, FormsModule, RouterLink]
})
export class GradesComponent implements OnInit, OnDestroy {
  grupos: any[] = [];
  materias: any[] = [];
  alumnos: any[] = [];
  alumnosFiltrados: any[] = [];
  searchQuery: string = '';
  selectedGroup: any = '';
  selectedSubject: any = '';
  activeTab: string = '1';
  currentTeacher: any = null;
  private autoRefreshSubscription?: Subscription;
  autoRefreshEnabled = false;
  
  // Nuevas propiedades para unidades dinámicas
  subjectUnits: any[] = [];
  selectedSubjectConfig: any = null;
  
  // Propiedad para controlar visibilidad del dropdown de materias
  showSubjectDropdown: boolean = false;

  constructor(
    private gradesService: GradesService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('GradesComponent ngOnInit iniciado');
    this.currentTeacher = this.authService.getCurrentUser();
    console.log('Usuario actual:', this.currentTeacher);
    console.log('localStorage userId:', localStorage.getItem('userId'));
    console.log('localStorage email:', localStorage.getItem('email'));
    console.log('localStorage token:', localStorage.getItem('token'));
    
    // Verificar autenticación
    if (!this.currentTeacher || !localStorage.getItem('token')) {
      console.log('⚠️ No hay usuario autenticado o token expirado');
      console.log('🔑 Token en localStorage:', localStorage.getItem('token'));
      console.log('👤 Usuario en localStorage:', localStorage.getItem('userId'));
      
      // En lugar de mostrar alerta, vamos a intentar cargar datos de todos modos
      console.log('🔄 Intentando cargar datos sin autenticación...');
    } else {
      console.log('✅ Usuario autenticado correctamente');
    }
    
    this.cargarDatosDelProfesor();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  cargarDatosDelProfesor(): void {
    console.log('🔍 Cargando datos del profesor:', this.currentTeacher?.id);
    
    if (!this.currentTeacher?.id) {
      console.error('❌ No hay profesor autenticado');
      return;
    }
    
    // Cargar SOLO las asignaciones del profesor (sus grupos)
    console.log('📡 Cargando asignaciones del profesor...');
    this.gradesService.getTeacherAssignments(this.currentTeacher.id).subscribe({
      next: (assignments) => {
        console.log('✅ Asignaciones del profesor recibidas:', assignments);
        
        // Procesar asignaciones para obtener grupos únicos del profesor
        const teacherGroups = new Map();
        
        assignments.forEach((assignment: any) => {
          const groupId = assignment.group_id || assignment.groups?.id;
          const groupName = assignment.groups?.name || assignment.group_name;
          const subjectId = assignment.subject_id || assignment.subjects?.id;
          const subjectName = assignment.subjects?.name || assignment.subject_name;
          
          if (groupId && groupName) {
            if (!teacherGroups.has(groupId)) {
              teacherGroups.set(groupId, {
                id: groupId,
                name: groupName,
                subjects: []
              });
            }
            
            // Agregar materia si no existe
            const group = teacherGroups.get(groupId);
            const subjectExists = group.subjects.find((s: any) => s.id === subjectId);
            if (!subjectExists && subjectId && subjectName) {
              group.subjects.push({
                id: subjectId,
                name: subjectName
              });
            }
          }
        });
        
        // Asignar solo los grupos del profesor
        this.grupos = Array.from(teacherGroups.values());
        console.log('✅ Grupos del profesor cargados:', this.grupos);
        
        // Si solo hay un grupo, seleccionarlo automáticamente
        if (this.grupos.length === 1) {
          this.selectedGroup = this.grupos[0].id;
          console.log('✅ Grupo único seleccionado automáticamente:', this.selectedGroup);
          this.onGroupChange();
        }
        
        // Si no hay grupos, mostrar mensaje
        if (this.grupos.length === 0) {
          console.log('⚠️ El profesor no tiene grupos asignados');
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar asignaciones del profesor:', error);
        console.log('⚠️ No se pudieron cargar los grupos del profesor');
        this.grupos = [];
      }
    });
  }

  onGroupChange(): void {
    if (!this.selectedGroup || !this.currentTeacher?.id) return;
    
    console.log('🔄 Grupo seleccionado:', this.selectedGroup);
    console.log('📚 Grupos disponibles:', this.grupos);
    
    const selectedGroupData = this.grupos.find(g => g.id == this.selectedGroup);
    console.log('📦 Datos del grupo seleccionado:', selectedGroupData);
    
    if (selectedGroupData) {
      this.materias = selectedGroupData.subjects || [];
      console.log('📖 Materias del grupo:', this.materias);
      
      // Determinar si mostrar el dropdown de materias
      this.showSubjectDropdown = this.materias && this.materias.length > 1;
      
      if (this.showSubjectDropdown) {
        // Si hay múltiples materias, resetear la selección
        this.selectedSubject = '';
        console.log('⚠️ Múltiples materias disponibles, selecciona una');
      } else if (this.materias && this.materias.length === 1) {
        // Si solo hay una materia, seleccionarla automáticamente
        this.selectedSubject = this.materias[0].id;
        console.log('✅ Materia única seleccionada automáticamente:', this.selectedSubject);
        // Cargar datos automáticamente después de un pequeño delay
        setTimeout(() => {
          this.onSubjectChange();
        }, 100);
      }
    } else {
      console.log('❌ No se encontró el grupo seleccionado');
      this.materias = [];
      this.showSubjectDropdown = false;
      this.selectedSubject = '';
    }
    
    this.cargarAlumnosDelGrupo();
  }

  onSubjectChange(): void {
    if (!this.selectedSubject) return;
    
    console.log('🔄 Materia seleccionada:', this.selectedSubject);
    console.log('📚 Materias disponibles:', this.materias);
    
    // Forzar la recarga de datos para esta materia
    this.cargarDatosParaMateria(this.selectedSubject);
  }



  cargarDatosParaMateria(subjectId: any): void {
    console.log('📡 Cargando datos para materia:', subjectId);
    
    // Cargar configuración de unidades para la materia seleccionada
    this.gradesService.getSubjectUnits(Number(subjectId)).subscribe({
      next: (config) => {
        console.log('✅ Configuración de materia cargada:', config);
        this.selectedSubjectConfig = config;
        this.subjectUnits = config.units || [];
        console.log('✅ Unidades configuradas:', this.subjectUnits);
        
        // Reinicializar las unidades dinámicas para todos los alumnos
        this.alumnos.forEach(alumno => {
          this.subjectUnits.forEach(unit => {
            (alumno as any)[`u${unit.number}`] = 0;
          });
        });
        
        this.cargarCalificacionesPorMateria();
      },
      error: (error) => {
        console.error('❌ Error al cargar configuración de materia:', error);
        console.log('⚠️ Usando unidades por defecto...');
        // Usar unidades por defecto si hay error
        this.subjectUnits = [
          { number: 1, name: 'Unidad 1' },
          { number: 2, name: 'Unidad 2' },
          { number: 3, name: 'Unidad 3' },
          { number: 4, name: 'Unidad 4' },
          { number: 5, name: 'Unidad 5' }
        ];
        this.cargarCalificacionesPorMateria();
      }
    });
  }

  cargarAlumnosDelGrupo(): void {
    if (!this.selectedGroup) return;
    
    console.log('📡 Cargando alumnos del grupo:', this.selectedGroup);
    
    // Intentar obtener estudiantes reales de la API
    this.gradesService.getStudentsByGroup(this.selectedGroup).subscribe({
      next: (students) => {
        console.log('✅ Alumnos recibidos del grupo específico:', students);
        this.procesarAlumnos(students);
      },
      error: (error) => {
        console.log('⚠️ Error con endpoint específico, intentando con endpoint general...');
        this.gradesService.getAllStudents().subscribe({
          next: (allStudents) => {
            console.log('✅ Todos los alumnos recibidos:', allStudents);
            const groupStudents = allStudents.filter((student: any) => 
              student.group_id == this.selectedGroup || student.groups?.id == this.selectedGroup
            );
            console.log('✅ Alumnos filtrados por grupo:', groupStudents);
            this.procesarAlumnos(groupStudents);
          },
          error: (error2) => {
            console.error('❌ Error al cargar alumnos:', error2);
            console.log('⚠️ No se pudieron cargar estudiantes de la API');
            this.alumnos = [];
            this.filtrarAlumnos();
          }
        });
      }
    });
  }

  private procesarAlumnos(students: any[]): void {
    console.log('🔄 Procesando alumnos:', students);
    
    this.alumnos = students.map(studentAssignment => {
      // Extraer información del estudiante desde la estructura real de la API
      const student = studentAssignment.users || studentAssignment;
      const studentId = student.id;
      const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      
      const alumno: any = {
        id: studentId,
        nombre: studentName,
        group_id: studentAssignment.group_id,
        materia: this.materias.find(m => m.id === this.selectedSubject)?.name || 'N/A'
      };
      
      // Inicializar calificaciones para cada unidad
      this.subjectUnits.forEach(unit => {
        alumno[`u${unit.number}`] = 0;
        alumno[`gradeId${unit.number}`] = null;
      });
      
      console.log('✅ Alumno procesado:', alumno);
      return alumno;
    });
    
    console.log('📊 Total de alumnos procesados:', this.alumnos.length);
    this.filtrarAlumnos();
  }

  cargarCalificacionesPorMateria(): void {
    if (!this.selectedSubject || this.alumnos.length === 0) return;
    
    console.log('🔍 Cargando calificaciones para materia:', this.selectedSubject);
    console.log('📚 Alumnos a procesar:', this.alumnos.length);
    console.log('📖 Unidades disponibles:', this.subjectUnits);
    
    // Intentar cargar calificaciones reales de la API
    const requests = this.alumnos.map((alumno: any) =>
      this.gradesService.getGradesByStudentAndSubject(alumno.id, this.selectedSubject)
    );
    
    forkJoin(requests).subscribe({
      next: (gradesArr) => {
        console.log('📦 Respuestas de calificaciones recibidas:', gradesArr);
        
        this.alumnos = this.alumnos.map((alumno: any, idx: number) => {
          const gradesResponse = gradesArr[idx] as any;
          const grades = gradesResponse?.data?.grades || gradesResponse?.grades || gradesResponse || [];
          
          console.log(`📊 Calificaciones para alumno ${alumno.nombre}:`, grades);
          
          const updatedAlumno = {
            ...alumno,
            materia: this.materias.find(m => m.id == this.selectedSubject)?.name || '',
            gradeId: null
          };
          
          // Cargar calificaciones dinámicas para cada unidad
          this.subjectUnits.forEach(unit => {
            const unitGrade = grades.find((g: any) => g.unit_number === unit.number);
            updatedAlumno[`u${unit.number}`] = unitGrade?.grade || 0;
            if (unitGrade?.id) {
              updatedAlumno[`gradeId${unit.number}`] = unitGrade.id; // Guardar ID por unidad
            }
            console.log(`📝 Unidad ${unit.number} para ${alumno.nombre}: ${updatedAlumno[`u${unit.number}`]} (ID: ${updatedAlumno[`gradeId${unit.number}`]})`);
          });
          
          return updatedAlumno;
        });
        
        console.log('✅ Alumnos actualizados con calificaciones:', this.alumnos);
        this.filtrarAlumnos();
      },
      error: (error) => {
        console.error('❌ Error al cargar calificaciones:', error);
        console.log('⚠️ No se pudieron cargar calificaciones de la API, inicializando en 0...');
        
        // En caso de error, inicializar calificaciones en 0
        this.alumnos = this.alumnos.map((alumno: any) => {
          const updatedAlumno = {
            ...alumno,
            materia: this.materias.find(m => m.id == this.selectedSubject)?.name || '',
            gradeId: null
          };
          
          this.subjectUnits.forEach(unit => {
            updatedAlumno[`u${unit.number}`] = 0;
            updatedAlumno[`gradeId${unit.number}`] = null; // Inicializar ID como null
            console.log(`📝 Unidad ${unit.number} para ${alumno.nombre}: 0 (inicializado)`);
          });
          
          return updatedAlumno;
        });
        
        this.filtrarAlumnos();
      }
    });
  }

  filtrarAlumnos(): void {
    this.alumnosFiltrados = this.alumnos.filter(alumno => {
      const matchesSearch = !this.searchQuery || 
        alumno.nombre?.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesSearch;
    });
  }

  calcularPromedio(alumno: any): number {
    if (this.subjectUnits.length === 0) return 0;
    
    const sum = this.subjectUnits.reduce((total, unit) => {
      return total + (alumno[`u${unit.number}`] || 0);
    }, 0);
    
    return Math.round(sum / this.subjectUnits.length);
  }

  guardarCalificaciones(alumno: any): void {
    console.log('💾 Guardando calificaciones para:', alumno.nombre);
    console.log('📚 Unidades a procesar:', this.subjectUnits);
    
    let savedCount = 0;
    let errorCount = 0;
    
    // Guardar cada unidad por separado según la estructura de tu API
    this.subjectUnits.forEach(unit => {
      const gradeValue = alumno[`u${unit.number}`] || 0;
      const existingGradeId = alumno[`gradeId${unit.number}`];
      
      console.log(`📝 Procesando unidad ${unit.number}: ${gradeValue} (ID existente: ${existingGradeId})`);
      
      if (gradeValue > 0) {
        const gradeData = {
          student_id: alumno.id,
          subject_id: this.selectedSubject,
          unit_number: unit.number,
          grade: gradeValue
        };
        
        console.log('📤 Enviando datos a /api/grades:', gradeData);
        
        // Si ya existe una calificación, actualizar; si no, crear
        if (existingGradeId) {
          console.log(`🔄 Actualizando calificación existente ID: ${existingGradeId}`);
          this.gradesService.updateGrade(existingGradeId, gradeData).subscribe({
            next: (response) => {
              console.log(`✅ Calificación actualizada para unidad ${unit.number}:`, response);
              savedCount++;
              
              // Si es la última unidad, mostrar resumen
              if (savedCount + errorCount === this.subjectUnits.length) {
                this.mostrarResumenGuardado(alumno.nombre, savedCount, errorCount);
              }
            },
            error: (error) => {
              console.error(`❌ Error al actualizar calificación para unidad ${unit.number}:`, error);
              errorCount++;
              
              // Si es la última unidad, mostrar resumen
              if (savedCount + errorCount === this.subjectUnits.length) {
                this.mostrarResumenGuardado(alumno.nombre, savedCount, errorCount);
              }
            }
          });
        } else {
          console.log(`➕ Creando nueva calificación`);
          this.gradesService.createGrade(gradeData).subscribe({
            next: (response) => {
              console.log(`✅ Calificación creada para unidad ${unit.number}:`, response);
              savedCount++;
              
              // Si es la última unidad, mostrar resumen
              if (savedCount + errorCount === this.subjectUnits.length) {
                this.mostrarResumenGuardado(alumno.nombre, savedCount, errorCount);
              }
            },
            error: (error) => {
              console.error(`❌ Error al crear calificación para unidad ${unit.number}:`, error);
              
              // Si ya existe, buscar la calificación existente y actualizarla
              if (error.error?.msg?.includes('Ya existe') || error.status === 500) {
                console.log('⚠️ La calificación ya existe, buscando ID existente...');
                this.intentarActualizarCalificacion(alumno.id, this.selectedSubject, unit.number, gradeValue, savedCount, errorCount);
              } else {
                errorCount++;
                // Si es la última unidad, mostrar resumen
                if (savedCount + errorCount === this.subjectUnits.length) {
                  this.mostrarResumenGuardado(alumno.nombre, savedCount, errorCount);
                }
              }
            }
          });
        }
      } else {
        console.log(`⏭️ Saltando unidad ${unit.number} (valor 0)`);
        // Si es la última unidad, mostrar resumen
        if (savedCount + errorCount + 1 === this.subjectUnits.length) {
          this.mostrarResumenGuardado(alumno.nombre, savedCount, errorCount);
        }
      }
    });
  }

  actualizarCalificaciones(alumno: any): void {
    console.log('🔄 Actualizando calificaciones para:', alumno.nombre);
    console.log('📚 Unidades a procesar:', this.subjectUnits);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Actualizar solo calificaciones que ya existen
    this.subjectUnits.forEach(unit => {
      const gradeValue = alumno[`u${unit.number}`] || 0;
      const existingGradeId = alumno[`gradeId${unit.number}`];
      
      console.log(`📝 Procesando unidad ${unit.number}: ${gradeValue} (ID existente: ${existingGradeId})`);
      
      if (gradeValue > 0 && existingGradeId) {
        const gradeData = {
          student_id: alumno.id,
          subject_id: this.selectedSubject,
          unit_number: unit.number,
          grade: gradeValue
        };
        
        console.log('📤 Actualizando datos a /api/grades:', gradeData);
        
        this.gradesService.updateGrade(existingGradeId, gradeData).subscribe({
          next: (response) => {
            console.log(`✅ Calificación actualizada para unidad ${unit.number}:`, response);
            updatedCount++;
            
            // Si es la última unidad, mostrar resumen
            if (updatedCount + errorCount === this.subjectUnits.length) {
              this.mostrarResumenActualizado(alumno.nombre, updatedCount, errorCount);
            }
          },
          error: (error) => {
            console.error(`❌ Error al actualizar calificación para unidad ${unit.number}:`, error);
            errorCount++;
            
            // Si es la última unidad, mostrar resumen
            if (updatedCount + errorCount === this.subjectUnits.length) {
              this.mostrarResumenActualizado(alumno.nombre, updatedCount, errorCount);
            }
          }
        });
      } else if (gradeValue > 0 && !existingGradeId) {
        console.log(`⚠️ No se puede actualizar unidad ${unit.number}: No existe ID de calificación`);
        errorCount++;
        
        // Si es la última unidad, mostrar resumen
        if (updatedCount + errorCount === this.subjectUnits.length) {
          this.mostrarResumenActualizado(alumno.nombre, updatedCount, errorCount);
        }
      } else {
        console.log(`⏭️ Saltando unidad ${unit.number} (valor 0 o sin ID)`);
        // Si es la última unidad, mostrar resumen
        if (updatedCount + errorCount + 1 === this.subjectUnits.length) {
          this.mostrarResumenActualizado(alumno.nombre, updatedCount, errorCount);
        }
      }
    });
  }

  // Guardar calificaciones de TODO el grupo
  guardarCalificacionesGrupo(): void {
    if (!this.selectedSubject || this.alumnos.length === 0) {
      console.log('⚠️ No hay materia seleccionada o alumnos para guardar');
      return;
    }
    
    console.log('💾 Guardando calificaciones de TODO el grupo');
    console.log('📚 Materia:', this.selectedSubject);
    console.log('👥 Alumnos a procesar:', this.alumnos.length);
    
    let totalGuardados = 0;
    let totalErrores = 0;
    let procesados = 0;
    
    this.alumnos.forEach((alumno, index) => {
      console.log(`📝 Procesando alumno ${index + 1}/${this.alumnos.length}: ${alumno.nombre}`);
      
      let guardados = 0;
      let errores = 0;
      
      // Guardar calificaciones para cada unidad del alumno
      this.subjectUnits.forEach(unit => {
        const gradeValue = (alumno as any)[`u${unit.number}`];
        
        if (gradeValue !== null && gradeValue !== undefined && gradeValue !== '' && gradeValue > 0) {
          const gradeData = {
            student_id: alumno.id,
            subject_id: this.selectedSubject,
            unit_number: unit.number,
            grade: parseFloat(gradeValue)
          };
          
          this.gradesService.createGrade(gradeData).subscribe({
            next: (response) => {
              console.log(`✅ ${alumno.nombre} - Unidad ${unit.number} guardada`);
              guardados++;
              totalGuardados++;
            },
            error: (error) => {
              console.error(`❌ ${alumno.nombre} - Error unidad ${unit.number}:`, error);
              errores++;
              totalErrores++;
              
              // Si es error de duplicado, intentar actualizar
              if (error.message.includes('Ya existe una calificación')) {
                this.intentarActualizarCalificacion(alumno.id, this.selectedSubject, unit.number, parseFloat(gradeValue), guardados, errores);
              }
            },
            complete: () => {
              procesados++;
              if (procesados === this.alumnos.length) {
                console.log(`✅ Proceso completado: ${totalGuardados} guardados, ${totalErrores} errores`);
                alert(`Calificaciones del grupo guardadas:\n✅ ${totalGuardados} calificaciones guardadas\n❌ ${totalErrores} errores`);
              }
            }
          });
        }
      });
    });
  }

  // Actualizar calificaciones de TODO el grupo
  actualizarCalificacionesGrupo(): void {
    if (!this.selectedSubject || this.alumnos.length === 0) {
      console.log('⚠️ No hay materia seleccionada o alumnos para actualizar');
      return;
    }
    
    console.log('🔄 Actualizando calificaciones de TODO el grupo');
    console.log('📚 Materia:', this.selectedSubject);
    console.log('👥 Alumnos a procesar:', this.alumnos.length);
    
    let totalActualizados = 0;
    let totalErrores = 0;
    let procesados = 0;
    
    this.alumnos.forEach((alumno, index) => {
      console.log(`📝 Procesando alumno ${index + 1}/${this.alumnos.length}: ${alumno.nombre}`);
      
      let actualizados = 0;
      let errores = 0;
      
      // Actualizar calificaciones para cada unidad del alumno
      this.subjectUnits.forEach(unit => {
        const gradeValue = (alumno as any)[`u${unit.number}`];
        const existingGradeId = (alumno as any)[`gradeId${unit.number}`];
        
        if (gradeValue !== null && gradeValue !== undefined && gradeValue !== '' && gradeValue > 0 && existingGradeId) {
          const gradeData = {
            student_id: alumno.id,
            subject_id: this.selectedSubject,
            unit_number: unit.number,
            grade: parseFloat(gradeValue)
          };
          
          console.log(`📤 Actualizando ${alumno.nombre} - Unidad ${unit.number}: ${gradeValue} (ID: ${existingGradeId})`);
          
          this.gradesService.updateGrade(existingGradeId, gradeData).subscribe({
            next: (response) => {
              console.log(`✅ ${alumno.nombre} - Unidad ${unit.number} actualizada`);
              actualizados++;
              totalActualizados++;
            },
            error: (error) => {
              console.error(`❌ ${alumno.nombre} - Error actualizando unidad ${unit.number}:`, error);
              errores++;
              totalErrores++;
            },
            complete: () => {
              procesados++;
              if (procesados === this.alumnos.length) {
                console.log(`✅ Proceso completado: ${totalActualizados} actualizados, ${totalErrores} errores`);
                alert(`Calificaciones del grupo actualizadas:\n✅ ${totalActualizados} calificaciones actualizadas\n❌ ${totalErrores} errores`);
              }
            }
          });
        } else if (gradeValue > 0 && !existingGradeId) {
          console.log(`⚠️ ${alumno.nombre} - Unidad ${unit.number}: No existe ID de calificación para actualizar`);
          errores++;
          totalErrores++;
        } else {
          console.log(`⏭️ ${alumno.nombre} - Unidad ${unit.number}: Saltando (valor 0 o sin ID)`);
        }
      });
    });
  }

  private mostrarResumenGuardado(nombreAlumno: string, guardados: number, errores: number): void {
    let mensaje = `Calificaciones de ${nombreAlumno}: `;
    
    if (guardados > 0) {
      mensaje += `${guardados} guardadas correctamente`;
    }
    
    if (errores > 0) {
      mensaje += guardados > 0 ? `, ${errores} con errores` : `${errores} con errores`;
    }
    
    if (guardados === 0 && errores === 0) {
      mensaje += 'No hay calificaciones para guardar';
    }
    
    alert(mensaje);
  }

  private mostrarResumenActualizado(nombreAlumno: string, actualizados: number, errores: number): void {
    let mensaje = `Calificaciones de ${nombreAlumno}: `;
    
    if (actualizados > 0) {
      mensaje += `${actualizados} actualizadas correctamente`;
    }
    
    if (errores > 0) {
      mensaje += actualizados > 0 ? `, ${errores} con errores` : `${errores} con errores`;
    }
    
    if (actualizados === 0 && errores === 0) {
      mensaje += 'No hay calificaciones para actualizar';
    }
    
    alert(mensaje);
  }

  private intentarActualizarCalificacion(studentId: number, subjectId: number, unitNumber: number, gradeValue: number, savedCount: number, errorCount: number): void {
    console.log('🔄 Intentando actualizar calificación existente...');
    
    // Primero, obtener las calificaciones existentes para encontrar el ID
    this.gradesService.getGradesByStudentAndSubject(studentId, subjectId).subscribe({
      next: (gradesResponse) => {
        const grades = (gradesResponse as any)?.data?.grades || (gradesResponse as any)?.grades || gradesResponse || [];
        const existingGrade = grades.find((g: any) => g.unit_number === unitNumber);
        
        if (existingGrade && existingGrade.id) {
          console.log('📝 Encontrada calificación existente, actualizando...');
          
          const updateData = {
            student_id: studentId,
            subject_id: subjectId,
            unit_number: unitNumber,
            grade: gradeValue
          };
          
          this.gradesService.updateGrade(existingGrade.id, updateData).subscribe({
            next: (response) => {
              console.log(`✅ Calificación actualizada para unidad ${unitNumber}:`, response);
              savedCount++;
              
              // Si es la última unidad, mostrar resumen
              if (savedCount + errorCount === this.subjectUnits.length) {
                this.mostrarResumenGuardado('el alumno', savedCount, errorCount);
              }
            },
            error: (updateError) => {
              console.error(`❌ Error al actualizar calificación para unidad ${unitNumber}:`, updateError);
              errorCount++;
              
              // Si es la última unidad, mostrar resumen
              if (savedCount + errorCount === this.subjectUnits.length) {
                this.mostrarResumenGuardado('el alumno', savedCount, errorCount);
              }
            }
          });
        } else {
          console.log('⚠️ No se encontró calificación existente para actualizar');
          errorCount++;
          
          // Si es la última unidad, mostrar resumen
          if (savedCount + errorCount === this.subjectUnits.length) {
            this.mostrarResumenGuardado('el alumno', savedCount, errorCount);
          }
        }
      },
      error: (error) => {
        console.error('❌ Error al obtener calificaciones existentes:', error);
        errorCount++;
        
        // Si es la última unidad, mostrar resumen
        if (savedCount + errorCount === this.subjectUnits.length) {
          this.mostrarResumenGuardado('el alumno', savedCount, errorCount);
        }
      }
    });
  }

  startAutoRefresh(): void {
    this.autoRefreshEnabled = true;
    this.autoRefreshSubscription = interval(30000) // 30 segundos
      .pipe(takeWhile(() => this.autoRefreshEnabled))
      .subscribe(() => {
        if (this.selectedGroup && this.selectedSubject) {
          this.cargarCalificacionesPorMateria();
        }
      });
  }

  stopAutoRefresh(): void {
    this.autoRefreshEnabled = false;
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }

  toggleAutoRefresh(): void {
    if (this.autoRefreshEnabled) {
      this.stopAutoRefresh();
    } else {
      this.startAutoRefresh();
    }
  }

  recargarDatos(): void {
    console.log('Recargando datos...', {
      selectedGroup: this.selectedGroup,
      selectedSubject: this.selectedSubject,
      currentTeacher: this.currentTeacher
    });
    
    if (this.selectedGroup && this.selectedSubject) {
      console.log('Cargando calificaciones por materia...');
      this.cargarCalificacionesPorMateria();
    } else {
      console.log('No se pueden recargar datos: faltan grupo o materia seleccionada');
      // Recargar datos del profesor si no hay selección
      this.cargarDatosDelProfesor();
    }
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
  }

  getNombreGrupo(alumno: any): string {
    const grupo = this.grupos.find(g => g.id == this.selectedGroup);
    return grupo?.name || this.selectedGroup || '';
  }
}