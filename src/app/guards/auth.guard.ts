import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  console.log('AuthGuard ejecutado para ruta:', state.url);
  console.log('Token disponible:', !!token);
  console.log('Token completo:', token);

  if (token) {
    console.log('AuthGuard - Acceso permitido');
    return true; // Permite acceso a la ruta protegida
  }
  
  console.log('AuthGuard - No hay token, redirigiendo a login');
  // Redirige al login usando el Router de Angular
  return router.createUrlTree(['/login']);
};