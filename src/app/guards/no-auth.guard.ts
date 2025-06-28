import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const noAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (token) {
    // Usando el Router de Angular en lugar de window.location
    return router.createUrlTree(['/usermanagement']);
    // Alternativa: return router.navigate(['/usermanagement']).then(() => false);
  }
  
  return true;
};