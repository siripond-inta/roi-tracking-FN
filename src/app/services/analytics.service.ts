// src/app/services/analytics.service.ts
// FR04 + FR05: ผลการคำนวณของโครงการทั้งหมดมาจาก backend endpoint เดียว
// (/api/projects/:id/analytics) — NCF, กระแสเงินสดสะสม, ROI, ระยะเวลาคืนทุน, สถานะคุ้มค่า
// และส่วนต่างคาดการณ์-จริง เพื่อให้ทุกหน้าที่แสดงตัวเลขชุดนี้ตรงกันเสมอ ไม่คำนวณซ้ำใน frontend

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface PeriodFigures {
  revenue: number;
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
  roi: number;
  paybackMonth: number | null;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  category_group: 'INV' | 'OPC' | 'ADC' | 'BEN';
  is_inflow: boolean;
  estimated: number;
  actual: number;
  variance: number;
}

export interface ProjectAnalytics {
  project: {
    project_id: number;
    project_name: string;
    project_type: string | null;
    duration_months: number;
    initial_budget: number;
    target_roi_percent: number | null;
  };
  monthly: MonthlyAnalytics[];
  summary: {
    hasActualData: boolean;
    estimated: PhaseSummary;
    actual: PhaseSummary;
    variance: { revenue: number; expense: number; netProfit: number; roi: number };
    targetRoi: number | null;
    roiForComparison: number;
    worthwhileBasis: 'actual' | 'estimated';
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
}
