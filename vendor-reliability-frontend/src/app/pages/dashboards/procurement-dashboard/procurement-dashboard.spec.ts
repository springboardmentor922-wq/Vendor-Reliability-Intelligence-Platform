import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ProcurementDashboard } from './procurement-dashboard';

describe('ProcurementDashboard', () => {
  let component: ProcurementDashboard;
  let fixture: ComponentFixture<ProcurementDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcurementDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProcurementDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create ProcurementDashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute suitability tags correctly', () => {
    const highRiskVendor: any = { risk_level: 'High', deliveryRate: 65, status: 'Approved' };
    expect(component.getSuitabilityTag(highRiskVendor).label).toContain('High Risk');

    const recommendedVendor: any = { risk_level: 'Low', deliveryRate: 95, status: 'Approved' };
    expect(component.getSuitabilityTag(recommendedVendor).label).toContain('Highly Recommended');
  });
});
