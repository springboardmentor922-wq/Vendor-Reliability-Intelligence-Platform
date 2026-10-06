import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-activity-log-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-log-management.component.html',
  styleUrls: ['./activity-log-management.component.css']
})
export class ActivityLogManagementComponent implements OnInit {

  activities: any[] = [];

  private apiUrl = 'http://localhost:8000/api/activity-logs/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadActivities();
  }

  loadActivities(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.activities = data;
      },
      error: (error) => {
        console.error('Error loading activity logs:', error);
      }
    });
  }

  get totalActivities(): number {
    return this.activities.length;
  }

  get actionCount(): number {
    return new Set(
      this.activities.map(item => item.action)
    ).size;
  }
}