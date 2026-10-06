// Unit test ของ service ที่เรียก API — ใช้ HttpTestingController จำลอง backend (ไม่ยิง network จริง)
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectService } from './project.service';
import { AnalyticsService } from './analytics.service';
import { CategoryService } from './category.service';

const API = 'http://localhost:3000/api';

describe('API services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('UT-SVC-01 ProjectService.getProjects แปลงตัวเลข DECIMAL (string) จาก MySQL เป็น number', () => {
    let result: any[] = [];
    TestBed.inject(ProjectService).getProjects().subscribe((r) => (result = r));
    http.expectOne(`${API}/projects`).flush({
      status: 'success',
      data: [{ project_id: '7', initial_budget: '380000.00', target_roi_percent: '30.00', is_public: 0, is_worthwhile: 1, has_actual: 0 }],
    });
    expect(result[0].project_id).toBe(7);
    expect(result[0].initial_budget).toBe(380000);
    expect(result[0].target_roi_percent).toBe(30);
    expect(result[0].is_public).toBe(false);
    expect(result[0].is_worthwhile).toBe(true);
  });

  it('UT-SVC-02 ProjectService.replaceLedgerInputs ส่ง PUT ไปที่ endpoint ของ phase ที่ถูกต้อง', () => {
    const service = TestBed.inject(ProjectService);
    const items = [{ category_id: 'REV001', period_from: 1, period_to: 3, total_value: 100, unit_qty: null, unit_cost: null, note: '' }];
    service.replaceLedgerInputs(5, 'Actual', items).subscribe();
    const req = http.expectOne(`${API}/projects/5/ledgers/actual`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ledgers: items });
    req.flush({ status: 'success' });
  });

  it('UT-SVC-03 ProjectService.updateProjectStatus ส่งเฉพาะสถานะ', () => {
    TestBed.inject(ProjectService).updateProjectStatus(9, 'completed').subscribe();
    const req = http.expectOne(`${API}/projects/9`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: 'completed' });
    req.flush({ status: 'success' });
  });

  it('UT-SVC-04 AnalyticsService.previewProjectAnalytics ส่ง phase และรายการที่ยังไม่บันทึก', () => {
    let roi = 0;
    TestBed.inject(AnalyticsService)
      .previewProjectAnalytics(3, 'Estimated', [])
      .subscribe((a) => (roi = a.summary.estimated.roi!));
    const req = http.expectOne(`${API}/projects/3/analytics/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ phase: 'Estimated', ledgers: [] });
    req.flush({ status: 'success', data: { summary: { estimated: { roi: 42 } } } });
    expect(roi).toBe(42);
  });

  it('UT-SVC-05 CategoryService แปลง is_inflow / allow_custom_name เป็น boolean', () => {
    let cats: any[] = [];
    TestBed.inject(CategoryService).getCategories().subscribe((c) => (cats = c));
    http.expectOne(`${API}/categories`).flush({
      status: 'success',
      data: [{ category_id: 'OPCOTH', is_inflow: 0, allow_custom_name: 1, usage_count: '4' }],
    });
    expect(cats[0].is_inflow).toBe(false);
    expect(cats[0].allow_custom_name).toBe(true);
    expect(cats[0].usage_count).toBe(4);
  });
});
