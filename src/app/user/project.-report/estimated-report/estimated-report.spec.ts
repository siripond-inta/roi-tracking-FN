import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstimatedReport } from './estimated-report';

describe('EstimatedReport', () => {
  let component: EstimatedReport;
  let fixture: ComponentFixture<EstimatedReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstimatedReport],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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
