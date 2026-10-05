import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);

  currentUser = signal<UserProfile | null>({
    id: 1,
    name: 'Admin User',
    email: 'admin@vendorintel.com',
    role: 'Procurement Manager'
  });

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  login(email: string, password?: string): void {
    this.currentUser.set({
      id: 1,
      name: 'Admin User',
      email: email,
      role: 'Procurement Manager'
    });
    this.router.navigate(['/dashboard']);
  }

  signup(name: string, email: string, ...args: any[]): void {
    this.currentUser.set({
      id: Date.now(),
      name: name,
      email: email,
      role: 'User'
    });
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}