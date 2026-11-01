import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, DEMO_ACCOUNTS, User } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-role-switcher',
  standalone: true,
  template: '',
  styles: ['']
})
export class RoleSwitcher {
  demoAccounts = DEMO_ACCOUNTS;
  currentUser$: Observable<User | null>;
  isExpanded = false;
  isSwitching = false;

  constructor(
    public authService: AuthService,
    private router: Router
  ) {
    this.currentUser$ = this.authService.currentUser$;
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  switchRole(roleName: string): void {
    this.isSwitching = true;
    this.authService.demoLogin(roleName).subscribe({
      next: (res) => {
        this.isSwitching = false;
        const targetRoute = this.authService.getDashboardRoute(res.user.role);
        if (this.router.url === targetRoute) {
          this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
            this.router.navigate([targetRoute]);
          });
        } else {
          this.router.navigate([targetRoute]);
        }
      },
      error: (err) => {
        this.isSwitching = false;
        console.error('Role switch failed:', err);
      }
    });
  }

  isActive(user: User | null, accountRole: string): boolean {
    if (!user) return false;
    if (accountRole === 'Administrator' && user.role === 'Administrator') return true;
    if (accountRole === 'Requesting User' && (user.role === 'Requesting User' || user.role === 'Department User')) return true;
    return user.role === accountRole;
  }

  getRoleColor(role: string): string {
    switch (role) {
      case 'Administrator': return 'btn-role-admin';
      case 'Requesting User': return 'btn-role-requester';
      case 'Procurement Manager': return 'btn-role-procure';
      case 'Finance Officer': return 'btn-role-finance';
      case 'Supply Chain Manager': return 'btn-role-scm';
      case 'Vendor': return 'btn-role-vendor';
      case 'Auditor': return 'btn-role-auditor';
      default: return 'btn-outline-secondary';
    }
  }
}
