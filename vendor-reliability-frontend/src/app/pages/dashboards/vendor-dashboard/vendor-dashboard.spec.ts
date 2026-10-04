import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VendorDashboard } from './vendor-dashboard';

describe('VendorDashboard', () => {
  let component: VendorDashboard;
  let fixture: ComponentFixture<VendorDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VendorDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create VendorDashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize modals closed', () => {
    expect(component.showRejectModal).toBe(false);
    expect(component.showDispatchModal).toBe(false);
  });
});
