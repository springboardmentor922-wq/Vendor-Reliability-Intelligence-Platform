import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface ForgotPasswordResponse {
  message: string;
  reset_token?: string | null;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api';

  currentUser = signal<User | null>(null);

  constructor(private http: HttpClient) {}

  register(
    data: RegisterRequest
  ): Observable<User> {
    return this.http.post<User>(
      `${this.apiUrl}/auth/register`,
      data
    );
  }

  login(
    data: LoginRequest
  ): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(
      `${this.apiUrl}/auth/login`,
      data
    ).pipe(
      tap(response => {
        localStorage.setItem(
          'access_token',
          response.access_token
        );
      })
    );
  }

  forgotPassword(
    email: string
  ): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(
      `${this.apiUrl}/auth/forgot-password`,
      { email }
    );
  }

  resetPassword(
    data: ResetPasswordRequest
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/auth/reset-password`,
      data
    );
  }

  loadCurrentUser(): Observable<User> {
    return this.http.get<User>(
      `${this.apiUrl}/users/me`
    ).pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  getToken(): string | null {
    return localStorage.getItem(
      'access_token'
    );
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(
      'access_token'
    );

    this.currentUser.set(null);
  }
}