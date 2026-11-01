import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FinanceDashboard } from './finance-dashboard';

describe('FinanceDashboard', () => {
  let component: FinanceDashboard;
  let fixture: ComponentFixture<FinanceDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinanceDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FinanceDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create FinanceDashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate pending liabilities correctly', () => {
    component.invoices = [
      { id: 1, invoice_number: 'INV-1', amount: 10000, status: 'Submitted', issue_date: '2026-03-01' },
      { id: 2, invoice_number: 'INV-2', amount: 25000, status: 'Approved', issue_date: '2026-03-02' },
      { id: 3, invoice_number: 'INV-3', amount: 5000, status: 'Paid', issue_date: '2026-02-15' }
    ];
    expect(component.getPendingLiabilities()).toBe(35000);
    expect(component.getTotalPaidAmount()).toBe(5000);
  });
});
