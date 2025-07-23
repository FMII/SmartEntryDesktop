import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap, catchError, mergeMap } from 'rxjs/operators';
import { throwError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/login';

  constructor(private http: HttpClient) { }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(this.apiUrl, { email, password, client: "desktop" }).pipe(
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
}
