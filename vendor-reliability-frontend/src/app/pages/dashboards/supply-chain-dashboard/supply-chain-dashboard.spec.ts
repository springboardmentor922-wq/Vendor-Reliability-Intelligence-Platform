import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SupplyChainDashboard } from './supply-chain-dashboard';

describe('SupplyChainDashboard', () => {
  let component: SupplyChainDashboard;
  let fixture: ComponentFixture<SupplyChainDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplyChainDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SupplyChainDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create SupplyChainDashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate delayed shipments accurately', () => {
    component.shipmentFlows = [
      { id: '1', po_number: 'PO-01', product_name: 'Raw Steel', category: 'Raw Material', vendor_name: 'Apex', vendor_id: 1, quantity: 100, destination_hub: 'Hub A', expected_date: '2026-03-01', status: 'On Schedule', delay_days: 0, availability_status: 'Adequate Stock', reliability_score: 95 },
      { id: '2', po_number: 'PO-02', product_name: 'Microchips', category: 'IT', vendor_name: 'TechCorp', vendor_id: 2, quantity: 200, destination_hub: 'Hub B', expected_date: '2026-02-28', status: 'Critical Delay', delay_days: 5, availability_status: 'Stockout Risk', reliability_score: 60 }
    ];
    expect(component.getDelayedCount()).toBe(1);
    expect(component.getStockoutRiskCount()).toBe(1);
  });
});
