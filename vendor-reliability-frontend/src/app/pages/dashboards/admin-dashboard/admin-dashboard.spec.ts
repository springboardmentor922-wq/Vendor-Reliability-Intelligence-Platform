import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminDashboard } from './admin-dashboard';

describe('AdminDashboard', () => {
  let component: AdminDashboard;
  let fixture: ComponentFixture<AdminDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create AdminDashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should list all available RBAC roles', () => {
    expect(component.availableRoles).toContain('Administrator');
    expect(component.availableRoles).toContain('Procurement Manager');
    expect(component.availableRoles).toContain('Supply Chain Manager');
    expect(component.availableRoles).toContain('Vendor');
    expect(component.availableRoles).toContain('Finance Officer');
    expect(component.availableRoles).toContain('Auditor');
  });
});
