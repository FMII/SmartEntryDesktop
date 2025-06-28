import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (token) {
    return true; // Permite acceso a la ruta protegida
  }
  
  // Redirige al login usando el Router de Angular
  return router.createUrlTree(['/login']);
};