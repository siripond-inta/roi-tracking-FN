// การ์ดตัวชี้วัด 6 ใบด้านบนของหน้า Estimated/Actual Report — ตัวเลขทั้งหมดมาจาก backend
// เน้นตัวเลขอย่างเดียว (คำอธิบายสูตรอยู่ใน tooltip เมื่อชี้ที่การ์ด) ให้อ่านง่ายสำหรับผู้ใช้ครั้งแรก
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhaseSummary } from '../../../services/analytics.service';
import { BahtPipe } from './baht.pipe';
import { PctPipe } from './pct.pipe';

@Component({
  selector: 'app-kpi-cards',
  imports: [CommonModule, BahtPipe, PctPipe],
  styleUrl: '../report-shared.css',
  template: `
    <div class="row g-3 kpi-row">
      <div class="col-6 col-md-4 col-xl-2">
        <div class="card kpi-card border-0 h-100 shadow-sm rounded-4 p-3" title="ผลตอบแทนการลงทุน = (ผลประโยชน์ − ต้นทุน) ÷ ต้นทุน">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon kpi-icon-success"><i class="bi bi-graph-up-arrow"></i></span>
            <small class="text-muted fw-bold kpi-label">ROI {{ label }}</small>
          </div>
          <div class="fw-bold kpi-number" [ngClass]="roi == null ? 'text-muted' : roi >= 0 ? 'text-success' : 'text-danger'">
            {{ roi | pct }}
          </div>
          <small class="text-muted" *ngIf="roi == null">ยังไม่มีต้นทุน</small>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card kpi-card border-0 h-100 shadow-sm rounded-4 p-3" title="ผลประโยชน์รวม − ต้นทุนรวม">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon" [ngClass]="net >= 0 ? 'kpi-icon-success' : 'kpi-icon-danger'">
              <i class="bi bi-cash-stack"></i>
            </span>
            <small class="text-muted fw-bold kpi-label">ผลประโยชน์สุทธิ</small>
          </div>
          <div class="fw-bold kpi-number" [ngClass]="net >= 0 ? 'text-success' : 'text-danger'">
            {{ net | baht }}
          </div>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card kpi-card border-0 h-100 shadow-sm rounded-4 p-3" title="รายได้โดยตรง + ผลประโยชน์ทางอ้อม (เฉพาะที่ประเภทโครงการนับ)">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon kpi-icon-success"><i class="bi bi-arrow-up-circle"></i></span>
            <small class="text-muted fw-bold kpi-label">ผลประโยชน์รวม</small>
          </div>
          <div class="fw-bold text-success kpi-number">{{ summary?.totalRevenue ?? 0 | baht }}</div>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card kpi-card border-0 h-100 shadow-sm rounded-4 p-3" title="เงินลงทุน + ค่าดำเนินงาน + ค่าบริหาร">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon kpi-icon-danger"><i class="bi bi-arrow-down-circle"></i></span>
            <small class="text-muted fw-bold kpi-label">ต้นทุนรวม</small>
          </div>
          <div class="fw-bold text-danger kpi-number">{{ summary?.totalExpense ?? 0 | baht }}</div>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card kpi-card border-0 h-100 shadow-sm rounded-4 p-3"
          title="ระยะคืนทุน (สูตรเฉลี่ย) = ต้นทุนรวม ÷ (ผลประโยชน์รวม ÷ จำนวนเดือน) · จุดคุ้มทุน = เดือนที่เงินสะสมในกราฟกลับมาเป็น 0">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon kpi-icon-info"><i class="bi bi-hourglass-split"></i></span>
            <small class="text-muted fw-bold kpi-label">ระยะคืนทุน</small>
          </div>
          <div class="fw-bold text-dark kpi-number">
            <span *ngIf="summary?.paybackMonths != null">{{ summary?.paybackMonths | number: '1.1-1' }} เดือน</span>
            <span *ngIf="summary?.paybackMonths == null" class="text-muted">—</span>
          </div>
          <small class="text-muted" *ngIf="summary && summary.totalExpense > 0">
            <ng-container *ngIf="summary.breakEvenMonth != null">คุ้มทุนจริง (เงินสะสม) ~{{ summary.breakEvenMonth | number: '1.1-1' }} เดือน</ng-container>
            <ng-container *ngIf="summary.breakEvenMonth == null">เงินสะสมยังติดลบ — ยังไม่คุ้มทุน</ng-container>
          </small>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="card kpi-card border-0 h-100 shadow-sm rounded-4 p-3" title="เทียบ ROI กับเป้าหมายที่ตั้งไว้ตอนสร้างโครงการ">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="kpi-icon"
              [ngClass]="worthwhile === null ? 'kpi-icon-neutral' : worthwhile ? 'kpi-icon-success' : 'kpi-icon-danger'">
              <i class="bi bi-bullseye"></i>
            </span>
            <small class="text-muted fw-bold kpi-label">ความคุ้มค่า</small>
          </div>
          <div class="fw-bold kpi-number"
            [ngClass]="worthwhile === null ? 'text-muted' : worthwhile ? 'text-success' : 'text-danger'">
            <span *ngIf="worthwhile === null">ยังไม่ตั้งเป้า</span>
            <span *ngIf="worthwhile === true">คุ้มค่า</span>
            <span *ngIf="worthwhile === false">ไม่คุ้มค่า</span>
          </div>
          <small class="text-muted" *ngIf="targetRoi !== null">เป้า {{ targetRoi }}%<ng-container *ngIf="worthwhileNote"> · {{ worthwhileNote }}</ng-container></small>
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
  // บอกว่าความคุ้มค่าตัดสินจากฐานไหน เช่น "คาดการณ์ทั้งโครงการ" ระหว่างโครงการยังไม่จบ
  @Input() worthwhileNote = '';

  get roi(): number | null {
    return this.summary?.roi ?? null;
  }

  get net(): number {
    return this.summary?.netProfit ?? 0;
  }
}
