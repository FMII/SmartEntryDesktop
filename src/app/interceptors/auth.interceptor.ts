import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpEvent
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError, Observable } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const router = inject(Router);
  
  // Clonar la solicitud con el token si existe
  const token = localStorage.getItem('token');
  const authReq = token ? req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        localStorage.removeItem('token');
        // Usar createUrlTree para mejor manejo de rutas
        router.navigateByUrl('/login').then(() => {
          window.location.reload(); // Necesario en Electron para limpiar estados
        });
      }
      return throwError(() => error);
    })
  );
};