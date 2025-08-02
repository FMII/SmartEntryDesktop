import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  forgotPasswordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  errorMessage = '';
  successMessage = '';
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    if (this.forgotPasswordForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { email } = this.forgotPasswordForm.value;

    this.authService.forgotPassword(email!).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = 'Se ha enviado un correo de recuperación a tu email';
        this.forgotPasswordForm.reset();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Error al enviar el correo de recuperación';
      }
    });
  }

  goBackToLogin() {
    this.router.navigate(['/login']);
  }
}
