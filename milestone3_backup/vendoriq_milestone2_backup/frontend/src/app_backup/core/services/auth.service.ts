import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserRole } from '../models/models';

interface TokenResponse {
  access_token: string;
  token_type: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'vendoriq_token';
  private readonly userKey = 'vendoriq_user';

  currentUser = signal<User | null>(this.readUser());
  isAuthenticated = computed(() => !!this.currentUser());

  constructor(private http: HttpClient) {}

  private readUser(): User | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? (JSON.parse(raw) as User) : null;
  }

  register(payload: {
    full_name: string;
    email: string;
    password: string;
    phone?: string;
    department?: string;
    role: UserRole;
  }): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, payload);
  }

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${environment.apiUrl}/auth/login-json`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.tokenKey, res.access_token);
        }),
        tap(() => this.fetchMe().subscribe())
      );
  }

  fetchMe(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.currentUser.set(user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const user = this.currentUser();
    return !!user && roles.includes(user.role);
  }
}
