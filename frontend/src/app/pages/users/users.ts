import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class Users implements OnInit {

  private readonly apiUrl = 'http://127.0.0.1:8000/api/users';

  users: User[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    private http: HttpClient,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<User[]>(this.apiUrl)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        })
      )
      .subscribe({
        next: (users) => {
          this.users = users;
          this.changeDetectorRef.detectChanges();
        },

        error: (error) => {
          console.error('FAILED TO LOAD USERS:', error);

          if (error.status === 401) {
            this.errorMessage =
              'Your session has expired. Please login again.';
          } else if (error.status === 403) {
            this.errorMessage =
              'You do not have permission to view users.';
          } else if (error.status === 0) {
            this.errorMessage =
              'Unable to connect to the VendorIQ API.';
          } else {
            this.errorMessage =
              'Unable to load users from the server.';
          }

          this.changeDetectorRef.detectChanges();
        }
      });
  }

  get activeUsers(): number {
    return this.users.filter(
      user => user.is_active
    ).length;
  }

  get inactiveUsers(): number {
    return this.users.filter(
      user => !user.is_active
    ).length;
  }

  getRoleCount(role: string): number {
    return this.users.filter(
      user => user.role === role
    ).length;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(part => part.length > 0)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  getRoleClass(role: string): string {
    switch (role) {
      case 'Administrator':
        return 'role-admin';

      case 'Procurement Manager':
        return 'role-procurement';

      case 'Supply Chain Manager':
        return 'role-supply';

      case 'Vendor':
        return 'role-vendor';

      case 'Finance Officer':
        return 'role-finance';

      case 'Auditor':
        return 'role-auditor';

      default:
        return 'role-default';
    }
  }

  refreshUsers(): void {
    this.loadUsers();
  }
}