import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActualReport } from './actual-report';

describe('ActualReport', () => {
  let component: ActualReport;
  let fixture: ComponentFixture<ActualReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActualReport],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActualReport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
