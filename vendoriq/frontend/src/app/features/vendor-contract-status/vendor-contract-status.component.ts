import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-vendor-contract-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vendor-contract-status.component.html',
})
export class VendorContractStatusComponent implements OnInit {

  private readonly api =
    'http://127.0.0.1:8000/api/v1';

  contracts: any[] = [];

  loading = true;
  error = '';

  constructor(
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadContracts();
  }

  loadContracts(): void {

    this.loading = true;
    this.error = '';

    this.http
      .get<any[]>(`${this.api}/contracts`)
      .subscribe({

        next: (contracts) => {

          this.contracts = contracts || [];

          this.loading = false;

        },

        error: (error) => {

          console.error(
            'Vendor contract status error:',
            error
          );

          this.error =
            'Failed to load contract information.';

          this.loading = false;

        },

      });
  }

  statusClass(status: string): string {

    switch (status?.toLowerCase()) {

      case 'active':
      case 'renewed':
        return 'bg-success';

      case 'expiring':
        return 'bg-warning text-dark';

      case 'expired':
      case 'terminated':
        return 'bg-danger';

      default:
        return 'bg-secondary';
    }
  }

  get activeContracts(): number {

    return this.contracts.filter(
      contract =>
        contract.status === 'active' ||
        contract.status === 'renewed'
    ).length;
  }

  get expiringContracts(): number {

    return this.contracts.filter(
      contract =>
        contract.status === 'expiring'
    ).length;
  }

  get expiredContracts(): number {

    return this.contracts.filter(
      contract =>
        contract.status === 'expired'
    ).length;
  }
}
