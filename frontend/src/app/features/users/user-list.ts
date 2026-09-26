import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { UserService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { USER_ROLES, User } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UserFormDialog } from './user-form-dialog';

@Component({
  selector: 'app-user-list',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './user-list.html',
})
export class UserList {
  private readonly service = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly roles = USER_ROLES;
  readonly currentUser = this.auth.user;

  readonly columns = [
    'name',
    'email',
    'role',
    'department',
    'last_login_at',
    'status',
    'actions',
  ];

  readonly loading = signal(true);
  readonly users = signal<User[]>([]);

  search = '';
  roleFilter = '';

  readonly counts = computed(() => {
    const users = this.users();
    return {
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      vendors: users.filter((u) => u.role === 'Vendor').length,
    };
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.service.list({ search: this.search, role: this.roleFilter }).subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load user accounts.');
      },
    });
  }

  clearFilters(): void {
    this.search = '';
    this.roleFilter = '';
    this.load();
  }

  isSelf(user: User): boolean {
    return user.id === this.currentUser()?.id;
  }

  create(): void {
    this.dialog
      .open(UserFormDialog, { width: '720px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  edit(user: User): void {
    this.dialog
      .open(UserFormDialog, { width: '720px', data: user })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  toggleActive(user: User): void {
    const request$ = user.is_active
      ? this.service.deactivate(user.id)
      : this.service.activate(user.id);

    request$.subscribe({
      next: (updated) => {
        this.toast.success(
          `${updated.name} ${updated.is_active ? 'activated' : 'deactivated'}.`,
        );
        this.load();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not update the account.'),
    });
  }
}
