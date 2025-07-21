import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HorarioDocentesComponent } from './horario-docentes.component';

describe('HorarioDocentesComponent', () => {
  let component: HorarioDocentesComponent;
  let fixture: ComponentFixture<HorarioDocentesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HorarioDocentesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HorarioDocentesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
