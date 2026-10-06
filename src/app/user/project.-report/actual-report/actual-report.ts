import { Component, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { PROJECT_STATUS_LABELS, Project, ProjectLedger } from '../../../models/roi-tracking-model';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';
import { PageHeaderService } from '../../../services/page-header.service';
import { CategoryService, Category } from '../../../services/category.service';
import {
  AnalyticsService,
  BenefitSource,
  CategoryBreakdown,
  PhaseSummary,
  ProjectAnalytics,
} from '../../../services/analytics.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import {
  LedgerRow,
  LedgerRowsBySource,
  SOURCE_ORDER,
  blankRow,
  categoriesForSource,
  calendarMonth,
  groupLedgers,
  itemKey,
  splitBySource,
  toPlan,
} from '../ledger-row.util';
import { LedgerDraft } from '../ledger-draft';
import { BenefitSummary, LedgerSectionEditor, LedgerSectionView, SECTION_META } from '../shared/ledger-sections';
import { KpiCards } from '../shared/kpi-cards';
import { CashflowChart } from '../shared/cashflow-chart';
import { BahtPipe } from '../shared/baht.pipe';
import { PctPipe } from '../shared/pct.pipe';
import { showReportLoadError } from '../shared/load-error';
import {
  PlanComparison,
  comparePlan,
  planComparisonClass,
  planComparisonIcon,
  planComparisonLabel,
} from '../shared/plan-compare';

export type { LedgerRow };

// หนึ่งแถวของตาราง "แผน vs จริง" — null = คำนวณไม่ได้ (เช่น ยังไม่มีผลประโยชน์ เลยไม่มีระยะคืนทุน)
interface CompareRow {
  label: string;
  plan: number | null;
  actual: number | null;
  unit: 'percent' | 'baht' | 'months';
  higherIsBetter: boolean;
}

@Component({
  selector: 'app-actual-report',
  imports: [
    CommonModule, RouterModule, BaseChartDirective, LedgerSectionEditor, LedgerSectionView, BenefitSummary, KpiCards,
    CashflowChart, BahtPipe, PctPipe,
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './actual-report.html',
  styleUrl: '../report-shared.css',
})
export class ActualReport implements OnInit, OnDestroy {
  projectId!: number;
  project?: Project;
  isLoading = false;
  isSaving = false;

  estimatedLedger: ProjectLedger[] = [];
  actualLedger: ProjectLedger[] = [];

  mode: 'view' | 'edit' = 'view';
  isOwner = false; // false = กำลังดูโปรเจกต์ของคนอื่นผ่านหน้า Community (read-only)
  isPublic = false;

  analytics?: ProjectAnalytics;
  allCategories: Category[] = [];
  savedRows: LedgerRowsBySource = { direct: [], indirect: [], cost: [] };
  draft?: LedgerDraft;

  readonly sources = SOURCE_ORDER;
  showMonthlyTable = false; // ตารางตัวเลขรายเดือนพับเก็บไว้ก่อน — ตอนพิมพ์แสดงเต็ม
  readonly sectionMeta = SECTION_META;
  readonly statusLabels = PROJECT_STATUS_LABELS;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    public authService: AuthService,
    private pageHeader: PageHeaderService,
    private categoryService: CategoryService,
    private analyticsService: AnalyticsService
  ) {}

  // ─── ค่าที่แสดง — โหมดแก้ไขใช้ผลพรีวิวจากรายการที่กำลังกรอก ───────────────────
  get shownAnalytics(): ProjectAnalytics | undefined {
    return this.mode === 'edit' ? (this.draft?.preview ?? this.analytics) : this.analytics;
  }

  get shown(): PhaseSummary | undefined {
    return this.shownAnalytics?.summary.actual;
  }

  get est(): PhaseSummary | undefined {
    return this.analytics?.summary.estimated;
  }

  get act(): PhaseSummary | undefined {
    return this.analytics?.summary.actual;
  }

  get counted(): { direct: boolean; indirect: boolean } {
    return this.analytics?.summary.countedSources ?? { direct: true, indirect: true };
  }

  get targetRoi(): number | null {
    return this.analytics?.summary.targetRoi ?? null;
  }

  // ความคุ้มค่ามาจาก backend: ผลจริงยังไม่ครบ → ใช้ "คาดการณ์ทั้งโครงการ" (ผลจริง + แผนเดือนที่เหลือ)
  // เพราะเป้า ROI ตั้งไว้สำหรับทั้งโครงการ ถ้าเทียบ ROI ของผลจริงแค่บางเดือนจะไม่คุ้มค่าแทบทุกโครงการ
  get isWorthwhile(): boolean | null {
    return this.shownAnalytics?.summary.isWorthwhile ?? null;
  }

  get worthwhileBasis(): 'actual' | 'estimated' | 'projected' | undefined {
    return this.shownAnalytics?.summary.worthwhileBasis;
  }

  get projected() {
    return this.shownAnalytics?.summary.projected;
  }

  get worthwhileNote(): string {
    return this.worthwhileBasis === 'projected' ? 'คาดการณ์ทั้งโครงการ' : '';
  }

  get lastActualPeriod(): number {
    return this.analytics?.summary.lastActualPeriod ?? 0;
  }

  get isLockedStatus(): boolean {
    const s = this.project?.project_status;
    return s === 'completed' || s === 'archived';
  }

  get canEdit(): boolean {
    return this.isOwner && !this.isLockedStatus;
  }

  isCounted(source: BenefitSource): boolean {
    return source === 'cost' || this.counted[source];
  }

  showSection(source: BenefitSource, rows: LedgerRowsBySource | undefined): boolean {
    return this.isCounted(source) || (rows?.[source].length ?? 0) > 0;
  }

  ngOnInit(): void {
    this.projectId = Number(this.route.snapshot.paramMap.get('id'));
    const queryMode = this.route.snapshot.queryParamMap.get('mode');
    this.draft = new LedgerDraft(this.analyticsService, this.projectId, 'Actual', () => this.allCategories);
    this.loadData(queryMode === 'create' || queryMode === 'edit');
  }

  ngOnDestroy(): void {
    this.draft?.destroy();
  }

  loadData(openEdit = false): void {
    this.isLoading = true;
    forkJoin({
      project: this.projectService.getProjectById(this.projectId),
      ledgers: this.projectService.getLedgersByProjectId(this.projectId),
      categories: this.categoryService.getCategories(),
      analytics: this.analyticsService.getProjectAnalytics(this.projectId),
    }).subscribe({
      next: (result) => {
        this.allCategories = result.categories;
        this.analytics = result.analytics;
        this.project = result.project;
        this.isOwner = result.project.user_id === this.authService.currentUser()?.userId;
        this.isPublic = !!result.project.is_public;
        this.pageHeader.set('Actual Report', result.project.project_name);
        this.estimatedLedger = result.ledgers.filter((l) => l.phase === 'Estimated');
        this.actualLedger = result.ledgers.filter((l) => l.phase === 'Actual');
        this.savedRows = splitBySource(groupLedgers(this.actualLedger), this.allCategories);
        this.isLoading = false;

        if (this.canEdit && (openEdit || this.actualLedger.length === 0)) {
          this.startEdit();
        } else {
          this.mode = 'view';
        }
      },
      error: (err) => {
        this.isLoading = false;
        showReportLoadError(err, this.router);
      },
    });
  }

  // ─── Edit / View ───────────────────────────────────────────────────────────
  startEdit(): void {
    if (!this.draft) return;
    const planned = groupLedgers(this.estimatedLedger);

    // แต่ละรายการผลจริงจับคู่กับรายการแผนเดียวกัน (หมวด + ชื่อรายการ) ที่ช่วงเดือนทับกัน
    // เพื่อโชว์ค่าตามแผนเป็นตัวอักษรจางๆ ในช่องกรอก
    const overlaps = (a: LedgerRow, b: LedgerRow) => a.period_from <= b.period_to && b.period_from <= a.period_to;
    const findPlan = (row: LedgerRow) => {
      const same = planned.filter((p) => itemKey(p) === itemKey(row));
      return same.find((p) => overlaps(p, row)) ?? same[0];
    };

    const actualRows = groupLedgers(this.actualLedger).map((r) => {
      const plan = findPlan(r);
      return { ...r, plan: plan ? toPlan(plan) : undefined };
    });

    // รายการตามแผนที่ยังไม่มีผลจริง → เตรียมช่องว่างไว้ให้ (จำนวนช่องเท่ากับแผน) ช่วงเดือนและ
    // หมายเหตุเหมือนแผน ส่วนตัวเลขเว้นว่างให้กรอกผลจริง (เห็นค่าตามแผนเป็น placeholder)
    const pending = planned
      .filter((p) => !actualRows.some((a) => itemKey(a) === itemKey(p) && overlaps(a, p)))
      .map((p) => ({ ...p, total_value: null, unit_qty: null, unit_cost: null, plan: toPlan(p) }));

    const rows = splitBySource([...actualRows, ...pending].sort(
      (a, b) => a.period_from - b.period_from || a.category_id.localeCompare(b.category_id)
    ), this.allCategories);

    for (const source of SOURCE_ORDER) {
      const first = categoriesForSource(this.allCategories, source)[0];
      if (this.isCounted(source) && rows[source].length === 0 && first) {
        rows[source].push(blankRow(first.category_id, this.project?.duration_months ?? 12));
      }
    }
    this.draft.load(rows);
    this.mode = 'edit';
  }

  cancelEdit(): void {
    if (this.actualLedger.length === 0) {
      this.router.navigate(['/user/estimated-report', this.projectId]);
      return;
    }
    this.mode = 'view';
  }

  // ─── Save Actual ───────────────────────────────────────────────────────────
  async saveActual(): Promise<void> {
    if (!this.draft) return;
    const inputs = this.draft.inputs();

    if (inputs.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูล',
        text: 'กรุณากรอกผลประโยชน์หรือต้นทุนจริงอย่างน้อย 1 รายการ',
        confirmButtonColor: '#198754',
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: 'question',
      title: 'ยืนยันการบันทึกผลจริง?',
      text: 'ผลจริงจะถูกนำไปเปรียบเทียบกับประมาณการ และประมาณการจะถูกล็อกไม่ให้แก้ไข',
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#198754',
    });
    if (!confirm.isConfirmed) return;

    this.isSaving = true;
    this.projectService.replaceLedgerInputs(this.projectId, 'Actual', inputs).subscribe({
      next: () => {
        this.isSaving = false;
        Swal.fire({ icon: 'success', title: 'บันทึก Actual สำเร็จ!', timer: 1600, showConfirmButton: false });
        this.loadData();
      },
      error: (err) => {
        this.isSaving = false;
        Swal.fire({
          icon: 'error',
          title: 'บันทึกไม่สำเร็จ',
          text: err.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
        });
      },
    });
  }

  // ─── สถานะโครงการ: ปิด/เปิดโครงการอีกครั้ง ────────────────────────────────────
  async changeStatus(status: 'completed' | 'in_progress'): Promise<void> {
    const closing = status === 'completed';
    const confirm = await Swal.fire({
      icon: 'question',
      title: closing ? 'ปิดโครงการ (Completed)?' : 'เปิดโครงการอีกครั้ง?',
      text: closing
        ? 'ข้อมูลทั้งหมดจะถูกล็อกไม่ให้แก้ไข (เปิดกลับมาแก้ได้ภายหลัง)'
        : 'สถานะจะกลับเป็น Actual และแก้ไขผลจริงได้อีกครั้ง',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#198754',
    });
    if (!confirm.isConfirmed) return;

    this.projectService.updateProjectStatus(this.projectId, status).subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: 'อัปเดตสถานะแล้ว', timer: 1400, showConfirmButton: false });
        this.loadData();
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: err.error?.message }),
    });
  }

  // ─── พิมพ์ / บันทึกเป็น PDF ────────────────────────────────────────────────
  // <canvas> ของ Chart.js วาดใหม่เมื่อขนาดกล่องเปลี่ยน พอสลับไป layout ของกระดาษ กราฟมักจะ
  // ออกมาว่างเปล่า — แปลงกราฟเป็นรูปก่อนสั่งพิมพ์ แล้วให้ CSS โชว์รูปแทน canvas ตอนพิมพ์
  @ViewChildren(BaseChartDirective) private chartDirectives?: QueryList<BaseChartDirective>;
  @ViewChild(CashflowChart) private cashflowChart?: CashflowChart;
  chartImages: string[] = [];

  printReport(): void {
    this.chartImages = (this.chartDirectives?.toArray() ?? []).map((d) => d.chart?.toBase64Image() ?? '');
    this.cashflowChart?.prepareForPrint();

    // ล้างรูปหลังปิดหน้าต่างพิมพ์ — บางเบราว์เซอร์ window.print() คืนค่าทันที ถ้าล้างก่อนกราฟจะหาย
    const restore = () => {
      this.chartImages = [];
      this.cashflowChart?.clearPrintImage();
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
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
      confirmButtonColor: '#198754',
    });
    if (!result.isConfirmed) return;

    this.projectService.toggleVisibility(this.projectId, newState).subscribe({
      next: () => {
        this.isPublic = newState;
        Swal.fire({
          icon: 'success',
          title: newState ? 'เปลี่ยนเป็นสาธารณะแล้ว' : 'เปลี่ยนเป็นส่วนตัวแล้ว',
          timer: 1500,
          showConfirmButton: false,
        });
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: err.error?.message }),
    });
  }

  monthName(period: number | null | undefined): string {
    return period ? calendarMonth(this.project?.created_at, period) : '';
  }

  // ═══ แผน vs จริง แบบอ่านง่าย — เทียบกับแผน "ถึงเดือนเดียวกัน" (ตัวเลขจาก backend) ═══
  get compareRows(): CompareRow[] {
    const plan = this.analytics?.summary.estimatedToDate;
    const act = this.act;
    if (!plan || !act) return [];
    return [
      { label: 'ROI', plan: plan.roi, actual: act.roi, unit: 'percent', higherIsBetter: true },
      { label: 'ผลประโยชน์รวม', plan: plan.totalRevenue, actual: act.totalRevenue, unit: 'baht', higherIsBetter: true },
      { label: 'ต้นทุนรวม', plan: plan.totalExpense, actual: act.totalExpense, unit: 'baht', higherIsBetter: false },
      { label: 'ผลประโยชน์สุทธิ', plan: plan.netProfit, actual: act.netProfit, unit: 'baht', higherIsBetter: true },
      // คืนทุนเร็วกว่า (จำนวนเดือนน้อยกว่า) = ดี
      { label: 'ระยะคืนทุน', plan: plan.paybackMonths, actual: act.paybackMonths, unit: 'months', higherIsBetter: false },
    ];
  }

  // ผลของแต่ละแถว: ต่ำกว่าแผน / เท่ากับแผน / สูงกว่าแผน (ROI ถือว่าเท่ากันถ้าต่างไม่ถึง 0.05%)
  rowResult(row: CompareRow): PlanComparison | null {
    if (row.actual == null || row.plan == null) return null; // คำนวณไม่ได้ฝั่งใดฝั่งหนึ่ง → ไม่ตัดสิน
    return comparePlan(row.actual, row.plan, row.unit === 'baht' ? 0.5 : 0.05);
  }

  // สรุปภาพรวมด้านบน: ROI จริงเทียบกับแผนช่วงเดียวกัน
  get overallResult(): PlanComparison | null {
    const plan = this.analytics?.summary.estimatedToDate;
    if (!plan || !this.act || !this.lastActualPeriod) return null;
    if (this.act.roi == null || plan.roi == null) {
      return comparePlan(this.act.netProfit, plan.netProfit); // ROI คำนวณไม่ได้ → เทียบผลประโยชน์สุทธิแทน
    }
    return comparePlan(this.act.roi, plan.roi, 0.05);
  }

  readonly comparisonLabel = planComparisonLabel;
  readonly comparisonIcon = planComparisonIcon;
  readonly comparisonClass = planComparisonClass;

  // ═══ FR05-2: เปรียบเทียบแผน vs จริง รายหมวด (ตัวเลขจาก backend) ══════════════
  categoriesOf(source: BenefitSource): CategoryBreakdown[] {
    return (this.analytics?.byCategory ?? []).filter((c) => c.source === source);
  }

  // รายหมวด: เทียบกับแผนถึงเดือนเดียวกัน — สีบอกดี/ไม่ดี (ต้นทุนสูงกว่าแผน = แดง)
  categoryResult(c: CategoryBreakdown): PlanComparison {
    return comparePlan(c.actual, c.estimatedToDate);
  }

  categoryLabel(c: CategoryBreakdown): string {
    if (c.estimatedToDate === 0 && c.actual > 0) return 'ไม่มีในแผน';
    return planComparisonLabel(this.categoryResult(c));
  }

  categoryClass(c: CategoryBreakdown): string {
    if (c.estimatedToDate === 0 && c.actual > 0) return 'bg-light text-muted border';
    return planComparisonClass(this.categoryResult(c), c.source !== 'cost');
  }

  // สีตัวเลขส่วนต่าง: เขียว = ดีต่อโครงการ, แดง = ไม่ดี, เทา = เท่ากับแผน
  varianceTextClass(c: CategoryBreakdown): string {
    const result = this.categoryResult(c);
    if (result === 'equal') return 'text-muted';
    return (result === 'above') === (c.source !== 'cost') ? 'text-success' : 'text-danger';
  }

  sumOf(list: CategoryBreakdown[], key: 'estimated' | 'estimatedToDate' | 'actual' | 'varianceToDate'): number {
    return list.reduce((s, c) => s + c[key], 0);
  }

  // ═══ FR05-1: กราฟสรุปผล ════════════════════════════════════════════════════
  // กราฟแท่ง: ผลประโยชน์รายหมวดที่นับตามประเภทโครงการ (แผนถึงเดือนเดียวกัน vs จริง)
  get benefitChartData(): ChartConfiguration<'bar'>['data'] {
    const benefits = (this.analytics?.byCategory ?? []).filter((c) => c.source !== 'cost' && c.counted);
    return {
      labels: benefits.map((c) => c.category_name),
      datasets: [
        {
          label: 'ประมาณการ (ถึงเดือนเดียวกัน)',
          data: benefits.map((c) => c.estimatedToDate),
          backgroundColor: 'rgba(108,117,125,.55)',
          borderRadius: 6,
        },
        {
          label: 'เกิดขึ้นจริง',
          data: benefits.map((c) => c.actual),
          backgroundColor: benefits.map((c) => (c.source === 'indirect' ? '#0f7b8a' : '#198754')),
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
}
