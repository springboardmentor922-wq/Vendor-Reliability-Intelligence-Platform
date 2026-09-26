import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiMessage, TokenResponse, User, UserRole } from './models';

const ACCESS_KEY = 'vendoriq.access_token';
const REFRESH_KEY = 'vendoriq.refresh_token';
const USER_KEY = 'vendoriq.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/auth`;

  private readonly currentUser = signal<User | null>(this.restoreUser());

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly role = computed(() => this.currentUser()?.role ?? null);

  /** Roles that may change data rather than only read it. */
  readonly canEdit = computed(() =>
    this.hasRole(
      'Administrator',
      'Procurement Manager',
      'Supply Chain Manager',
    ),
  );

  readonly canApprove = computed(() =>
    this.hasRole('Administrator', 'Procurement Manager'),
  );

  readonly canManageFinance = computed(() =>
    this.hasRole('Administrator', 'Finance Officer'),
  );

  readonly isAdmin = computed(() => this.hasRole('Administrator'));
  readonly isVendor = computed(() => this.hasRole('Vendor'));

  hasRole(...roles: UserRole[]): boolean {
    const role = this.currentUser()?.role;
    return role !== undefined && roles.includes(role);
  }

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.base}/login`, { email, password })
      .pipe(tap((response) => this.storeSession(response)));
  }

  register(payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    department?: string;
    job_title?: string;
    vendor_id?: number | null;
  }): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.base}/register`, payload)
      .pipe(tap((response) => this.storeSession(response)));
  }

  forgotPassword(
    email: string,
  ): Observable<{ message: string; reset_token?: string }> {
    return this.http.post<{ message: string; reset_token?: string }>(
      `${this.base}/forgot-password`,
      { email },
    );
  }

  resetPassword(token: string, newPassword: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/reset-password`, {
      token,
      new_password: newPassword,
    });
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/change-password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  updateProfile(payload: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.base}/me`, payload).pipe(
      tap((user) => {
        this.currentUser.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }),
    );
  }

  refreshProfile(): Observable<User> {
    return this.http.get<User>(`${this.base}/me`).pipe(
      tap((user) => {
        this.currentUser.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }),
    );
  }

  logout(redirect = true): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);

    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  private storeSession(response: TokenResponse): void {
    localStorage.setItem(ACCESS_KEY, response.access_token);
    localStorage.setItem(REFRESH_KEY, response.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUser.set(response.user);
  }

  private restoreUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);

    if (!raw || !localStorage.getItem(ACCESS_KEY)) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
