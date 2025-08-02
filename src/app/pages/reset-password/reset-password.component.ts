import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  errorMessage = '';
  successMessage = '';
  isLoading = false;
  token = '';
  email = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Obtener token y email de los query parameters
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      this.email = params['email'] || '';
      
      if (!this.token || !this.email) {
        this.errorMessage = 'Token o email inválido';
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit() {
    if (this.resetPasswordForm.invalid || !this.token || !this.email) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { newPassword } = this.resetPasswordForm.value;

    this.authService.resetPassword(this.email, this.token, newPassword!).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.successMessage = 'Contraseña actualizada correctamente';
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Error al actualizar la contraseña';
      }
    });
  }

  goBackToLogin() {
    this.router.navigate(['/login']);
  }
}
