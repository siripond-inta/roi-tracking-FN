import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Project, ProjectLedger } from '../../../models/roi-tracking-model';
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
  selector: 'app-estimated-report',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './estimated-report.html',
  styleUrl: './estimated-report.css',
})
export class EstimatedReport implements OnInit {
  project?: Project;
  ledger: ProjectLedger[] = [];
  isLoading = false;
  isSaving = false;

  mode: 'view' | 'edit' = 'view';
  isPublic = false;
  isOwner = false; // false = กำลังดูโปรเจกต์ของคนอื่นผ่านหน้า Community (read-only)

  // แถวสำหรับกรอกข้อมูลแยก 2 ฝั่ง
  revenueRows: LedgerRow[] = [];
  expenseRows: LedgerRow[] = [];

  // ─── KPI Metrics — คำนวณโดย backend ทั้งหมด (FR04) ────────────────────────────
  analytics?: ProjectAnalytics;
  totalEstRevenue = 0;
  totalEstExpense = 0;
  estNetProfit = 0;
  estROI = 0;
  estPaybackMonths: number | null = null;

  // ─── หมวดหมู่ (ดึงจาก database ผ่าน API) ────────────────────────────────────
  allCategories: Category[] = [];
  get revenueCategories(): Category[] {
    return this.allCategories.filter(c => c.is_inflow);
  }
  get expenseCategories(): Category[] {
    return this.allCategories.filter(c => !c.is_inflow);
  }

  // ─── ตัวช่วยของฟอร์มรายแถว (ใช้ร่วมกับหน้า Actual Report) ──────────────────
  get periods(): number[] {
    return periodOptions(this.project?.duration_months);
  }

  categoryOf(row: LedgerRow): Category | undefined {
    return findCategory(this.allCategories, row.category_id);
  }

  // FR03-4: หมวดประโยชน์ทางอ้อมกรอกเป็น "ปริมาณ × อัตรา" แทนยอดเงินตรงๆ
  isQtyRow(row: LedgerRow): boolean {
    return isQtyBased(this.categoryOf(row));
  }

  rowAmount(row: LedgerRow): number {
    return rowTotal(row, this.allCategories);
  }

  // เปลี่ยนหมวดหมู่แล้วรูปแบบการกรอกอาจเปลี่ยน (ยอดเงิน ↔ ปริมาณ×อัตรา)
  // สำคัญ: ต้องไม่ทำให้ยอดที่กรอกไว้แล้วหายไป — เก็บยอดเดิมไว้เสมอ ผู้ใช้จะได้ไม่เสียข้อมูล
  // เพราะเผลอเลือกหมวดผิดแล้วเลือกกลับ (แถวที่ยอดเป็น 0 จะถูกข้ามตอนบันทึกด้วย)
  onCategoryChange(row: LedgerRow): void {
    const previousAmount = this.rowAmount(row);
    if (this.isQtyRow(row)) {
      // ยังไม่ต้องล้าง total_value — rowTotal จะใช้ยอดเดิมไปก่อนจนกว่าจะกรอกปริมาณ/อัตรา
      row.total_value = previousAmount;
    } else {
      // กลับมาเป็นหมวดยอดเงิน: ย้ายยอดที่คำนวณได้จาก ปริมาณ×อัตรา มาเป็นยอดเงินตรงๆ
      row.unit_qty = null;
      row.unit_cost = null;
      row.total_value = previousAmount;
    }
  }

  // ─── Real-time Calculations (คำนวณสดอัตโนมัติขณะกรอก) ───────────────────────
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

  // FR04-3: ระยะเวลาคืนทุน = เดือนแรกที่กระแสเงินสดสะสม >= เงินลงทุนเริ่มต้น
  // (คำนวณสดจากแถวที่กำลังกรอก ให้ผู้ใช้เห็นผลทันทีก่อนกดบันทึก — ตรรกะเดียวกับฝั่ง backend)
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

  // FR04-4: สถานะคุ้มค่า/ไม่คุ้มค่า เทียบ ROI กับเป้าหมายของโครงการ
  get targetRoi(): number | null {
    return this.project?.target_roi_percent ?? null;
  }

  get isWorthwhile(): boolean | null {
    if (this.targetRoi == null) return null;
    return this.displayedROI >= this.targetRoi;
  }

  // ตัวเลขสรุปที่จะแสดงบน 6 การ์ดด้านบน (สลับระหว่างค่าสดในโหมดแก้ไข กับค่าที่บันทึกในโหมดดูผล)
  get displayedRevenue(): number {
    return this.mode === 'edit' ? this.liveRevenue : this.totalEstRevenue;
  }

  get displayedExpense(): number {
    return this.mode === 'edit' ? this.liveExpense : this.totalEstExpense;
  }

  get displayedNet(): number {
    return this.mode === 'edit' ? this.liveNet : this.estNetProfit;
  }

  get displayedROI(): number {
    return this.mode === 'edit' ? this.liveROI : this.estROI;
  }

  get displayedPayback(): number | null {
    return this.mode === 'edit' ? this.livePaybackMonths : this.estPaybackMonths;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private authService: AuthService,
    private pageHeader: PageHeaderService,
    private categoryService: CategoryService,
    private analyticsService: AnalyticsService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const queryMode = this.route.snapshot.queryParamMap.get('mode');

    this.isLoading = true;
    forkJoin({
      project: this.projectService.getProjectById(id),
      ledger: this.projectService.getLedgersByProjectId(id),
      categories: this.categoryService.getCategories(),
      analytics: this.analyticsService.getProjectAnalytics(id)
    }).subscribe({
      next: (result) => {
        this.allCategories = result.categories;
        this.analytics = result.analytics;
        this.project = result.project;
        this.isPublic = !!result.project.is_public;
        this.isOwner = result.project.user_id === this.authService.currentUser()?.userId;
        this.pageHeader.set('Estimated Report', result.project.project_name);
        this.ledger = result.ledger.filter(l => l.phase === 'Estimated');
        this.calculateMetrics();
        this.isLoading = false;

        // ถ้ามาด้วย mode=create หรือ mode=edit หรือยังไม่มี ledger ให้เข้าสู่โหมดแก้ไขทันที
        // (เฉพาะเจ้าของเท่านั้น — ผู้ที่เข้ามาดูผ่านหน้า Community ต้องเห็นแค่โหมดดูอย่างเดียว)
        if (this.isOwner && (queryMode === 'create' || queryMode === 'edit' || this.ledger.length === 0)) {
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

  // ─── Edit / View Modes ─────────────────────────────────────────────────────
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

  startEdit(): void {
    const revs = this.ledger.filter(l => Number(l.type_id) === 2);
    this.revenueRows = revs.length > 0
      ? revs.map(l => this.toEditableRow(l, 2))
      : [this.newBlankRevenueRow()];

    const exps = this.ledger.filter(l => Number(l.type_id) === 1);
    this.expenseRows = exps.length > 0
      ? exps.map(l => this.toEditableRow(l, 1))
      : [this.newBlankExpenseRow()];

    this.mode = 'edit';
  }

  cancelEdit(): void {
    if (this.ledger.length === 0) {
      // ยังไม่เคยบันทึกเลย ให้กลับไปหน้าโปรเจกต์
      this.router.navigate(['/user/projects']);
      return;
    }
    this.mode = 'view';
    this.revenueRows = [];
    this.expenseRows = [];
  }

  // ─── Add / Remove Rows ─────────────────────────────────────────────────────
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

  removeRevenueRow(index: number): void {
    this.revenueRows.splice(index, 1);
    if (this.revenueRows.length === 0) {
      this.revenueRows.push(this.newBlankRevenueRow());
    }
  }

  addExpenseRow(): void {
    this.expenseRows.push(this.newBlankExpenseRow());
  }

  removeExpenseRow(index: number): void {
    this.expenseRows.splice(index, 1);
    if (this.expenseRows.length === 0) {
      this.expenseRows.push(this.newBlankExpenseRow());
    }
  }

  // ─── Save Estimated ────────────────────────────────────────────────────────
  async saveEstimated(): Promise<void> {
    const allRows = [...this.revenueRows, ...this.expenseRows];
    // กรองแถวที่มีการกรอกจำนวนเงิน > 0 (หมวดแบบปริมาณคิดจาก qty × rate ให้แล้ว)
    const validRows = allRows.filter(r => this.rowAmount(r) > 0);

    if (validRows.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูล',
        text: 'กรุณากรอกจำนวนเงินอย่างน้อย 1 รายการ (รายรับ หรือ รายจ่าย)',
        confirmButtonColor: '#198754'
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: 'question',
      title: 'ยืนยันการบันทึก Estimated?',
      text: 'ข้อมูลประมาณการจะถูกบันทึก คุณสามารถกดปุ่ม "แก้ไข" ได้เสมอจนกว่าจะเริ่มบันทึก Actual',
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#198754'
    });
    if (!confirm.isConfirmed) return;

    this.isSaving = true;
    const projectId = this.project!.project_id;
    const ledgersPayload = validRows.map(r => toPayload(r, this.allCategories, this.project?.created_at));

    const isFirstSave = this.ledger.length === 0;

    if (isFirstSave) {
      this.http.post<any>(
        `http://localhost:3000/api/projects/${projectId}/ledgers`,
        { phase: 'Estimated', ledgers: ledgersPayload }
      ).subscribe({
        next: () => this.afterSave(),
        error: (err) => this.handleSaveError(err)
      });
    } else {
      this.http.put<any>(
        `http://localhost:3000/api/projects/${projectId}/ledgers/estimated`,
        { ledgers: ledgersPayload }
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
      title: 'บันทึกสำเร็จ!',
      text: 'ข้อมูลประมาณการถูกบันทึกเรียบร้อยแล้ว',
      timer: 1800,
      showConfirmButton: false
    });

    const id = this.project!.project_id;
    forkJoin({
      ledger: this.projectService.getLedgersByProjectId(id),
      analytics: this.analyticsService.getProjectAnalytics(id)
    }).subscribe(({ ledger, analytics }) => {
      this.ledger = ledger.filter(l => l.phase === 'Estimated');
      this.analytics = analytics;
      this.calculateMetrics();
      this.mode = 'view';
      this.revenueRows = [];
      this.expenseRows = [];
    });
  }

  private handleSaveError(err: any): void {
    this.isSaving = false;
    Swal.fire({
      icon: 'error',
      title: 'บันทึกไม่สำเร็จ',
      text: err.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
      confirmButtonColor: '#dc3545'
    });
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

    this.projectService.toggleVisibility(this.project!.project_id, newState).subscribe({
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

  // ─── KPI (View Mode) — ใช้ตัวเลขที่ backend คำนวณให้ ไม่คำนวณซ้ำที่นี่ ─────────
  private calculateMetrics(): void {
    const est = this.analytics?.summary.estimated;
    this.totalEstRevenue = est?.totalRevenue ?? 0;
    this.totalEstExpense = est?.totalExpense ?? 0;
    this.estNetProfit = est?.netProfit ?? 0;
    this.estROI = est?.roi ?? 0;
    this.estPaybackMonths = est?.paybackMonth ?? null;
  }

  getExpenses(): ProjectLedger[] {
    return this.ledger.filter(l => Number(l.type_id) === 1);
  }

  getRevenues(): ProjectLedger[] {
    return this.ledger.filter(l => Number(l.type_id) === 2);
  }

  get isEditable(): boolean {
    return this.isOwner && this.project?.status !== 'Actual';
  }

  getCategoryName(id: string): string {
    return this.allCategories.find(c => c.category_id === id)?.category_name || id;
  }
}
