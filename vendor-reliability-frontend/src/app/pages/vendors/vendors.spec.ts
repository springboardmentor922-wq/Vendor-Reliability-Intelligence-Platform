import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Vendors } from './vendors';

describe('Vendors', () => {
  let component: Vendors;
  let fixture: ComponentFixture<Vendors>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Vendors],
      providers: [provideHttpClient(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(Vendors);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
