import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Vendor } from './vendor';

describe('Vendor', () => {
  let service: Vendor;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    service = TestBed.inject(Vendor);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
