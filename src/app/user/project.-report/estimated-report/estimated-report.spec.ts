import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstimatedReport } from './estimated-report';

describe('EstimatedReport', () => {
  let component: EstimatedReport;
  let fixture: ComponentFixture<EstimatedReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstimatedReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstimatedReport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
