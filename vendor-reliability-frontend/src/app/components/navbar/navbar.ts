import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf, NgFor, NgClass, AsyncPipe } from '@angular/common';
import { AuthService, DEMO_ACCOUNTS, User } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, NgIf, NgFor, NgClass, AsyncPipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar implements OnInit, OnDestroy {
  currentUser$: Observable<User | null>;
  unreadCount$: Observable<number>;
  userMenuOpen = false;
  roleMenuOpen = false;
  isSwitchingRole = false;
  demoAccounts = DEMO_ACCOUNTS;

  private userSub?: Subscription;

  constructor(
    public authService: AuthService,
    private notifService: NotificationService,
    private router: Router
  ) {
    this.currentUser$ = this.authService.currentUser$;
    this.unreadCount$ = this.notifService.unreadCount$;
  }

  ngOnInit(): void {
    this.userSub = this.currentUser$.subscribe(user => {
      if (user) {
        this.notifService.getNotifications().subscribe();
      }
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
    if (this.userMenuOpen) this.roleMenuOpen = false;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  toggleRoleMenu(): void {
    this.roleMenuOpen = !this.roleMenuOpen;
    if (this.roleMenuOpen) this.userMenuOpen = false;
  }

  closeRoleMenu(): void {
    this.roleMenuOpen = false;
  }

  quickSwitchRole(roleName: string): void {
    this.isSwitchingRole = true;
    this.roleMenuOpen = false;
    this.authService.demoLogin(roleName).subscribe({
      next: (res) => {
        this.isSwitchingRole = false;
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
        this.isSwitchingRole = false;
        console.error('Role switch failed:', err);
      }
    });
  }

  getDashboardLink(role?: string): string {
    return this.authService.getDashboardRoute(role);
  }

  canAccess(allowedRoles: string[]): boolean {
    const user = this.authService.currentUserValue;
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getRoleBadgeClass(role?: string): string {
    switch (role) {
      case 'Administrator': return 'role-admin';
      case 'Procurement Manager': return 'role-procurement';
      case 'Supply Chain Manager': return 'role-supply';
      case 'Vendor': return 'role-vendor';
      case 'Finance Officer': return 'role-finance';
      case 'Auditor': return 'role-auditor';
      default: return 'badge-role';
    }
  }
}
