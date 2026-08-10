import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstimatedForm2 } from './estimated-form2';

describe('EstimatedForm2', () => {
  let component: EstimatedForm2;
  let fixture: ComponentFixture<EstimatedForm2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstimatedForm2]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstimatedForm2);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
