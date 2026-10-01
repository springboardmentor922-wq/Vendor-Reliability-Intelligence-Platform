import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenResponse, User } from './api.service';

const ACCESS_TOKEN_KEY = 'pf_access_token';
const REFRESH_TOKEN_KEY = 'pf_refresh_token';
const USER_KEY = 'pf_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authUrl = `${environment.apiUrl}/auth`;

  // Reactive state via Angular Signals
  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  readonly isAuthenticated = computed(() => !!this.currentUser() && !!this.accessToken());
  readonly isAdministrator = computed(() => this.hasRole('Administrator'));
  readonly isProcurementManager = computed(() => this.hasRole('Procurement Manager'));

  private loadStoredUser(): User | null {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  hasRole(roleName: string): boolean {
    const u = this.currentUser();
    return !!u && Array.isArray(u.roles) && u.roles.includes(roleName);
  }

  hasAnyRole(roles: string[]): boolean {
    const u = this.currentUser();
    if (!u || !Array.isArray(u.roles)) return false;
    return roles.some(r => u.roles.includes(r));
  }

  login(credentials: { email: string; password: string }): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.authUrl}/login`, credentials).pipe(
      tap(res => {
        this.setSession(res);
      })
    );
  }

  register(data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    role_names?: string[];
  }): Observable<User> {
    const payload = {
      ...data,
      role: data.role || (data.role_names && data.role_names.length > 0 ? data.role_names[0] : 'Procurement Manager'),
      role_names: data.role_names || (data.role ? [data.role] : ['Procurement Manager'])
    };
    return this.http.post<User>(`${this.authUrl}/register`, payload);
  }

  resetPassword(data: { email: string; new_password: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/reset-password`, data);
  }

  fetchProfile(): Observable<User> {
    return this.http.get<User>(`${this.authUrl}/me`).pipe(
      tap(user => {
        this.currentUser.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }),
      catchError(err => {
        if (err.status === 401) {
          this.logout();
        }
        return throwError(() => err);
      })
    );
  }

  refreshToken(): Observable<TokenResponse> {
    const rToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!rToken) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }
    return this.http.post<TokenResponse>(`${this.authUrl}/refresh-token`, { refresh_token: rToken }).pipe(
      tap(res => {
        this.setSession(res);
      }),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    const token = this.accessToken();
    const rToken = localStorage.getItem(REFRESH_TOKEN_KEY) || '';
    if (token || rToken) {
      this.http.post(`${this.authUrl}/logout`, { refresh_token: rToken }).pipe(catchError(() => of(null))).subscribe();
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.accessToken.set(null);
    this.router.navigate(['/login']);
  }

  private setSession(res: TokenResponse): void {
    if (res.access_token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, res.access_token);
      this.accessToken.set(res.access_token);
    }
    if (res.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, res.refresh_token);
    }
    if (res.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      this.currentUser.set(res.user);
    }
  }
}
