import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { throwError, Observable, of } from 'rxjs';
import { tap, catchError, mergeMap } from 'rxjs/operators';

@Component({
  selector: 'app-2fa',
  standalone: true,
  templateUrl: './2fa.component.html',
  styleUrl: './2fa.component.css',
  imports: [ReactiveFormsModule, NgIf],
})
export class TwoFactorComponent {
  codeForm: FormGroup;
  errorMessage = '';
  successMessage = '';
  email = '';
  isLoading = false;
  resendLoading = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {
    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });
    // Obtener el email de la navegación (state) o localStorage
    const nav = this.router.getCurrentNavigation();
    this.email = nav?.extras?.state?.['email'] || localStorage.getItem('pending2faEmail') || '';
    if (this.email) {
      localStorage.setItem('pending2faEmail', this.email);
    }
  }

  onSubmit() {
    if (this.codeForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const code = this.codeForm.value.code;
    this.http.post<any>('http://localhost:3000/api/academic/users/verify', { email: this.email, code }).subscribe({
      next: (res) => {
        if (res.status === 'success') {
          // Guardar todos los datos del usuario
          if (res.data?.token) {
            localStorage.setItem('token', res.data.token);
          }
          if (res.data?.id) {
            localStorage.setItem('userId', res.data.id);
          }
          if (res.data?.email) {
            localStorage.setItem('email', res.data.email);
          }
          localStorage.removeItem('pending2faEmail');
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = res.msg || 'Código incorrecto';
        }
        this.isLoading = false;
      },
      error: (err) => {
        if (err.is2FA && err.email) {
          this.router.navigate(['/2fa'], { state: { email: err.email } });
        } else {
          this.errorMessage = err.message || 'Error en login';
        }
        this.isLoading = false;
      }
    });
  }

  resendCode() {
    this.resendLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.http.post<any>('http://localhost:3000/api/academic/resend', { email: this.email }).subscribe({
      next: (res) => {
        if (res.status === 'success') {
          this.successMessage = res.msg || 'Código reenviado';
        } else {
          this.errorMessage = res.msg || 'No se pudo reenviar el código';
        }
        this.resendLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.msg || 'Error al reenviar el código';
        this.resendLoading = false;
      }
    });
  }
} 