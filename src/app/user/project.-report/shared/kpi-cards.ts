// การ์ดตัวชี้วัด 6 ใบด้านบนของหน้า Estimated/Actual Report — ตัวเลขทั้งหมดมาจาก backend
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhaseSummary } from '../../../services/analytics.service';

@Component({
  selector: 'app-kpi-cards',
  imports: [CommonModule],
  styleUrl: '../report-shared.css',
  template: `
    <div class="row g-3 kpi-row">
      <div class="col-6 col-md-4 col-xl-2">
        <div class="card border-0 h-100 shadow-sm rounded-4 p-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon kpi-icon-success"><i class="bi bi-graph-up-arrow"></i></span>
            <small class="text-muted fw-bold text-uppercase kpi-label">ROI {{ label }}</small>
          </div>
          <div class="fw-bold kpi-value-lg" [ngClass]="roi >= 0 ? 'text-success' : 'text-danger'">
            {{ roi | number: '1.1-1' }}%
          </div>
          <small class="text-muted">(ผลประโยชน์ − ต้นทุน) ÷ ต้นทุน</small>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card border-0 h-100 shadow-sm rounded-4 p-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon" [ngClass]="net >= 0 ? 'kpi-icon-success' : 'kpi-icon-danger'">
              <i class="bi bi-cash-stack"></i>
            </span>
            <small class="text-muted fw-bold text-uppercase kpi-label">ผลประโยชน์สุทธิ</small>
          </div>
          <div class="fw-bold kpi-value" [ngClass]="net >= 0 ? 'text-success' : 'text-danger'">
            ฿{{ net | number: '1.0-0' }}
          </div>
          <small class="text-muted">ผลประโยชน์ − ต้นทุน</small>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card border-0 h-100 shadow-sm rounded-4 p-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon kpi-icon-success"><i class="bi bi-arrow-up-circle"></i></span>
            <small class="text-muted fw-bold text-uppercase kpi-label">ผลประโยชน์รวม</small>
          </div>
          <div class="fw-bold text-success kpi-value">฿{{ summary?.totalRevenue ?? 0 | number: '1.0-0' }}</div>
          <small class="text-muted">รายได้โดยตรง + ทางอ้อม (ที่นับ)</small>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card border-0 h-100 shadow-sm rounded-4 p-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon kpi-icon-danger"><i class="bi bi-arrow-down-circle"></i></span>
            <small class="text-muted fw-bold text-uppercase kpi-label">ต้นทุนรวม</small>
          </div>
          <div class="fw-bold text-danger kpi-value">฿{{ summary?.totalExpense ?? 0 | number: '1.0-0' }}</div>
          <small class="text-muted">ลงทุน + ดำเนินงาน + บริหาร</small>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card border-0 h-100 shadow-sm rounded-4 p-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon kpi-icon-info"><i class="bi bi-hourglass-split"></i></span>
            <small class="text-muted fw-bold text-uppercase kpi-label">ระยะคืนทุน</small>
          </div>
          <div class="fw-bold text-dark kpi-value">
            <span *ngIf="summary?.paybackMonth != null">เดือนที่ {{ summary?.paybackMonth }}</span>
            <span *ngIf="summary?.paybackMonth == null" class="text-muted">ยังไม่คืนทุน</span>
          </div>
          <small class="text-muted">เดือนแรกที่กระแสเงินสดสะสมกลับมาไม่ติดลบ</small>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card border-0 h-100 shadow-sm rounded-4 p-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon"
              [ngClass]="worthwhile === null ? 'kpi-icon-neutral' : worthwhile ? 'kpi-icon-success' : 'kpi-icon-danger'">
              <i class="bi bi-bullseye"></i>
            </span>
            <small class="text-muted fw-bold text-uppercase kpi-label">ความคุ้มค่า</small>
          </div>
          <div class="fw-bold kpi-value"
            [ngClass]="worthwhile === null ? 'text-muted' : worthwhile ? 'text-success' : 'text-danger'">
            <span *ngIf="worthwhile === null">ยังไม่ตั้งเป้า</span>
            <span *ngIf="worthwhile === true">คุ้มค่า</span>
            <span *ngIf="worthwhile === false">ไม่คุ้มค่า</span>
          </div>
          <small class="text-muted" *ngIf="targetRoi !== null">
            ROI {{ roi | number: '1.1-1' }}% vs เป้า {{ targetRoi }}%
          </small>
          <small class="text-muted" *ngIf="targetRoi === null">ตั้งเป้าหมาย ROI ได้ที่หน้า Projects</small>
        </div>
      </div>
    </div>
  `,
})
export class KpiCards {
  @Input() summary?: PhaseSummary;
  @Input() label = '';
  @Input() targetRoi: number | null = null;
  @Input() worthwhile: boolean | null = null;

  get roi(): number {
    return this.summary?.roi ?? 0;
  }

  get net(): number {
    return this.summary?.netProfit ?? 0;
  }
}
