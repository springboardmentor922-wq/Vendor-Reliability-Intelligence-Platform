import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AddVendors } from './add-vendors';

describe('AddVendors', () => {
  let component: AddVendors;
  let fixture: ComponentFixture<AddVendors>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddVendors],
      providers: [provideHttpClient(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AddVendors);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
