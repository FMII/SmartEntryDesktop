import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GradesService } from '../../services/grades.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin, interval, Subscription, Observable, of } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-grades',
  standalone: true,
  templateUrl: './grades.component.html',
  styleUrls: ['./grades.component.css'],
  imports: [CommonModule, FormsModule]
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
  
  // Propiedades para el formulario de calificaciones
  mostrarFormulario: boolean = false;
  formulario = {
    student_id: '',
    unit_number: 1,
    grade: 0
  };

  constructor(
    private gradesService: GradesService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentTeacher = this.authService.getCurrentUser();
    
    // Verificar autenticación
    if (!this.currentTeacher || !localStorage.getItem('token')) {
      
      // En lugar de mostrar alerta, vamos a intentar cargar datos de todos modos
    } else {
    }
    
    this.cargarDatosDelProfesor();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  cargarDatosDelProfesor(): void {
    
    if (!this.currentTeacher?.id) {
      console.error('No hay profesor autenticado');
      return;
    }
    
    // Cargar SOLO las asignaciones del profesor (sus grupos)
    this.gradesService.getTeacherAssignments(this.currentTeacher.id).subscribe({
      next: (assignments) => {
        
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
        
        // Si solo hay un grupo, seleccionarlo automáticamente
        if (this.grupos.length === 1) {
          this.selectedGroup = this.grupos[0].id;
          this.onGroupChange();
        }
        
        // Si no hay grupos, mostrar mensaje
        if (this.grupos.length === 0) {
        }
      },
      error: (error) => {
        console.error('Error al cargar asignaciones del profesor:', error);
        console.log('No se pudieron cargar los grupos del profesor');
        this.grupos = [];
      }
    });
  }

  onGroupChange(): void {
    if (!this.selectedGroup || !this.currentTeacher?.id) return;
    
    
    const selectedGroupData = this.grupos.find(g => g.id == this.selectedGroup);
    
    if (selectedGroupData) {
      this.materias = selectedGroupData.subjects || [];
      
      // Determinar si mostrar el dropdown de materias
      this.showSubjectDropdown = this.materias && this.materias.length > 1;
      
      if (this.showSubjectDropdown) {
        // Si hay múltiples materias, resetear la selección
        this.selectedSubject = '';
      } else if (this.materias && this.materias.length === 1) {
        // Si solo hay una materia, seleccionarla automáticamente
        this.selectedSubject = this.materias[0].id;
        // Cargar datos automáticamente después de un pequeño delay
        setTimeout(() => {
          this.onSubjectChange();
        }, 100);
      }
    } else {
      console.log('No se encontró el grupo seleccionado');
      this.materias = [];
      this.showSubjectDropdown = false;
      this.selectedSubject = '';
    }
    
    this.cargarAlumnosDelGrupo();
  }

  onSubjectChange(): void {
    if (!this.selectedSubject) return;
    
    
    // Forzar la recarga de datos para esta materia
    this.cargarDatosParaMateria(this.selectedSubject);
  }



  cargarDatosParaMateria(subjectId: any): void {
    
    // Cargar configuración de unidades para la materia seleccionada
    this.gradesService.getSubjectUnits(Number(subjectId)).subscribe({
      next: (config) => {
        
        this.selectedSubjectConfig = config;
        // Siempre iniciar con solo una unidad
        this.subjectUnits = [
          { number: 1, name: 'Unidad' }
        ];
        
        // Reinicializar las unidades dinámicas para todos los alumnos
        this.alumnos.forEach(alumno => {
          this.subjectUnits.forEach(unit => {
            (alumno as any)[`u${unit.number}`] = 0;
          });
        });
        
        this.cargarCalificacionesPorMateria();
      },
      error: (error) => {
        console.error('Error al cargar configuración de materia:', error);
        console.log('Iniciando con unidad básica...');
        // Siempre iniciar con solo una unidad
        this.subjectUnits = [
          { number: 1, name: 'Unidad' }
        ];
        this.cargarCalificacionesPorMateria();
      }
    });
  }

  cargarAlumnosDelGrupo(): void {
    if (!this.selectedGroup) return;
    
    
    // Intentar obtener estudiantes reales de la API
    this.gradesService.getStudentsByGroup(this.selectedGroup).subscribe({
      next: (students) => {
        
        this.procesarAlumnos(students);
      },
      error: (error) => {
        console.log('Error con endpoint específico, intentando con endpoint general...');
        this.gradesService.getAllStudents().subscribe({
          next: (allStudents) => {
            
            const groupStudents = allStudents.filter((student: any) => 
              student.group_id == this.selectedGroup || student.groups?.id == this.selectedGroup
            );
            
            this.procesarAlumnos(groupStudents);
          },
          error: (error2) => {
            console.error('Error al cargar alumnos:', error2);
            console.log('No se pudieron cargar estudiantes de la API');
            this.alumnos = [];
            this.filtrarAlumnos();
          }
        });
      }
    });
  }

  private procesarAlumnos(students: any[]): void {
    
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
      
      return alumno;
    });
    
    this.filtrarAlumnos();
  }

  cargarCalificacionesPorMateria(): void {
    if (!this.selectedSubject || this.alumnos.length === 0) return;
    
    
    // Intentar cargar calificaciones reales de la API
    const requests = this.alumnos.map((alumno: any) =>
      this.gradesService.getGradesByStudentAndSubject(alumno.id, this.selectedSubject)
    );
    
    forkJoin(requests).subscribe({
      next: (gradesArr) => {
        
        const unidadesExistentes = new Set<number>();
        
        // Procesar calificaciones y recopilar unidades existentes
        this.alumnos = this.alumnos.map((alumno: any, idx: number) => {
          const gradesResponse = gradesArr[idx] as any;
          const grades = gradesResponse?.data?.grades || gradesResponse?.grades || gradesResponse || [];
          
          
          const updatedAlumno = {
            ...alumno,
            materia: this.materias.find(m => m.id == this.selectedSubject)?.name || '',
            gradeId: null
          };
          
          // Procesar cada calificación y recopilar unidades
          grades.forEach((grade: any) => {
            if (grade.unit_number) {
              unidadesExistentes.add(grade.unit_number);
              updatedAlumno[`u${grade.unit_number}`] = grade.grade || 0;
              updatedAlumno[`gradeId${grade.unit_number}`] = grade.id;
            }
          });
          
          return updatedAlumno;
        });
        
        // Actualizar unidades dinámicamente
        if (unidadesExistentes.size > 0) {
          const unidadesArray = Array.from(unidadesExistentes).sort((a, b) => a - b);
          this.subjectUnits = unidadesArray.map(unitNumber => ({
            number: unitNumber,
            name: 'Unidad'
          }));
        } else {
          // Si no hay unidades, mantener al menos una
          this.subjectUnits = [{ number: 1, name: 'Unidad' }];
        }
        
        // Inicializar campos faltantes para todas las unidades
        this.alumnos = this.alumnos.map((alumno: any) => {
          this.subjectUnits.forEach(unit => {
            if (alumno[`u${unit.number}`] === undefined) {
              alumno[`u${unit.number}`] = 0;
            }
            if (alumno[`gradeId${unit.number}`] === undefined) {
              alumno[`gradeId${unit.number}`] = null;
            }
          });
          return alumno;
        });
        
        console.log('Unidades dinámicas:', this.subjectUnits);
        this.filtrarAlumnos();
      },
      error: (error) => {
        console.error('Error al cargar calificaciones:', error);
        console.log('No se pudieron cargar calificaciones de la API, inicializando en 0...');
        
        // En caso de error, mantener una unidad básica
        this.subjectUnits = [{ number: 1, name: 'Unidad' }];
        
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
          });
          
          return updatedAlumno;
        });
        
        this.filtrarAlumnos();
      }
    });
  }

  filtrarAlumnos(): void {
    
    this.alumnosFiltrados = this.alumnos.filter(alumno => {
      const nombreCompleto = `${alumno.nombre || ''}`.toLowerCase();
      const query = this.searchQuery.toLowerCase();
      
      const matchesSearch = !this.searchQuery || nombreCompleto.includes(query);
      
      return matchesSearch;
    });
    
  }

  calcularPromedio(alumno: any): number {
    if (this.subjectUnits.length === 0) return 0;
    
    const sum = this.subjectUnits.reduce((total, unit) => {
      return total + (alumno[`u${unit.number}`] || 0);
    }, 0);
    
    const promedio = sum / this.subjectUnits.length;
    return Math.round(promedio * 100) / 100; // Redondea a 2 decimales
  }

  // Método para guardar una calificación específica
  guardarCalificacionEspecifica(alumno: any, unitNumber: number): void {
    if (!this.selectedSubject) {
      alert('Por favor selecciona una materia');
      return;
    }

    const gradeValue = alumno[`u${unitNumber}`];
    const gradeId = alumno[`gradeId${unitNumber}`];
    
    if (gradeValue === undefined || gradeValue === null || gradeValue === '') {
      alert('Por favor ingresa una calificación válida');
      return;
    }

    // Validar que la calificación esté en el rango correcto (0-10)
    const gradeNumber = parseFloat(gradeValue);
    if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 10) {
      console.error(`Calificación inválida para ${alumno.nombre} - Unidad ${unitNumber}: ${gradeValue}`);
      alert(`Error: La calificación debe estar entre 0 y 10. Valor actual: ${gradeValue}`);
      return;
    }

    const data = {
      student_id: parseInt(alumno.id),
      subject_id: parseInt(this.selectedSubject),
      unit_number: unitNumber,
      grade: gradeNumber
    };

    console.log('Enviando datos para unidad específica:', data);

    // Si ya existe un gradeId, actualizar. Si no, crear nuevo
    if (gradeId) {
      console.log('Actualizando calificación existente con ID:', gradeId);
      this.gradesService.updateGrade(parseInt(gradeId), data).subscribe({
        next: (response) => {
          console.log('Calificación actualizada:', response);
          alert(`Calificación actualizada para ${alumno.nombre} - Unidad ${unitNumber}`);
        },
        error: (error) => {
          console.error('Error al actualizar:', error);
          alert(`Error al actualizar calificación: ${error.message}`);
        }
      });
    } else {
      console.log('Creando nueva calificación');
      this.gradesService.createGrade(data).subscribe({
        next: (response) => {
          console.log('Calificación guardada:', response);
          alert(`Calificación guardada para ${alumno.nombre} - Unidad ${unitNumber}`);
          // Actualizar el gradeId en el objeto alumno
          if (response && response.id) {
            alumno[`gradeId${unitNumber}`] = response.id;
          }
        },
        error: (error) => {
          console.error('Error al guardar:', error);
          alert(`Error al guardar calificación: ${error.message}`);
        }
      });
    }
  }

  guardarCalificaciones(alumno: any): void {
    if (!this.selectedSubject) {
      alert('Por favor selecciona una materia');
      return;
    }

    console.log('Guardando todas las calificaciones para:', alumno.nombre);
    console.log('Materia seleccionada:', this.selectedSubject);

    let calificacionesGuardadas = 0;
    let totalCalificaciones = 0;

    // Contar calificaciones válidas para mostrar un solo mensaje
    this.subjectUnits.forEach(unit => {
      const gradeValue = alumno[`u${unit.number}`];
      if (gradeValue !== undefined && gradeValue !== null && gradeValue !== '') {
        totalCalificaciones++;
      }
    });

    if (totalCalificaciones === 0) {
      alert('No hay calificaciones para guardar');
      return;
    }

    this.subjectUnits.forEach(unit => {
      const gradeValue = alumno[`u${unit.number}`];
      const gradeId = alumno[`gradeId${unit.number}`];
      
      if (gradeValue !== undefined && gradeValue !== null && gradeValue !== '') {
        // Validar que la calificación esté en el rango correcto (0-10)
        const gradeNumber = parseFloat(gradeValue);
        if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 10) {
          console.error(`Calificación inválida para ${alumno.nombre} - Unidad ${unit.number}: ${gradeValue}`);
          alert(`Error: La calificación debe estar entre 0 y 10. Valor actual: ${gradeValue}`);
          return;
        }
        
        const data = {
          student_id: parseInt(alumno.id),
          subject_id: parseInt(this.selectedSubject),
          unit_number: parseInt(unit.number),
          grade: gradeNumber
        };

        // Si ya existe un gradeId, actualizar. Si no, crear nuevo
        if (gradeId) {
          this.gradesService.updateGrade(parseInt(gradeId), data).subscribe({
            next: (response) => {
              console.log('Calificación actualizada:', response);
              calificacionesGuardadas++;
              if (calificacionesGuardadas === totalCalificaciones) {
                alert(`Todas las calificaciones han sido guardadas para ${alumno.nombre}`);
              }
            },
            error: (error) => {
              console.error('Error al actualizar:', error);
              alert(`Error al actualizar calificación unidad ${unit.number}: ${error.message}`);
            }
          });
        } else {
          this.gradesService.createGrade(data).subscribe({
            next: (response) => {
              console.log('Calificación guardada:', response);
              if (response && response.id) {
                alumno[`gradeId${unit.number}`] = response.id;
              }
              calificacionesGuardadas++;
              if (calificacionesGuardadas === totalCalificaciones) {
                alert(`Todas las calificaciones han sido guardadas para ${alumno.nombre}`);
              }
            },
            error: (error) => {
              console.error('Error al guardar:', error);
              alert(`Error al guardar calificación unidad ${unit.number}: ${error.message}`);
            }
          });
        }
      }
    });
  }

  actualizarCalificaciones(alumno: any): void {
    if (!this.selectedSubject) {
      alert('Por favor selecciona una materia');
      return;
    }

    console.log('Actualizando calificaciones para:', alumno.nombre);
    console.log('Materia seleccionada:', this.selectedSubject);

    this.subjectUnits.forEach(unit => {
      const gradeValue = alumno[`u${unit.number}`];
      const gradeId = alumno[`gradeId${unit.number}`];
      
      console.log(`Unidad ${unit.number}: ${gradeValue}, ID: ${gradeId}`);
      
      if (gradeValue !== undefined && gradeValue !== null && gradeValue !== '' && gradeId) {
        // Validar que la calificación esté en el rango correcto (0-10)
        const gradeNumber = parseFloat(gradeValue);
        if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 10) {
          console.error(` Calificación inválida para ${alumno.nombre} - Unidad ${unit.number}: ${gradeValue}`);
          alert(`Error: La calificación debe estar entre 0 y 10. Valor actual: ${gradeValue}`);
          return;
        }
        
        const data = {
          student_id: parseInt(alumno.id),
          subject_id: parseInt(this.selectedSubject),
          unit_number: parseInt(unit.number),
          grade: gradeNumber
        };

        console.log('Enviando datos para actualizar:', data);

        this.gradesService.updateGrade(parseInt(gradeId), data).subscribe({
          next: (response) => {
            console.log('Calificación actualizada:', response);
            alert(`Calificación actualizada para ${alumno.nombre} - Unidad ${unit.number}`);
          },
          error: (error) => {
            console.error('Error al actualizar:', error);
            alert(`Error al actualizar calificación: ${error.message}`);
          }
        });
      } else {
        console.log(`No hay calificación para actualizar en unidad ${unit.number}`);
      }
    });
  }

  // Guardar calificaciones de TODO el grupo
  guardarCalificacionesGrupo(): void {
    if (!this.selectedSubject || this.alumnos.length === 0) {
      console.log('No hay materia seleccionada o alumnos para guardar');
      return;
    }
    
    console.log('Guardando calificaciones de TODO el grupo');
    console.log('Materia:', this.selectedSubject);
    console.log('Alumnos a procesar:', this.alumnos.length);
    
    let totalGuardados = 0;
    let totalErrores = 0;
    let procesados = 0;
    
    this.alumnos.forEach((alumno, index) => {
      console.log(`Procesando alumno ${index + 1}/${this.alumnos.length}: ${alumno.nombre}`);
      
      let guardados = 0;
      let errores = 0;
      
      // Guardar calificaciones para cada unidad del alumno
      this.subjectUnits.forEach(unit => {
        const gradeValue = (alumno as any)[`u${unit.number}`];
        
        if (gradeValue !== null && gradeValue !== undefined && gradeValue !== '') {
          // Validar que la calificación esté en el rango correcto (0-10)
          const gradeNumber = parseFloat(gradeValue);
          if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 10) {
            console.error(`Calificación inválida para ${alumno.nombre} - Unidad ${unit.number}: ${gradeValue}`);
            alert(`Error: La calificación debe estar entre 0 y 10. Valor actual: ${gradeValue}`);
            return;
          }
          
          const gradeData = {
            student_id: alumno.id,
            subject_id: this.selectedSubject,
            unit_number: unit.number,
            grade: gradeNumber
          };
          
          this.gradesService.createGrade(gradeData).subscribe({
            next: (response) => {
              console.log(`${alumno.nombre} - Unidad ${unit.number} guardada`);
              guardados++;
              totalGuardados++;
            },
            error: (error) => {
              console.error(`${alumno.nombre} - Error unidad ${unit.number}:`, error);
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
                console.log(`Proceso completado: ${totalGuardados} guardados, ${totalErrores} errores`);
                alert(`Calificaciones del grupo guardadas:\n${totalGuardados} calificaciones guardadas\n${totalErrores} errores`);
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
      console.log('No hay materia seleccionada o alumnos para actualizar');
      return;
    }
    
    console.log('Actualizando calificaciones de TODO el grupo');
    console.log('Materia:', this.selectedSubject);
    console.log('Alumnos a procesar:', this.alumnos.length);
    
    let totalActualizados = 0;
    let totalErrores = 0;
    let procesados = 0;
    
    this.alumnos.forEach((alumno, index) => {
      console.log(`Procesando alumno ${index + 1}/${this.alumnos.length}: ${alumno.nombre}`);
      
      let actualizados = 0;
      let errores = 0;
      
      // Actualizar calificaciones para cada unidad del alumno
      this.subjectUnits.forEach(unit => {
        const gradeValue = (alumno as any)[`u${unit.number}`];
        const existingGradeId = (alumno as any)[`gradeId${unit.number}`];
        
        if (gradeValue !== null && gradeValue !== undefined && gradeValue !== '' && existingGradeId) {
          // Validar que la calificación esté en el rango correcto (0-10)
          const gradeNumber = parseFloat(gradeValue);
          if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 10) {
            console.error(`Calificación inválida para ${alumno.nombre} - Unidad ${unit.number}: ${gradeValue}`);
            alert(`Error: La calificación debe estar entre 0 y 10. Valor actual: ${gradeValue}`);
            return;
          }
          
          const gradeData = {
            student_id: alumno.id,
            subject_id: this.selectedSubject,
            unit_number: unit.number,
            grade: gradeNumber
          };
          
          console.log(`Actualizando ${alumno.nombre} - Unidad ${unit.number}: ${gradeValue} (ID: ${existingGradeId})`);
          
          this.gradesService.updateGrade(existingGradeId, gradeData).subscribe({
            next: (response) => {
              console.log(`${alumno.nombre} - Unidad ${unit.number} actualizada`);
              actualizados++;
              totalActualizados++;
            },
            error: (error) => {
              console.error(`${alumno.nombre} - Error actualizando unidad ${unit.number}:`, error);
              errores++;
              totalErrores++;
            },
            complete: () => {
              procesados++;
              if (procesados === this.alumnos.length) {
                console.log(`Proceso completado: ${totalActualizados} actualizados, ${totalErrores} errores`);
                alert(`Calificaciones del grupo actualizadas:\n${totalActualizados} calificaciones actualizadas\n${totalErrores} errores`);
              }
            }
          });
        } else if (gradeValue > 0 && !existingGradeId) {
          console.log(`${alumno.nombre} - Unidad ${unit.number}: No existe ID de calificación para actualizar`);
          errores++;
          totalErrores++;
        } else {
          console.log(`${alumno.nombre} - Unidad ${unit.number}: Saltando (valor 0 o sin ID)`);
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
    console.log('Intentando actualizar calificación existente...');
    
    // Validar que la calificación esté en el rango correcto (0-10)
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > 10) {
      console.error(`Calificación inválida para actualizar: ${gradeValue}`);
      alert(`Error: La calificación debe estar entre 0 y 10. Valor actual: ${gradeValue}`);
      errorCount++;
      return;
    }
    
    // Primero, obtener las calificaciones existentes para encontrar el ID
    this.gradesService.getGradesByStudentAndSubject(studentId, subjectId).subscribe({
      next: (gradesResponse) => {
        const grades = (gradesResponse as any)?.data?.grades || (gradesResponse as any)?.grades || gradesResponse || [];
        const existingGrade = grades.find((g: any) => g.unit_number === unitNumber);
        
        if (existingGrade && existingGrade.id) {
          console.log('Encontrada calificación existente, actualizando...');
          
          const updateData = {
            student_id: studentId,
            subject_id: subjectId,
            unit_number: unitNumber,
            grade: gradeValue
          };
          
          this.gradesService.updateGrade(existingGrade.id, updateData).subscribe({
            next: (response) => {
              console.log(`Calificación actualizada para unidad ${unitNumber}:`, response);
              savedCount++;
              
              // Si es la última unidad, mostrar resumen
              if (savedCount + errorCount === this.subjectUnits.length) {
                this.mostrarResumenGuardado('el alumno', savedCount, errorCount);
              }
            },
            error: (updateError) => {
              console.error(`Error al actualizar calificación para unidad ${unitNumber}:`, updateError);
              errorCount++;
              
              // Si es la última unidad, mostrar resumen
              if (savedCount + errorCount === this.subjectUnits.length) {
                this.mostrarResumenGuardado('el alumno', savedCount, errorCount);
              }
            }
          });
        } else {
          console.log('No se encontró calificación existente para actualizar');
          errorCount++;
          
          // Si es la última unidad, mostrar resumen
          if (savedCount + errorCount === this.subjectUnits.length) {
            this.mostrarResumenGuardado('el alumno', savedCount, errorCount);
          }
        }
      },
      error: (error) => {
        console.error('Error al obtener calificaciones existentes:', error);
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
    console.log('Recargando datos desde la API...');
    console.log('Estado actual:', {
      selectedGroup: this.selectedGroup,
      selectedSubject: this.selectedSubject,
      currentTeacher: this.currentTeacher
    });
    
    // Limpiar datos actuales
    this.alumnos = [];
    this.alumnosFiltrados = [];
    this.searchQuery = '';
    
    if (this.selectedGroup && this.selectedSubject) {
      console.log('Recargando datos para grupo y materia seleccionados...');
      // Recargar alumnos del grupo
      this.cargarAlumnosDelGrupo();
      // Recargar calificaciones
      setTimeout(() => {
        this.cargarCalificacionesPorMateria();
      }, 500);
    } else if (this.selectedGroup) {
      console.log('Recargando datos para grupo seleccionado...');
      this.cargarAlumnosDelGrupo();
    } else {
      console.log('Recargando todos los datos del profesor...');
      this.cargarDatosDelProfesor();
    }
    
    console.log('Recarga completada');
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
  }

  getNombreGrupo(alumno: any): string {
    const grupo = this.grupos.find(g => g.id == this.selectedGroup);
    return grupo?.name || this.selectedGroup || '';
  }

  getNumeroAlumnos(): number {
    return this.alumnos.length;
  }

  getNumeroAlumnosFiltrados(): number {
    return this.alumnosFiltrados.length;
  }

  // Obtener información detallada del grupo desde el API
  getGroupInfo(): void {
    if (!this.selectedGroup) return;
    
    this.gradesService.getStudentsByGroupDetailed(parseInt(this.selectedGroup)).subscribe({
      next: (data) => {
        console.log('Información del grupo:', data);
        console.log(`Total de estudiantes en el grupo: ${data.totalStudents}`);
        console.log(`Grupo: ${data.group.name}`);
      },
      error: (error) => {
        console.error('Error al obtener información del grupo:', error);
      }
    });
  }

  // Obtener solo el conteo de estudiantes
  getStudentCount(): Observable<number> {
    return of(this.alumnos.length);
  }

  // Método para trackBy en ngFor (optimización de rendimiento)
  trackByAlumno(index: number, alumno: any): number {
    return alumno.id;
  }

  // Método para manejar cambios en calificaciones
  onGradeChange(alumno: any, unitNumber: number): void {
    const gradeValue = alumno[`u${unitNumber}`];
    if (gradeValue !== undefined && gradeValue !== null && gradeValue !== '') {
      const gradeNumber = parseFloat(gradeValue);
      if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 10) {
        console.warn(`Calificación inválida para ${alumno.nombre} - Unidad ${unitNumber}: ${gradeValue}`);
        // Resetear a valor válido
        alumno[`u${unitNumber}`] = '';
      }
    }
  }

  // Método para verificar si se está guardando
  isSaving(studentId: number): boolean {
    // Implementación simple - puedes expandir esto según tus necesidades
    return false;
  }

  // Método para verificar si se está actualizando
  isUpdating(studentId: number): boolean {
    // Implementación simple - puedes expandir esto según tus necesidades
    return false;
  }

  // Métodos para el formulario de calificaciones
  abrirFormularioCalificacion(): void {
    this.mostrarFormulario = true;
    this.formulario = {
      student_id: '',
      unit_number: 1,
      grade: 0
    };
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.formulario = {
      student_id: '',
      unit_number: 1,
      grade: 0
    };
  }

  guardarNuevaCalificacion(): void {
    if (!this.selectedSubject) {
      alert('Por favor selecciona una materia');
      return;
    }

    if (!this.formulario.student_id || !this.formulario.unit_number || this.formulario.grade === null || this.formulario.grade === undefined) {
      alert('Por favor completa todos los campos');
      return;
    }

    // Validar que la calificación esté en el rango correcto (0-10)
    const gradeNumber = parseFloat(this.formulario.grade.toString());
    if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 10) {
      alert('Error: La calificación debe estar entre 0 y 10');
      return;
    }

    const data = {
      student_id: parseInt(this.formulario.student_id),
      subject_id: parseInt(this.selectedSubject),
      unit_number: parseInt(this.formulario.unit_number.toString()),
      grade: gradeNumber
    };

    console.log('Subiendo nueva calificación:', data);

    this.gradesService.createGrade(data).subscribe({
      next: (response) => {
        console.log('Calificación subida:', response);
        alert('Calificación subida correctamente');
        
        // Cerrar el formulario
        this.cerrarFormulario();
        
        // Recargar las calificaciones para mostrar los cambios
        this.actualizarUnidadesExistentes();
        this.cargarCalificacionesPorMateria();
      },
      error: (error) => {
        console.error('Error al subir calificación:', error);
        if (error.message && error.message.includes('Ya existe una calificación')) {
          alert('Ya existe una calificación para este estudiante en esta unidad. Usa el botón de actualizar en la tabla.');
        } else {
          alert(`Error al subir calificación: ${error.message || 'Error desconocido'}`);
        }
      }
    });
  }

  // Método para actualizar las unidades dinámicamente
  actualizarUnidadesExistentes(): void {
    if (!this.selectedSubject || this.alumnos.length === 0) return;

    // Obtener todas las unidades existentes en las calificaciones
    const requests = this.alumnos.map((alumno: any) =>
      this.gradesService.getGradesByStudentAndSubject(alumno.id, this.selectedSubject)
    );

    forkJoin(requests).subscribe({
      next: (gradesArr) => {
        const unidadesExistentes = new Set<number>();

        // Recopilar todas las unidades que existen
        gradesArr.forEach((gradesResponse: any) => {
          const grades = gradesResponse?.data?.grades || gradesResponse?.grades || gradesResponse || [];
          grades.forEach((grade: any) => {
            if (grade.unit_number) {
              unidadesExistentes.add(grade.unit_number);
            }
          });
        });

        // Crear el array de unidades dinámicamente
        if (unidadesExistentes.size > 0) {
          const unidadesArray = Array.from(unidadesExistentes).sort((a, b) => a - b);
          this.subjectUnits = unidadesArray.map(unitNumber => ({
            number: unitNumber,
            name: 'Unidad'
          }));
        } else {
          // Si no hay unidades, mantener al menos una
          this.subjectUnits = [{ number: 1, name: 'Unidad' }];
        }

        console.log('Unidades actualizadas:', this.subjectUnits);
      },
      error: (error) => {
        console.error('Error al actualizar unidades:', error);
      }
    });
  }
}