import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActualForm2 } from './actual-form2';

describe('ActualForm2', () => {
  let component: ActualForm2;
  let fixture: ComponentFixture<ActualForm2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActualForm2],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActualForm2);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
