import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { UserService, VendorService } from '../../core/api.service';
import { USER_ROLES, User, UserRole, Vendor } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-user-form-dialog',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './user-form-dialog.html',
})
export class UserFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UserService);
  private readonly vendorService = inject(VendorService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<UserFormDialog>);

  readonly editing = inject<User | null>(MAT_DIALOG_DATA, { optional: true });

  readonly roles = USER_ROLES;
  readonly vendors = signal<Vendor[]>([]);
  readonly saving = signal(false);
  readonly hidePassword = signal(true);
  readonly isEdit = !!this.editing;

  readonly form = this.fb.nonNullable.group({
    name: [
      this.editing?.name ?? '',
      [Validators.required, Validators.minLength(2)],
    ],
    email: [this.editing?.email ?? '', [Validators.required, Validators.email]],
    password: [
      '',
      this.editing ? [] : [Validators.required, Validators.minLength(8)],
    ],
    role: [
      (this.editing?.role ?? 'Procurement Manager') as UserRole,
      Validators.required,
    ],
    vendor_id: [this.editing?.vendor_id ?? (null as number | null)],
    phone: [this.editing?.phone ?? ''],
    department: [this.editing?.department ?? ''],
    job_title: [this.editing?.job_title ?? ''],
    is_active: [this.editing?.is_active ?? true],
  });

  constructor() {
    this.vendorService.list().subscribe({
      next: (vendors) => this.vendors.set(vendors),
      error: () => this.vendors.set([]),
    });

    this.form.controls.role.valueChanges.subscribe((role) => {
      const control = this.form.controls.vendor_id;

      if (role === 'Vendor') {
        control.addValidators(Validators.required);
      } else {
        control.clearValidators();
        control.setValue(null);
      }

      control.updateValueAndValidity();
    });

    if (this.form.controls.role.value === 'Vendor') {
      this.form.controls.vendor_id.addValidators(Validators.required);
      this.form.controls.vendor_id.updateValueAndValidity();
    }
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const raw = this.form.getRawValue();

    const shared = {
      name: raw.name,
      email: raw.email,
      role: raw.role,
      vendor_id: raw.role === 'Vendor' ? raw.vendor_id : null,
      phone: raw.phone || null,
      department: raw.department || null,
      job_title: raw.job_title || null,
      is_active: raw.is_active,
    };

    const request$ = this.editing
      ? this.service.update(this.editing.id, shared)
      : this.service.create({ ...shared, password: raw.password });

    request$.subscribe({
      next: (user) => {
        this.toast.success(
          this.editing ? `${user.name} updated.` : `Account created for ${user.email}.`,
        );
        this.dialogRef.close(user);
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.fromError(
          error,
          this.editing
            ? 'Could not update the account.'
            : 'Could not create the account.',
        );
      },
    });
  }
}
