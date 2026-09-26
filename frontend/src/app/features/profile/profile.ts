import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('new_password')?.value;
  const confirm = group.get('confirm_password')?.value;

  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly user = this.auth.user;
  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);

  readonly profileForm = this.fb.nonNullable.group({
    name: [
      this.user()?.name ?? '',
      [Validators.required, Validators.minLength(2)],
    ],
    phone: [this.user()?.phone ?? ''],
    department: [this.user()?.department ?? ''],
    job_title: [this.user()?.job_title ?? ''],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      current_password: ['', Validators.required],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  saveProfile(): void {
    if (this.profileForm.invalid || this.savingProfile()) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile.set(true);

    this.auth.updateProfile(this.profileForm.getRawValue()).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.toast.success('Profile updated.');
      },
      error: (error) => {
        this.savingProfile.set(false);
        this.toast.fromError(error, 'Could not update your profile.');
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.savingPassword()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword.set(true);

    const { current_password, new_password } = this.passwordForm.getRawValue();

    this.auth.changePassword(current_password, new_password).subscribe({
      next: (response) => {
        this.savingPassword.set(false);
        this.passwordForm.reset({
          current_password: '',
          new_password: '',
          confirm_password: '',
        });
        this.toast.success(response.message);
      },
      error: (error) => {
        this.savingPassword.set(false);
        this.toast.fromError(error, 'Could not change your password.');
      },
    });
  }
}
