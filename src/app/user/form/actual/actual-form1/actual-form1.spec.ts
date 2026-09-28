import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActualForm1 } from './actual-form1';

describe('ActualForm1', () => {
  let component: ActualForm1;
  let fixture: ComponentFixture<ActualForm1>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActualForm1],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActualForm1);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
