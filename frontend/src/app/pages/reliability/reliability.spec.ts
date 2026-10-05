import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Reliability } from './reliability';

describe('Reliability', () => {
  let component: Reliability;
  let fixture: ComponentFixture<Reliability>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reliability],
    }).compileComponents();

    fixture = TestBed.createComponent(Reliability);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
