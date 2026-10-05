import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.authService.loadCurrentUser().subscribe({
        next: (user) => {
          console.log('CURRENT USER LOADED:', user);
        },
        error: (error) => {
          console.error('FAILED TO LOAD CURRENT USER:', error);

          if (error.status === 401) {
            this.authService.logout();
          }
        }
      });
    }
  }
}