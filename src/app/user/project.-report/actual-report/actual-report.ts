import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Project, ProjectLedger } from '../../../models/roi-tracking-model';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';
import { PageHeaderService } from '../../../services/page-header.service';
import { CategoryService, Category } from '../../../services/category.service';
import { AnalyticsService, ProjectAnalytics } from '../../../services/analytics.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import {
  LedgerRow,
  findCategory,
  isQtyBased,
  periodOptions,
  rowTotal,
  sumRows,
  toPayload,
} from '../ledger-row.util';

export type { LedgerRow };

@Component({
  selector: 'app-actual-report',
  imports: [CommonModule, RouterModule, FormsModule, BaseChartDirective],
  templateUrl: './actual-report.html',
  styleUrl: './actual-report.css',
})
export class ActualReport implements OnInit {
  projectId!: number;
  project?: Project;
  isLoading = false;
  isSaving = false;

  estimatedLedger: ProjectLedger[] = [];
  actualLedger: ProjectLedger[] = [];

  mode: 'view' | 'edit' = 'view';
  isOwner = false; // false = กำลังดูโปรเจกต์ของคนอื่นผ่านหน้า Community (read-only)
  isPublic = false;
  revenueRows: LedgerRow[] = [];
  expenseRows: LedgerRow[] = [];

  // ─── Estimated KPIs ──────────────────────────────────────────────────────────
  totalEstRevenue = 0;
  totalEstExpense = 0;
  estNetProfit = 0;
  estROI = 0;
  estPaybackMonths: number | null = null;

  // ─── Actual KPIs (จาก DB) ────────────────────────────────────────────────────
  totalActRevenue = 0;
  totalActExpense = 0;
  actNetProfit = 0;
  actROI = 0;
  actPaybackMonths: number | null = null;

  // ─── หมวดหมู่ (ดึงจาก database ผ่าน API) ────────────────────────────────────
  allCategories: Category[] = [];
  get revenueCategories(): Category[] {
    return this.allCategories.filter(c => c.is_inflow);
  }
  get expenseCategories(): Category[] {
    return this.allCategories.filter(c => !c.is_inflow);
  }

  // ─── ผลการคำนวณจาก backend (FR04/FR05) ──────────────────────────────────────
  analytics?: ProjectAnalytics;

  // ─── ตัวช่วยของฟอร์มรายแถว (ตรรกะเดียวกับหน้า Estimated Report) ──────────────
  get periods(): number[] {
    return periodOptions(this.project?.duration_months);
  }

  categoryOf(row: LedgerRow): Category | undefined {
    return findCategory(this.allCategories, row.category_id);
  }

  isQtyRow(row: LedgerRow): boolean {
    return isQtyBased(this.categoryOf(row));
  }

  rowAmount(row: LedgerRow): number {
    return rowTotal(row, this.allCategories);
  }

  // เปลี่ยนหมวดหมู่แล้วต้องไม่ทำให้ยอดที่กรอกไว้หาย (ดูคำอธิบายเดียวกันที่ estimated-report.ts)
  onCategoryChange(row: LedgerRow): void {
    const previousAmount = this.rowAmount(row);
    if (this.isQtyRow(row)) {
      row.total_value = previousAmount;
    } else {
      row.unit_qty = null;
      row.unit_cost = null;
      row.total_value = previousAmount;
    }
  }

  // ─── Real-time Live Calculations ───────────────────────────────────────────
  get liveRevenue(): number {
    return sumRows(this.revenueRows, this.allCategories);
  }

  get liveExpense(): number {
    return sumRows(this.expenseRows, this.allCategories);
  }

  get liveNet(): number {
    return this.liveRevenue - this.liveExpense;
  }

  get liveROI(): number {
    if (this.liveExpense <= 0) return 0;
    return ((this.liveRevenue - this.liveExpense) / this.liveExpense) * 100;
  }

  // FR04-3: เดือนแรกที่กระแสเงินสดสะสม >= เงินลงทุนเริ่มต้น (คำนวณสดขณะกรอก)
  get livePaybackMonths(): number | null {
    const initialBudget = Number(this.project?.initial_budget || 0);
    if (initialBudget <= 0) return null;

    let cumulative = 0;
    for (const period of this.periods) {
      const revenue = sumRows(
        this.revenueRows.filter((r) => r.period_index === period),
        this.allCategories
      );
      const expense = sumRows(
        this.expenseRows.filter((r) => r.period_index === period),
        this.allCategories
      );
      cumulative += revenue - expense;
      if (cumulative >= initialBudget) return period;
    }
    return null;
  }

  // FR04-4: สถานะคุ้มค่า/ไม่คุ้มค่า เทียบ ROI จริงกับเป้าหมายของโครงการ
  get targetRoi(): number | null {
    return this.project?.target_roi_percent ?? null;
  }

  get isWorthwhile(): boolean | null {
    if (this.targetRoi == null) return null;
    return this.displayedROI >= this.targetRoi;
  }

  // Displayed metrics (สลับระหว่างค่าสดในโหมดแก้ไข กับค่าที่บันทึกในโหมดดูผล)
  get displayedRevenue(): number {
    return this.mode === 'edit' ? this.liveRevenue : this.totalActRevenue;
  }

  get displayedExpense(): number {
    return this.mode === 'edit' ? this.liveExpense : this.totalActExpense;
  }

  get displayedNet(): number {
    return this.mode === 'edit' ? this.liveNet : this.actNetProfit;
  }

  get displayedROI(): number {
    return this.mode === 'edit' ? this.liveROI : this.actROI;
  }

  get displayedPayback(): number | null {
    return this.mode === 'edit' ? this.livePaybackMonths : this.actPaybackMonths;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    public authService: AuthService,
    private pageHeader: PageHeaderService,
    private categoryService: CategoryService,
    private analyticsService: AnalyticsService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.projectId = Number(this.route.snapshot.paramMap.get('id'));
    const queryMode = this.route.snapshot.queryParamMap.get('mode');
    this.loadData(queryMode === 'create' || queryMode === 'edit');
  }

  loadData(openEditIfEmpty = false): void {
    this.isLoading = true;
    forkJoin({
      project: this.projectService.getProjectById(this.projectId),
      ledgers: this.projectService.getLedgersByProjectId(this.projectId),
      categories: this.categoryService.getCategories(),
      analytics: this.analyticsService.getProjectAnalytics(this.projectId)
    }).subscribe({
      next: (result) => {
        this.allCategories = result.categories;
        this.analytics = result.analytics;
        this.project = result.project;
        this.isOwner = result.project.user_id === this.authService.currentUser()?.userId;
        this.isPublic = !!result.project.is_public;
        this.pageHeader.set('Actual Report', result.project.project_name);
        this.estimatedLedger = result.ledgers.filter(l => l.phase === 'Estimated');
        this.actualLedger = result.ledgers.filter(l => l.phase === 'Actual');
        this.calculateMetrics();
        this.isLoading = false;

        // เฉพาะเจ้าของเท่านั้นที่เข้าสู่โหมดแก้ไขอัตโนมัติได้ — ผู้ที่เข้ามาดูผ่านหน้า
        // Community ต้องเห็นแค่โหมดดูอย่างเดียว
        if (this.isOwner && (openEditIfEmpty || this.actualLedger.length === 0)) {
          this.startEdit();
        } else {
          this.mode = 'view';
        }
      },
      error: () => {
        this.isLoading = false;
        Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: 'กรุณาลองใหม่อีกครั้ง' });
      }
    });
  }

  // ─── Edit / View ───────────────────────────────────────────────────────────
  // แถวที่เคยบันทึกไว้แล้ว — เอายอดเดิมมาแก้ต่อได้
  private toEditableRow(l: ProjectLedger, typeId: number): LedgerRow {
    const qtyBased = l.unit_qty != null && l.unit_cost != null;
    return {
      ledger_id: l.ledger_id,
      category_id: String(l.category_id),
      period_index: Number(l.period_index) || 1,
      total_value: qtyBased ? null : Number(l.total_value) || 0,
      unit_qty: qtyBased ? Number(l.unit_qty) : null,
      unit_cost: qtyBased ? Number(l.unit_cost) : null,
      note: l.note || '',
      type_id: typeId
    };
  }

  // แถวที่ copy โครงสร้างมาจาก Estimated — คงหมวดหมู่กับงวดไว้ แต่ล้างยอดให้กรอกผลจริงใหม่
  private toBlankFromEstimated(l: ProjectLedger, typeId: number): LedgerRow {
    const qtyBased = l.unit_qty != null && l.unit_cost != null;
    return {
      category_id: String(l.category_id),
      period_index: Number(l.period_index) || 1,
      total_value: qtyBased ? null : 0,
      unit_qty: qtyBased ? 0 : null,
      unit_cost: qtyBased ? Number(l.unit_cost) : null, // อัตราต่อหน่วยมักใช้ค่าเดิม
      note: '',
      type_id: typeId
    };
  }

  startEdit(): void {
    if (this.actualLedger.length > 0) {
      // โหลด Actual ที่เคยบันทึกไว้
      const revs = this.actualLedger.filter(l => Number(l.type_id) === 2);
      this.revenueRows = revs.length > 0
        ? revs.map(l => this.toEditableRow(l, 2))
        : [this.newBlankRevenueRow()];

      const exps = this.actualLedger.filter(l => Number(l.type_id) === 1);
      this.expenseRows = exps.length > 0
        ? exps.map(l => this.toEditableRow(l, 1))
        : [this.newBlankExpenseRow()];
    } else if (this.estimatedLedger.length > 0) {
      // นำโครงสร้างหมวดหมู่/งวดจาก Estimated มาเตรียมให้กรอกได้เลย
      const revs = this.estimatedLedger.filter(l => Number(l.type_id) === 2);
      this.revenueRows = revs.length > 0
        ? revs.map(l => this.toBlankFromEstimated(l, 2))
        : [this.newBlankRevenueRow()];

      const exps = this.estimatedLedger.filter(l => Number(l.type_id) === 1);
      this.expenseRows = exps.length > 0
        ? exps.map(l => this.toBlankFromEstimated(l, 1))
        : [this.newBlankExpenseRow()];
    } else {
      this.revenueRows = [this.newBlankRevenueRow()];
      this.expenseRows = [this.newBlankExpenseRow()];
    }

    this.mode = 'edit';
  }

  cancelEdit(): void {
    if (this.actualLedger.length === 0) {
      this.router.navigate(['/user/estimated-report', this.projectId]);
      return;
    }
    this.mode = 'view';
    this.revenueRows = [];
    this.expenseRows = [];
  }

  private newBlankRow(typeId: number, categoryId: string): LedgerRow {
    return {
      category_id: categoryId,
      period_index: 1,
      total_value: 0,
      unit_qty: null,
      unit_cost: null,
      note: '',
      type_id: typeId
    };
  }

  newBlankRevenueRow(): LedgerRow {
    return this.newBlankRow(2, this.revenueCategories[0]?.category_id || '');
  }

  newBlankExpenseRow(): LedgerRow {
    return this.newBlankRow(1, this.expenseCategories[0]?.category_id || '');
  }

  // สัดส่วน (%) ของแถวนี้เทียบกับยอดรวมฝั่งเดียวกัน — ใช้แสดงแถบเล็กใต้แต่ละแถวในโหมดแก้ไข
  rowShare(row: LedgerRow, total: number): number {
    const v = this.rowAmount(row);
    if (total <= 0 || v <= 0) return 0;
    return Math.min(100, (v / total) * 100);
  }

  addRevenueRow(): void {
    this.revenueRows.push(this.newBlankRevenueRow());
  }

  removeRevenueRow(i: number): void {
    this.revenueRows.splice(i, 1);
    if (this.revenueRows.length === 0) this.revenueRows.push(this.newBlankRevenueRow());
  }

  addExpenseRow(): void {
    this.expenseRows.push(this.newBlankExpenseRow());
  }

  removeExpenseRow(i: number): void {
    this.expenseRows.splice(i, 1);
    if (this.expenseRows.length === 0) this.expenseRows.push(this.newBlankExpenseRow());
  }

  // ─── Save Actual ───────────────────────────────────────────────────────────
  async saveActual(): Promise<void> {
    const allRows = [...this.revenueRows, ...this.expenseRows];
    const validRows = allRows.filter(r => this.rowAmount(r) > 0);

    if (validRows.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูล',
        text: 'กรุณากรอกจำนวนเงินอย่างน้อย 1 รายการ',
        confirmButtonColor: '#198754'
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: 'question',
      title: 'ยืนยันการบันทึก Actual?',
      text: 'ข้อมูลรายรับ-รายจ่ายจริงจะถูกบันทึกเพื่อเปรียบเทียบกับประมาณการ',
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#198754'
    });
    if (!confirm.isConfirmed) return;

    this.isSaving = true;
    const payload = validRows.map(r => toPayload(r, this.allCategories, this.project?.created_at));

    const isFirstSave = this.actualLedger.length === 0;

    if (isFirstSave) {
      this.http.post<any>(
        `http://localhost:3000/api/projects/${this.projectId}/ledgers`,
        { phase: 'Actual', ledgers: payload }
      ).subscribe({
        next: () => this.afterSave(),
        error: (err) => this.handleSaveError(err)
      });
    } else {
      this.http.put<any>(
        `http://localhost:3000/api/projects/${this.projectId}/ledgers/actual`,
        { ledgers: payload }
      ).subscribe({
        next: () => this.afterSave(),
        error: (err) => this.handleSaveError(err)
      });
    }
  }

  private afterSave(): void {
    this.isSaving = false;
    Swal.fire({
      icon: 'success',
      title: 'บันทึก Actual สำเร็จ!',
      timer: 1800,
      showConfirmButton: false
    });
    this.loadData();
    this.mode = 'view';
    this.revenueRows = [];
    this.expenseRows = [];
  }

  private handleSaveError(err: any): void {
    this.isSaving = false;
    Swal.fire({
      icon: 'error',
      title: 'บันทึกไม่สำเร็จ',
      text: err.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
    });
  }

  // ─── พิมพ์ / บันทึกเป็น PDF ────────────────────────────────────────────────
  // <canvas> ของ Chart.js วาดใหม่เมื่อขนาดกล่องเปลี่ยน พอสลับไป layout ของกระดาษ กราฟมักจะ
  // ออกมาว่างเปล่าเพราะยังวาดไม่ทันตอนเบราว์เซอร์ snapshot หน้า — แก้โดยแปลงกราฟเป็นรูปภาพ
  // ไว้ก่อนสั่งพิมพ์ แล้วให้ CSS สลับไปโชว์รูปแทน canvas เฉพาะตอนพิมพ์
  @ViewChildren(BaseChartDirective) private chartDirectives?: QueryList<BaseChartDirective>;
  chartImages: string[] = [];

  printReport(): void {
    this.chartImages = (this.chartDirectives?.toArray() ?? []).map(
      (d) => d.chart?.toBase64Image() ?? ''
    );

    // ล้างรูปเมื่อพิมพ์เสร็จ — ต้องรอ event afterprint ไม่ใช่ตั้งเวลาเอง เพราะบางเบราว์เซอร์
    // window.print() คืนค่าทันทีตั้งแต่ยังไม่ปิดหน้าต่าง preview ถ้าล้างก่อนกราฟจะหายจาก PDF
    const restore = () => {
      this.chartImages = [];
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    // รอให้ Angular render <img> ที่เพิ่งสร้างเสร็จก่อน ไม่งั้นหน้ากระดาษจะยังไม่มีรูป
    setTimeout(() => window.print(), 250);
  }

  get today(): Date {
    return new Date();
  }

  // ─── Visibility Toggle ─────────────────────────────────────────────────────
  async toggleVisibility(): Promise<void> {
    const newState = !this.isPublic;
    const result = await Swal.fire({
      icon: 'question',
      title: newState ? 'เปลี่ยนเป็นสาธารณะ?' : 'เปลี่ยนเป็นส่วนตัว?',
      text: newState ? 'ทุกคนจะสามารถดูรายงานนี้ได้' : 'เฉพาะคุณเท่านั้นที่จะเห็น',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#198754'
    });
    if (!result.isConfirmed) return;

    this.projectService.toggleVisibility(this.projectId, newState).subscribe({
      next: () => {
        this.isPublic = newState;
        Swal.fire({
          icon: 'success',
          title: newState ? 'เปลี่ยนเป็นสาธารณะแล้ว' : 'เปลี่ยนเป็นส่วนตัวแล้ว',
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: () => Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ' })
    });
  }

  // ═══ FR05-1: กราฟสรุปผล ════════════════════════════════════════════════════
  // ใช้สีชุดเดียวกับทั้งเว็บ: เขียว = ผลจริง/รายรับ, เทา-ประ = แผน/ประมาณการ, แดง = รายจ่าย

  // กราฟเส้น: แนวโน้ม ROI สะสมรายเดือน (แผน vs จริง)
  get roiTrendChartData(): ChartConfiguration<'line'>['data'] {
    const monthly = this.analytics?.monthly ?? [];

    // ROI สะสม ณ สิ้นเดือนนั้นๆ = (ผลประโยชน์สะสม - ต้นทุนสะสม) / ต้นทุนสะสม × 100
    const cumulativeRoi = (pick: (m: (typeof monthly)[number]) => { revenue: number; expense: number }) => {
      let revenue = 0;
      let expense = 0;
      return monthly.map((m) => {
        const f = pick(m);
        revenue += f.revenue;
        expense += f.expense;
        return expense > 0 ? ((revenue - expense) / expense) * 100 : 0;
      });
    };

    // ผลจริงลากเส้นเฉพาะเดือนที่บันทึกแล้ว เดือนที่ยังไม่ถึงปล่อยว่าง (null) ไม่ลากให้เป็น 0
    const lastActualPeriod = monthly.filter((m) => m.actual.hasData).length
      ? Math.max(...monthly.filter((m) => m.actual.hasData).map((m) => m.period))
      : 0;
    const actualSeries = cumulativeRoi((m) => m.actual).map((v, i) =>
      monthly[i].period <= lastActualPeriod ? v : null
    );

    return {
      labels: monthly.map((m) => `เดือน ${m.period}`),
      datasets: [
        {
          label: 'ROI ประมาณการ (สะสม)',
          data: cumulativeRoi((m) => m.estimated),
          borderColor: '#6c757d',
          backgroundColor: 'rgba(108,117,125,.1)',
          borderDash: [6, 4],
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'ROI จริง (สะสม)',
          data: actualSeries,
          borderColor: '#198754',
          backgroundColor: 'rgba(25,135,84,.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          spanGaps: false,
        },
      ],
    };
  }

  readonly roiTrendChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      y: {
        ticks: { callback: (v) => `${v}%` },
        grid: { color: 'rgba(0,0,0,.05)' },
      },
      x: { grid: { display: false } },
    },
  };

  // กราฟแท่ง: เปรียบเทียบผลประโยชน์รายหมวด (แผน vs จริง)
  get benefitChartData(): ChartConfiguration<'bar'>['data'] {
    const benefits = (this.analytics?.byCategory ?? []).filter((c) => c.is_inflow);
    return {
      labels: benefits.map((c) => c.category_name),
      datasets: [
        {
          label: 'ประมาณการ',
          data: benefits.map((c) => c.estimated),
          backgroundColor: 'rgba(108,117,125,.55)',
          borderRadius: 6,
        },
        {
          label: 'เกิดขึ้นจริง',
          data: benefits.map((c) => c.actual),
          backgroundColor: '#198754',
          borderRadius: 6,
        },
      ],
    };
  }

  readonly benefitChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => `฿${Number(v).toLocaleString()}` },
        grid: { color: 'rgba(0,0,0,.05)' },
      },
      x: { grid: { display: false } },
    },
  };

  // ─── KPI — ใช้ตัวเลขที่ backend คำนวณให้ (FR04) ไม่คำนวณซ้ำที่นี่ ──────────────
  private calculateMetrics(): void {
    const est = this.analytics?.summary.estimated;
    this.totalEstRevenue = est?.totalRevenue ?? 0;
    this.totalEstExpense = est?.totalExpense ?? 0;
    this.estNetProfit = est?.netProfit ?? 0;
    this.estROI = est?.roi ?? 0;
    this.estPaybackMonths = est?.paybackMonth ?? null;

    const act = this.analytics?.summary.actual;
    this.totalActRevenue = act?.totalRevenue ?? 0;
    this.totalActExpense = act?.totalExpense ?? 0;
    this.actNetProfit = act?.netProfit ?? 0;
    this.actROI = act?.roi ?? 0;
    this.actPaybackMonths = act?.paybackMonth ?? null;
  }

  // จับคู่รายการจริงกับประมาณการของ "งวดเดียวกัน" ด้วย — เดิมจับจากหมวดหมู่อย่างเดียว ทำให้
  // ผลจริงเดือน 9 ไปเทียบกับประมาณการเดือน 3 และยอดประมาณการก้อนเดียวถูกนับซ้ำหลายแถว
  getEstimatedMatch(act: ProjectLedger): number {
    return this.estimatedLedger
      .filter(
        l =>
          String(l.category_id) === String(act.category_id) &&
          Number(l.type_id) === Number(act.type_id) &&
          Number(l.period_index) === Number(act.period_index)
      )
      .reduce((sum, l) => sum + Number(l.total_value || 0), 0);
  }

  // ผลลัพธ์เทียบแผน: รายจ่ายควรต่ำกว่าแผน ส่วนรายรับควรสูงกว่าแผน
  getVarianceStatus(act: ProjectLedger): 'on-target' | 'over-budget' | 'below-target' | 'no-plan' {
    const est = this.getEstimatedMatch(act);
    if (est === 0) return 'no-plan';
    const actual = Number(act.total_value);
    if (actual === est) return 'on-target';
    if (Number(act.type_id) === 1) {
      return actual > est ? 'over-budget' : 'on-target';
    }
    return actual < est ? 'below-target' : 'on-target';
  }

  getVarianceLabel(act: ProjectLedger): string {
    switch (this.getVarianceStatus(act)) {
      case 'over-budget': return 'เกินงบ';
      case 'below-target': return 'ต่ำกว่าเป้า';
      case 'no-plan': return 'ไม่มีในแผน';
      default: return 'ตามแผน';
    }
  }

  isOverBudget(act: ProjectLedger): boolean {
    const status = this.getVarianceStatus(act);
    return status === 'over-budget' || status === 'below-target';
  }

  getVariance(act: ProjectLedger): number {
    return Number(act.total_value || 0) - this.getEstimatedMatch(act);
  }

  getActualExpenses(): ProjectLedger[] {
    return this.actualLedger.filter(l => Number(l.type_id) === 1);
  }

  getActualRevenues(): ProjectLedger[] {
    return this.actualLedger.filter(l => Number(l.type_id) === 2);
  }

  getCategoryName(id: string): string {
    return this.allCategories.find(c => c.category_id === id)?.category_name || id;
  }
}
