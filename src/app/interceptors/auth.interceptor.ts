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
  console.log('🔍 Interceptor - URL:', req.url);
  console.log('🔍 Interceptor - Token disponible:', !!token);
  console.log('🔍 Interceptor - Token completo:', token);
  
  const authReq = token ? req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`, 
      'Content-Type': 'application/json'
    }
  }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.log('❌ Interceptor - Error capturado:', {
        status: error.status,
        url: req.url,
        message: error.message
      });
      
      // Solo cerrar sesión automáticamente para errores de autenticación críticos
      if (error.status === 401) {
        console.log('🚪 Interceptor - Error 401 detectado, cerrando sesión automáticamente');
        localStorage.removeItem('token');
        router.navigateByUrl('/login').then(() => {
          window.location.reload();
        });
      } else if (error.status === 403) {
        console.log('⚠️ Interceptor - Error 403 detectado, pero NO cerrando sesión (permisos insuficientes)');
        console.log('🔍 URL que causó el error:', req.url);
      }
      return throwError(() => error);
    })
  );
};