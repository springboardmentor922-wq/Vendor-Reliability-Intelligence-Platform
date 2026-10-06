import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], // Removed RouterLink
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  activeTab: 'signin' | 'signup' = 'signin';

  signInData = {
    email: 'admin.procurement@infosys.com',
    password: '•••••••'
  };

  signUpData = {
    fullName: 'Alex Rivera',
    email: 'a.rivera@infosys.com',
    role: 'Procurement Lead'
  };

  constructor(private router: Router) {}

  setTab(tab: 'signin' | 'signup'): void {
    this.activeTab = tab;
  }

  onSignIn(): void {
    this.router.navigate(['/dashboard/procurement']);
  }

  onSignUp(): void {
    this.router.navigate(['/dashboard/procurement']);
  }
}