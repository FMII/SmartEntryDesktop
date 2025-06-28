import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap, catchError } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/login';

  constructor(private http: HttpClient) { }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(this.apiUrl, { email, password }).pipe(
      tap((res) => {
        if (res.status === 'success') {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('email', res.data.email);
          localStorage.setItem('userId', res.data.id);
        } else if (res.status === 'error') {
          throw new Error(res.msg?.[0] || 'Ocurrió un error en el login');
        }
      }),
      catchError((error: HttpErrorResponse) => {
        let errorMsg = 'Error desconocido';

        if (error.error && error.error.msg) {
          // Si el backend devuelve mensajes de error en un array o string
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
