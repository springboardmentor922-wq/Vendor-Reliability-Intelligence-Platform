import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { VendorDetails } from './vendor-details';

describe('VendorDetails', () => {
  let component: VendorDetails;
  let fixture: ComponentFixture<VendorDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorDetails],
      providers: [provideHttpClient(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(VendorDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
