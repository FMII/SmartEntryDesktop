import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap, catchError, mergeMap } from 'rxjs/operators';
import { throwError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // private apiUrl = 'https://api.smartentry.space/api/academic'; // Base URL
  // private baseUrl = 'https://api.smartentry.space/api/academic'; // Production URL
  private API_URL = 'https://api.smartentry.space/api/academic';

  constructor(private http: HttpClient) { }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/login`, { email, password, client: "desktop" }).pipe(
      mergeMap((res) => {
        if (res.status === 'success') {
          if (res.data.token) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('email', res.data.email);
            localStorage.setItem('userId', res.data.id);
            return of(res); // éxito normal
          } else {
            // Flujo 2FA: guardar email pendiente y lanzar error observable
            localStorage.setItem('pending2faEmail', res.data.email);
            return throwError(() => ({ is2FA: true, email: res.data.email }));
          }
        } else if (res.status === 'error') {
          return throwError(() => new Error(res.msg?.[0] || 'Ocurrió un error en el login'));
        }
        return throwError(() => new Error('Respuesta inesperada del servidor'));
      }),
      catchError((error: any) => {
        // Si el error es de 2FA, pásalo tal cual
        if (error && error.is2FA) {
          return throwError(() => error);
        }
        let errorMsg = 'Error desconocido';
        if (error.error && error.error.msg) {
          errorMsg = Array.isArray(error.error.msg) ? error.error.msg.join(', ') : error.error.msg;
        } else if (error.status === 401) {
          errorMsg = 'No autorizado: credenciales incorrectas';
        } else if (error.message) {
          errorMsg = error.message;
        }
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.clear();
  }

  getCurrentUser(): any {
    const userId = localStorage.getItem('userId');
    const email = localStorage.getItem('email');
    
    console.log('AuthService.getCurrentUser() - userId:', userId);
    console.log('AuthService.getCurrentUser() - email:', email);
    
    if (userId && email) {
      const user = {
        id: userId,
        email: email
      };
      console.log('AuthService.getCurrentUser() - usuario encontrado:', user);
      return user;
    }
    
    console.log('AuthService.getCurrentUser() - no hay usuario autenticado');
    return null;
  }

  // Método para solicitar recuperación de contraseña
  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/forgot-password`, { email }).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMsg = 'Error al enviar correo de recuperación';
        if (error.error && error.error.msg) {
          errorMsg = error.error.msg;
        }
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  // Método para resetear la contraseña
  resetPassword(email: string, token: string, newPassword: string): Observable<any> {
      return this.http.post<any>(`${this.API_URL}/reset-password`, { 
      email, 
      token, 
      newPassword 
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMsg = 'Error al resetear la contraseña';
        if (error.error && error.error.msg) {
          errorMsg = error.error.msg;
        }
        return throwError(() => new Error(errorMsg));
      })
    );
  }
}
