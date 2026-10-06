import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-reliability-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reliability-dashboard.component.html',
  styleUrls: ['./reliability-dashboard.component.css']
})
export class ReliabilityDashboardComponent implements OnInit {

  reliabilityScores: any[] = [];
  riskSummary: any = {};
  ranking: any[] = [];
  recommendations: any[] = [];

  private apiUrl = 'http://localhost:8000/api/reliability/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadReliabilityScores();
    this.loadRanking();
    this.loadRiskSummary();
    this.loadRecommendations();
  }

  loadReliabilityScores(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.reliabilityScores = data;
      },
      error: (error) => {
        console.error('Error loading reliability scores:', error);
      }
    });
  }

  loadRanking(): void {
    this.http.get<any[]>('http://localhost:8000/api/reliability/ranking').subscribe({
      next: (data) => {
        this.ranking = data;
      },
      error: (error) => {
        console.error('Error loading ranking:', error);
      }
    });
  }

  loadRiskSummary(): void {
    this.http.get<any>('http://localhost:8000/api/reliability/risk-summary').subscribe({
      next: (data) => {
        this.riskSummary = data;
      },
      error: (error) => {
        console.error('Error loading risk summary:', error);
      }
    });
  }

 loadRecommendations(): void {
  this.http.get<any[]>(
    'http://localhost:8000/api/procurement-recommendations/'
  ).subscribe({
    next: (data) => {
      this.recommendations = data;
    },
    error: (error) => {
      console.error('Error loading recommendations:', error);
    }
  });
}

}