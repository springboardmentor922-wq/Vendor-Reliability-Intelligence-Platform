import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, AsyncPipe, NgClass } from '@angular/common';
import { AuthService, User } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, NgIf, AsyncPipe, NgClass],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {
  currentUser$: Observable<User | null>;
  
  full_name = '';
  phone = '';
  company = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private authService: AuthService) {
    this.currentUser$ = this.authService.currentUser$;
  }

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.full_name = user.full_name;
      this.phone = user.phone || '';
      this.company = user.company || '';
    }
  }

  saveProfile(): void {
    const user = this.authService.currentUserValue;
    if (!user) return;

    this.errorMessage = '';
    this.successMessage = '';

    if (this.newPassword && this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'New passwords do not match.';
      return;
    }

    const payload: any = {
      full_name: this.full_name,
      phone: this.phone,
      company: this.company
    };

    if (this.newPassword) {
      payload.current_password = this.currentPassword;
      payload.new_password = this.newPassword;
    }

    this.isLoading = true;
    this.authService.updateProfile(user.id, payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Profile updated successfully!';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.detail || 'Failed to update profile.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
