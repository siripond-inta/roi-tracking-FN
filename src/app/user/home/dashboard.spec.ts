// Unit test ของตรรกะหน้า Dashboard — ใส่ข้อมูลโครงการตรงๆ (ไม่ render กราฟ ไม่เรียก API)
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { Project } from '../../models/roi-tracking-model';

const project = (over: Partial<Project>): Project => ({
  project_id: 1, user_id: 1, project_name: 'P', project_type_id: 1, duration_months: 12,
  initial_budget: 100000, created_at: new Date(), ...over,
});

describe('Dashboard (Home)', () => {
  let home: Home;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    // ไม่เรียก detectChanges → ngOnInit ยังไม่ทำงาน ทดสอบเฉพาะตรรกะของ component
    home = TestBed.createComponent(Home).componentInstance;
    home.projects = [
      project({ project_id: 1, initial_budget: 380000, total_benefit: 1086000, direct_revenue: 780000, indirect_benefit: 306000,
        total_cost: 661000, roi: 64.3, is_worthwhile: true, estimated_roi: 64.3 }),
      project({ project_id: 2, initial_budget: 300000, total_benefit: 309550, direct_revenue: 0, indirect_benefit: 309550,
        total_cost: 332000, roi: -6.8, is_worthwhile: false, has_actual: true, actual_roi: -6.8, estimated_roi: 111.9,
        estimated_to_date_roi: 7.7 }),
      // โครงการเปล่า (ยังไม่มีต้นทุน) ไม่ควรถูกนับในค่าเฉลี่ย ROI
      project({ project_id: 3, initial_budget: 50000, total_cost: 0, roi: null as any }),
    ];
    home.calculateSummary();
  });

  it('UT-DASH-01 รวมงบ ผลประโยชน์ (โดยตรง/ทางอ้อม) ของทุกโครงการ', () => {
    expect(home.totalBudget).toBe(730000);
    expect(home.totalBenefits).toBe(1395550);
    expect(home.totalDirect).toBe(780000);
    expect(home.totalIndirect).toBe(615550);
  });

  it('UT-DASH-02 ROI เฉลี่ยนับเฉพาะโครงการที่มีต้นทุนแล้ว', () => {
    expect(home.averageROI).toBeCloseTo((64.3 - 6.8) / 2, 6);
    expect(home.worthwhileCount).toBe(1);
    expect(home.actualCount).toBe(1);
  });

  it('UT-DASH-03 แผน vs ผลจริง เทียบกับแผนช่วงเดียวกัน → ต่ำกว่าแผน', () => {
    expect(home.comparedProjects.map((p) => p.project_id)).toEqual([2]);
    expect(home.planResult(home.comparedProjects[0])).toBe('below');
    expect(home.comparisonLabel('below')).toBe('ต่ำกว่าแผน');
  });

  it('UT-DASH-04 กราฟ ROI เรียงจากสูงไปต่ำ และแท่งผลจริงเป็น null เมื่อยังไม่มีผลจริง', () => {
    const data = home.roiChartData;
    expect(data.datasets[0].data[0]).toBe(64.3);
    expect(data.datasets[1].data[0]).toBeNull();
  });

  it('UT-DASH-05 ค้นหาโครงการตามชื่อ', () => {
    home.projects[0].project_name = 'ระบบ CRM';
    home.searchTerm = 'crm';
    expect(home.filteredProjects.map((p) => p.project_id)).toEqual([1]);
  });
});
