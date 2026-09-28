import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PROJECT_STATUS_LABELS, Project, ProjectLedger } from '../../../models/roi-tracking-model';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';
import { PageHeaderService } from '../../../services/page-header.service';
import { CategoryService, Category } from '../../../services/category.service';
import {
  AnalyticsService,
  BenefitSource,
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
import { BenefitSummary, LedgerSectionEditor, LedgerSectionView } from '../shared/ledger-sections';
import { KpiCards } from '../shared/kpi-cards';

export type { LedgerRow };

@Component({
  selector: 'app-estimated-report',
  imports: [CommonModule, RouterModule, LedgerSectionEditor, LedgerSectionView, BenefitSummary, KpiCards],
  templateUrl: './estimated-report.html',
  styleUrl: '../report-shared.css',
})
export class EstimatedReport implements OnInit, OnDestroy {
  project?: Project;
  ledger: ProjectLedger[] = [];
  isLoading = false;
  isSaving = false;

  mode: 'view' | 'edit' = 'view';
  isPublic = false;
  isOwner = false; // false = กำลังดูโปรเจกต์ของคนอื่นผ่านหน้า Community (read-only)

  // ─── ผลการคำนวณ — มาจาก backend ทั้งหมด (FR04) ───────────────────────────────
  analytics?: ProjectAnalytics;
  allCategories: Category[] = [];
  savedRows: LedgerRowsBySource = { direct: [], indirect: [], cost: [] };
  draft?: LedgerDraft;

  readonly sources = SOURCE_ORDER;
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

  // ─── ค่าที่แสดงบนการ์ดสรุป: โหมดแก้ไขใช้ผลพรีวิวจากรายการที่กำลังกรอก ────────────
  get shownAnalytics(): ProjectAnalytics | undefined {
    return this.mode === 'edit' ? (this.draft?.preview ?? this.analytics) : this.analytics;
  }

  get shown(): PhaseSummary | undefined {
    return this.shownAnalytics?.summary.estimated;
  }

  get counted(): { direct: boolean; indirect: boolean } {
    return this.analytics?.summary.countedSources ?? { direct: true, indirect: true };
  }

  get targetRoi(): number | null {
    return this.analytics?.summary.targetRoi ?? null;
  }

  // FR04-4: หน้านี้เทียบเป้าหมายกับ ROI ประมาณการเสมอ (หน้า Actual เทียบกับผลจริง)
  get isWorthwhile(): boolean | null {
    if (this.targetRoi == null || !this.shown) return null;
    return this.shown.roi >= this.targetRoi;
  }

  get hasActualData(): boolean {
    return !!this.analytics?.summary.hasActualData;
  }

  get isLockedStatus(): boolean {
    const s = this.project?.project_status;
    return s === 'completed' || s === 'archived';
  }

  // แก้ประมาณการได้เฉพาะเจ้าของ ก่อนเริ่มบันทึกผลจริง และโครงการยังไม่สิ้นสุด
  get isEditable(): boolean {
    return this.isOwner && !this.hasActualData && !this.isLockedStatus;
  }

  // ส่วนที่ประเภทโครงการไม่นับ ยังแสดงอยู่ถ้ามีข้อมูลค้างไว้ (พร้อมคำเตือน) ให้ผู้ใช้ลบออกได้
  isCounted(source: BenefitSource): boolean {
    return source === 'cost' || this.counted[source];
  }

  showSection(source: BenefitSource, rows: LedgerRowsBySource | undefined): boolean {
    return this.isCounted(source) || (rows?.[source].length ?? 0) > 0;
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const queryMode = this.route.snapshot.queryParamMap.get('mode');

    this.isLoading = true;
    forkJoin({
      project: this.projectService.getProjectById(id),
      ledger: this.projectService.getLedgersByProjectId(id),
      categories: this.categoryService.getCategories(),
      analytics: this.analyticsService.getProjectAnalytics(id),
    }).subscribe({
      next: (result) => {
        this.allCategories = result.categories;
        this.project = result.project;
        this.isPublic = !!result.project.is_public;
        this.isOwner = result.project.user_id === this.authService.currentUser()?.userId;
        this.pageHeader.set('Estimated Report', result.project.project_name);
        this.applyData(result.ledger, result.analytics);
        this.isLoading = false;

        this.draft = new LedgerDraft(this.analyticsService, id, 'Estimated', () => this.allCategories);

        // มาจากการสร้างโครงการใหม่ / กดแก้ไข / ยังไม่มีข้อมูล → เข้าโหมดแก้ไขทันที (เฉพาะเจ้าของ)
        if (this.isEditable && (queryMode === 'create' || queryMode === 'edit' || this.ledger.length === 0)) {
          this.startEdit();
        }
      },
      error: () => {
        this.isLoading = false;
        Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: 'กรุณาลองใหม่อีกครั้ง' });
      },
    });
  }

  ngOnDestroy(): void {
    this.draft?.destroy();
  }

  private applyData(ledgers: ProjectLedger[], analytics: ProjectAnalytics): void {
    this.analytics = analytics;
    if (this.project) {
      this.project.project_status = analytics.project.project_status;
      this.project.calculation_method = analytics.project.calculation_method;
    }
    this.ledger = ledgers.filter((l) => l.phase === 'Estimated');
    this.savedRows = splitBySource(groupLedgers(this.ledger), this.allCategories);
  }

  // ─── Edit / View ───────────────────────────────────────────────────────────
  startEdit(): void {
    if (!this.draft) return;
    const duration = this.project?.duration_months ?? 12;
    const copy = (rows: LedgerRow[]) => rows.map((r) => ({ ...r }));
    const rows: LedgerRowsBySource = {
      direct: copy(this.savedRows.direct),
      indirect: copy(this.savedRows.indirect),
      cost: copy(this.savedRows.cost),
    };
    // ส่วนที่นับตามประเภทโครงการแต่ยังว่าง เตรียมแถวว่างไว้ให้หนึ่งแถว
    for (const source of SOURCE_ORDER) {
      const first = categoriesForSource(this.allCategories, source)[0];
      if (this.isCounted(source) && rows[source].length === 0 && first) {
        rows[source].push(blankRow(first.category_id, duration));
      }
    }
    this.draft.load(rows);
    this.mode = 'edit';
  }

  cancelEdit(): void {
    if (this.ledger.length === 0) {
      this.router.navigate(['/user/projects']);
      return;
    }
    this.mode = 'view';
  }

  // ─── Save ──────────────────────────────────────────────────────────────────
  async saveEstimated(): Promise<void> {
    if (!this.draft || !this.project) return;
    const inputs = this.draft.inputs();

    if (inputs.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูล',
        text: 'กรุณากรอกผลประโยชน์หรือต้นทุนอย่างน้อย 1 รายการ',
        confirmButtonColor: '#198754',
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: 'question',
      title: 'ยืนยันการบันทึกประมาณการ?',
      text: 'แก้ไขได้เสมอจนกว่าจะเริ่มบันทึกผลจริง (Actual)',
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#198754',
    });
    if (!confirm.isConfirmed) return;

    this.isSaving = true;
    const id = this.project.project_id;
    this.projectService.replaceLedgerInputs(id, 'Estimated', inputs).subscribe({
      next: () => {
        forkJoin({
          ledger: this.projectService.getLedgersByProjectId(id),
          analytics: this.analyticsService.getProjectAnalytics(id),
        }).subscribe(({ ledger, analytics }) => {
          this.applyData(ledger, analytics);
          this.isSaving = false;
          this.mode = 'view';
          Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1600, showConfirmButton: false });
        });
      },
      error: (err) => {
        this.isSaving = false;
        Swal.fire({
          icon: 'error',
          title: 'บันทึกไม่สำเร็จ',
          text: err.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
          confirmButtonColor: '#dc3545',
        });
      },
    });
  }

  // ─── พิมพ์ / บันทึกเป็น PDF ────────────────────────────────────────────────
  printReport(): void {
    window.print();
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

    this.projectService.toggleVisibility(this.project!.project_id, newState).subscribe({
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
}
