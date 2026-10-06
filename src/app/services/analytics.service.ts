// src/app/services/analytics.service.ts
// FR04 + FR05: ผลการคำนวณของโครงการทั้งหมดมาจาก backend endpoint เดียว
// (/api/projects/:id/analytics) — NCF, กระแสเงินสดสะสม, ROI, ระยะเวลาคืนทุน, สถานะคุ้มค่า
// และส่วนต่างคาดการณ์-จริง เพื่อให้ทุกหน้าที่แสดงตัวเลขชุดนี้ตรงกันเสมอ ไม่คำนวณซ้ำใน frontend

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { CalculationMethod, CategoryGroup, ProjectStatus } from '../models/roi-tracking-model';
import type { LedgerInput } from './project.service';

export interface PeriodFigures {
  revenue: number;   // ผลประโยชน์ที่นับตามประเภทโครงการ (รายได้โดยตรง + ประโยชน์ทางอ้อม)
  direct: number;
  indirect: number;
  expense: number;
  ncf: number;
  cumulative: number;
  hasData?: boolean;
}

export interface MonthlyAnalytics {
  period: number;
  estimated: PeriodFigures;
  actual: PeriodFigures;
  variance: { revenue: number; expense: number; ncf: number; cumulative: number };
}

export interface PhaseSummary {
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  roi: number | null; // null = ไม่มีต้นทุน คำนวณ ROI ไม่ได้
  // ระยะคืนทุน (เดือน) = ต้นทุนรวม ÷ (ผลประโยชน์รวม ÷ จำนวนเดือน) — null = ยังไม่มีผลประโยชน์
  paybackMonths: number | null;
  // จุดคุ้มทุนจากกระแสเงินสดสะสม (เดือนที่เงินสะสมกลับมาเป็น 0) — null = ยังไม่คุ้มทุน
  breakEvenMonth: number | null;
  directRevenue: number;
  indirectBenefit: number;
  indirectMonthlyAverage: number;
  indirectAnnualized: number;
  excludedBenefit: number; // ผลประโยชน์ที่กรอกไว้แต่ไม่นับตามประเภทโครงการ
}

export type BenefitSource = 'direct' | 'indirect' | 'cost';

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  category_group: CategoryGroup;
  is_inflow: boolean;
  source: BenefitSource;
  counted: boolean;
  estimated: number;
  actual: number;
  variance: number;
  custom_name: string | null; // หมวด "อื่นๆ" — category_name คือชื่อที่ผู้ใช้พิมพ์
  estimatedToDate: number; // แผนเฉพาะเดือนที่มีผลจริงแล้ว (1..lastActualPeriod)
  varianceToDate: number;  // ผลจริง − แผนถึงเดือนเดียวกัน
}

export interface ProjectAnalytics {
  project: {
    project_id: number;
    project_name: string;
    project_type: string | null;
    calculation_method: CalculationMethod;
    project_status: ProjectStatus;
    duration_months: number;
    initial_budget: number;
    target_roi_percent: number | null;
  };
  monthly: MonthlyAnalytics[];
  summary: {
    hasActualData: boolean;
    lastActualPeriod: number;
    calculationMethod: CalculationMethod;
    countedSources: { direct: boolean; indirect: boolean };
    estimated: PhaseSummary;
    actual: PhaseSummary;
    // แผนถึงเดือนเดียวกับผลจริงล่าสุด — ใช้เทียบกับผลจริงระหว่างที่โครงการยังไม่จบ
    estimatedToDate: {
      months: number; totalRevenue: number; totalExpense: number; netProfit: number; roi: number | null;
      paybackMonths: number | null;
    };
    // คาดการณ์ทั้งโครงการ = ผลจริงถึงเดือนล่าสุด + แผนของเดือนที่เหลือ
    projected: { totalRevenue: number; totalExpense: number; netProfit: number; roi: number | null };
    variance: { revenue: number; expense: number; netProfit: number; roi: number | null };
    targetRoi: number | null;
    roiForComparison: number | null;
    // ฐานที่ใช้ตัดสินความคุ้มค่า: ยังไม่มีผลจริง / ผลจริงครบหรือปิดโครงการ / ผลจริงบางเดือน (คาดการณ์)
    worthwhileBasis: 'actual' | 'estimated' | 'projected';
    isWorthwhile: boolean | null;
  };
  byCategory: CategoryBreakdown[];
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/projects';

  getProjectAnalytics(projectId: number): Observable<ProjectAnalytics> {
    return this.http
      .get<ApiResponse<ProjectAnalytics>>(`${this.API_URL}/${projectId}/analytics`)
      .pipe(map((res) => res.data));
  }

  // คำนวณผลจากรายการที่กำลังกรอก (ยังไม่บันทึก) ด้วยสูตรเดียวกับรายงาน — ใช้แสดงผลสดในโหมดแก้ไข
  previewProjectAnalytics(
    projectId: number,
    phase: 'Estimated' | 'Actual',
    ledgers: LedgerInput[]
  ): Observable<ProjectAnalytics> {
    return this.http
      .post<ApiResponse<ProjectAnalytics>>(`${this.API_URL}/${projectId}/analytics/preview`, { phase, ledgers })
      .pipe(map((res) => res.data));
  }
}
