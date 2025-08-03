import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const noAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (token) {
    // Redirigir al dashboard si ya está autenticado
    return router.createUrlTree(['/dashboard']);
  }
  
  return true;
};