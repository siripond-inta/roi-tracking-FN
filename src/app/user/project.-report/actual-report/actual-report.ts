import { Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { PROJECT_STATUS_LABELS, Project, ProjectLedger } from '../../../models/roi-tracking-model';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
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
  groupLedgers,
  splitBySource,
} from '../ledger-row.util';
import { LedgerDraft } from '../ledger-draft';
import { BenefitSummary, LedgerSectionEditor, LedgerSectionView, SECTION_META } from '../shared/ledger-sections';
import { KpiCards } from '../shared/kpi-cards';

export type { LedgerRow };

@Component({
  selector: 'app-actual-report',
  imports: [CommonModule, RouterModule, BaseChartDirective, LedgerSectionEditor, LedgerSectionView, BenefitSummary, KpiCards],
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

  get isWorthwhile(): boolean | null {
    if (this.targetRoi == null || !this.shown) return null;
    return this.shown.roi >= this.targetRoi;
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
      error: () => {
        this.isLoading = false;
        Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: 'กรุณาลองใหม่อีกครั้ง' });
      },
    });
  }

  // ─── Edit / View ───────────────────────────────────────────────────────────
  startEdit(): void {
    if (!this.draft) return;
    const duration = this.project?.duration_months ?? 12;
    let rows: LedgerRowsBySource;

    if (this.actualLedger.length > 0) {
      const copy = (list: LedgerRow[]) => list.map((r) => ({ ...r }));
      rows = { direct: copy(this.savedRows.direct), indirect: copy(this.savedRows.indirect), cost: copy(this.savedRows.cost) };
    } else {
      // ครั้งแรก: เตรียมรายการตามแผน (หมวด + อัตราต่อหน่วยเดิม) แต่ให้กรอกยอด/ปริมาณจริงเอง
      // ช่วงเดือนตั้งเป็นเดือนที่ 1 ไว้ก่อน ผู้ใช้ขยายช่วงตามเดือนที่เกิดขึ้นจริง
      const planned = splitBySource(groupLedgers(this.estimatedLedger), this.allCategories);
      const seen = new Set<string>();
      const blankFrom = (r: LedgerRow): LedgerRow => ({
        ...r,
        period_from: 1,
        period_to: 1,
        total_value: null,
        unit_qty: null,
        unit_cost: r.unit_cost,
        note: r.note,
      });
      const uniq = (list: LedgerRow[]) =>
        list.filter((r) => {
          const k = `${r.category_id}|${r.note}|${r.unit_cost ?? ''}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      rows = {
        direct: uniq(planned.direct).map(blankFrom),
        indirect: uniq(planned.indirect).map(blankFrom),
        cost: uniq(planned.cost).map(blankFrom),
      };
    }

    for (const source of SOURCE_ORDER) {
      const first = categoriesForSource(this.allCategories, source)[0];
      if (this.isCounted(source) && rows[source].length === 0 && first) {
        rows[source].push(blankRow(first.category_id, 1));
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
      title: closing ? 'สิ้นสุดโครงการ?' : 'เปิดโครงการอีกครั้ง?',
      text: closing
        ? 'ข้อมูลทั้งหมดจะถูกล็อกไม่ให้แก้ไข (เปิดกลับมาแก้ได้ภายหลัง)'
        : 'สถานะจะกลับเป็น "กำลังดำเนินการ" และแก้ไขผลจริงได้อีกครั้ง',
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
  chartImages: string[] = [];

  printReport(): void {
    this.chartImages = (this.chartDirectives?.toArray() ?? []).map((d) => d.chart?.toBase64Image() ?? '');

    // ล้างรูปหลังปิดหน้าต่างพิมพ์ — บางเบราว์เซอร์ window.print() คืนค่าทันที ถ้าล้างก่อนกราฟจะหาย
    const restore = () => {
      this.chartImages = [];
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

  // ═══ FR05-2: เปรียบเทียบแผน vs จริง รายหมวด (ตัวเลขจาก backend) ══════════════
  categoriesOf(source: BenefitSource): CategoryBreakdown[] {
    return (this.analytics?.byCategory ?? []).filter((c) => c.source === source);
  }

  // ผลจริงดีกว่าแผนไหม: ผลประโยชน์ควรสูงกว่าแผน ต้นทุนควรต่ำกว่าแผน (เทียบกับแผนถึงเดือนเดียวกัน)
  varianceGood(c: CategoryBreakdown): boolean {
    return c.source === 'cost' ? c.varianceToDate <= 0 : c.varianceToDate >= 0;
  }

  varianceLabel(c: CategoryBreakdown): string {
    if (c.estimatedToDate === 0 && c.actual > 0) return 'ไม่มีในแผน';
    if (c.varianceToDate === 0) return 'ตามแผน';
    if (c.source === 'cost') return c.varianceToDate > 0 ? 'เกินงบ' : 'ต่ำกว่างบ';
    return c.varianceToDate > 0 ? 'สูงกว่าเป้า' : 'ต่ำกว่าเป้า';
  }

  sumOf(list: CategoryBreakdown[], key: 'estimated' | 'estimatedToDate' | 'actual' | 'varianceToDate'): number {
    return list.reduce((s, c) => s + c[key], 0);
  }

  // ═══ FR05-1: กราฟสรุปผล ════════════════════════════════════════════════════
  // กราฟเส้น: แนวโน้ม ROI สะสมรายเดือน (แผน vs จริง)
  get roiTrendChartData(): ChartConfiguration<'line'>['data'] {
    const monthly = this.analytics?.monthly ?? [];

    // ROI สะสม ณ สิ้นเดือนนั้นๆ = (ผลประโยชน์สะสม − ต้นทุนสะสม) / ต้นทุนสะสม × 100
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

    // ผลจริงลากเส้นเฉพาะเดือนที่บันทึกแล้ว เดือนที่ยังไม่ถึงปล่อยว่าง (null)
    const actualSeries = cumulativeRoi((m) => m.actual).map((v, i) =>
      monthly[i].period <= this.lastActualPeriod ? v : null
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
      y: { ticks: { callback: (v) => `${v}%` }, grid: { color: 'rgba(0,0,0,.05)' } },
      x: { grid: { display: false } },
    },
  };

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
