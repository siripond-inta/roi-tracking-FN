import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstimatedForm1 } from './estimated-form1';

describe('EstimatedForm1', () => {
  let component: EstimatedForm1;
  let fixture: ComponentFixture<EstimatedForm1>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstimatedForm1],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstimatedForm1);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
