import { Component, OnInit } from '@angular/core';
import { Project, ProjectLedger } from '../../../models/roi-tracking-model';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';
import { PageHeaderService } from '../../../services/page-header.service';
import { CategoryService, Category } from '../../../services/category.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

export interface LedgerRow {
  ledger_id?: number;
  category_id: string;
  transaction_date: string;
  total_value: number | null;
  note: string;
  type_id: number;
}

@Component({
  selector: 'app-actual-report',
  imports: [CommonModule, RouterModule, FormsModule],
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

  // ─── Real-time Live Calculations ───────────────────────────────────────────
  get liveRevenue(): number {
    return this.revenueRows.reduce((s, r) => s + (Number(r.total_value) || 0), 0);
  }

  get liveExpense(): number {
    return this.expenseRows.reduce((s, r) => s + (Number(r.total_value) || 0), 0);
  }

  get liveNet(): number {
    return this.liveRevenue - this.liveExpense;
  }

  get liveROI(): number {
    if (this.liveExpense <= 0) return 0;
    return ((this.liveRevenue - this.liveExpense) / this.liveExpense) * 100;
  }

  get livePaybackMonths(): number | null {
    const duration = Number(this.project?.duration_months || 0);
    const m = duration > 0 ? this.liveRevenue / duration : 0;
    return (m > 0 && this.liveExpense > 0) ? this.liveExpense / m : null;
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
      categories: this.categoryService.getCategories()
    }).subscribe({
      next: (result) => {
        this.allCategories = result.categories;
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
  startEdit(): void {
    const today = this.getDefaultDate();

    if (this.actualLedger.length > 0) {
      // โหลด Actual ที่เคยบันทึกไว้
      const revs = this.actualLedger.filter(l => Number(l.type_id) === 2);
      this.revenueRows = revs.length > 0 ? revs.map(l => ({
        ledger_id: l.ledger_id,
        category_id: String(l.category_id),
        transaction_date: l.transaction_date ? new Date(l.transaction_date).toISOString().split('T')[0] : today,
        total_value: Number(l.total_value) || 0,
        note: l.note || '',
        type_id: 2
      })) : [this.newBlankRevenueRow()];

      const exps = this.actualLedger.filter(l => Number(l.type_id) === 1);
      this.expenseRows = exps.length > 0 ? exps.map(l => ({
        ledger_id: l.ledger_id,
        category_id: String(l.category_id),
        transaction_date: l.transaction_date ? new Date(l.transaction_date).toISOString().split('T')[0] : today,
        total_value: Number(l.total_value) || 0,
        note: l.note || '',
        type_id: 1
      })) : [this.newBlankExpenseRow()];
    } else if (this.estimatedLedger.length > 0) {
      // นำโครงสร้างหมวดหมู่จาก Estimated มาเตรียมให้กรอกได้เลย
      const revs = this.estimatedLedger.filter(l => Number(l.type_id) === 2);
      this.revenueRows = revs.length > 0 ? revs.map(l => ({
        category_id: String(l.category_id),
        transaction_date: today,
        total_value: 0,
        note: '',
        type_id: 2
      })) : [this.newBlankRevenueRow()];

      const exps = this.estimatedLedger.filter(l => Number(l.type_id) === 1);
      this.expenseRows = exps.length > 0 ? exps.map(l => ({
        category_id: String(l.category_id),
        transaction_date: today,
        total_value: 0,
        note: '',
        type_id: 1
      })) : [this.newBlankExpenseRow()];
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

  private getDefaultDate(): string {
    if (this.project?.created_at) {
      return new Date(this.project.created_at).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  }

  newBlankRevenueRow(): LedgerRow {
    return {
      category_id: this.revenueCategories[0]?.category_id || '',
      transaction_date: this.getDefaultDate(),
      total_value: 0,
      note: '',
      type_id: 2
    };
  }

  newBlankExpenseRow(): LedgerRow {
    return {
      category_id: this.expenseCategories[0]?.category_id || '',
      transaction_date: this.getDefaultDate(),
      total_value: 0,
      note: '',
      type_id: 1
    };
  }

  // สัดส่วน (%) ของแถวนี้เทียบกับยอดรวมฝั่งเดียวกัน — ใช้แสดงแถบเล็กใต้แต่ละแถวในโหมดแก้ไข
  rowShare(row: LedgerRow, total: number): number {
    const v = Number(row.total_value) || 0;
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

  // ─── Date Validation ───────────────────────────────────────────────────────
  get minDate(): string {
    if (!this.project?.created_at) return '';
    return new Date(this.project.created_at).toISOString().split('T')[0];
  }

  get maxDate(): string {
    if (!this.project?.created_at || !this.project?.duration_months) return '';
    const d = new Date(this.project.created_at);
    d.setMonth(d.getMonth() + Number(this.project.duration_months));
    return d.toISOString().split('T')[0];
  }

  isDateValid(dateStr: string): boolean {
    if (!this.project || !dateStr) return true;
    const start = new Date(this.project.created_at);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(this.project.duration_months));
    end.setHours(23, 59, 59, 999);
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    return d >= start && d <= end;
  }

  // ─── Save Actual ───────────────────────────────────────────────────────────
  async saveActual(): Promise<void> {
    const allRows = [...this.revenueRows, ...this.expenseRows];
    const validRows = allRows.filter(r => Number(r.total_value) > 0);

    if (validRows.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูล',
        text: 'กรุณากรอกจำนวนเงินอย่างน้อย 1 รายการ',
        confirmButtonColor: '#198754'
      });
      return;
    }

    const badDate = validRows.find(r => r.transaction_date && !this.isDateValid(r.transaction_date));
    if (badDate) {
      Swal.fire({
        icon: 'warning',
        title: 'วันที่ไม่ถูกต้อง',
        text: `วันที่ต้องอยู่ภายในระยะเวลาโครงการ ${this.project?.duration_months} เดือน`,
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
    const payload = validRows.map(r => ({
      type_id: r.type_id,
      category_id: r.category_id,
      total_value: Number(r.total_value),
      note: r.note || '',
      transaction_date: r.transaction_date
    }));

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
      this.projectService.updateActualLedgers(this.projectId, payload.map(l => ({
        type_id: l.type_id,
        category_id: l.category_id,
        total_value: l.total_value,
        note: l.note,
        transaction_date: new Date(l.transaction_date)
      }))).subscribe({
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

  // ─── KPI Calculations ──────────────────────────────────────────────────────
  private calculateMetrics(): void {
    const duration = Number(this.project?.duration_months || 0);

    this.totalEstRevenue = this.sumByType(this.estimatedLedger, 2);
    this.totalEstExpense = this.sumByType(this.estimatedLedger, 1);
    this.estNetProfit = this.totalEstRevenue - this.totalEstExpense;
    this.estROI = this.totalEstExpense > 0
      ? ((this.totalEstRevenue - this.totalEstExpense) / this.totalEstExpense) * 100 : 0;
    const mEst = duration > 0 ? this.totalEstRevenue / duration : 0;
    this.estPaybackMonths = mEst > 0 && this.totalEstExpense > 0 ? this.totalEstExpense / mEst : null;

    this.totalActRevenue = this.sumByType(this.actualLedger, 2);
    this.totalActExpense = this.sumByType(this.actualLedger, 1);
    this.actNetProfit = this.totalActRevenue - this.totalActExpense;
    this.actROI = this.totalActExpense > 0
      ? ((this.totalActRevenue - this.totalActExpense) / this.totalActExpense) * 100 : 0;
    const mAct = duration > 0 ? this.totalActRevenue / duration : 0;
    this.actPaybackMonths = mAct > 0 && this.totalActExpense > 0 ? this.totalActExpense / mAct : null;
  }

  private sumByType(list: ProjectLedger[], typeId: number): number {
    return list.filter(l => Number(l.type_id) === typeId)
      .reduce((s, l) => s + Number(l.total_value || 0), 0);
  }

  getEstimatedMatch(act: ProjectLedger): number {
    const match = this.estimatedLedger.find(
      l => String(l.category_id) === String(act.category_id) && Number(l.type_id) === Number(act.type_id)
    );
    return Number(match?.total_value || 0);
  }

  isOverBudget(act: ProjectLedger): boolean {
    const est = this.getEstimatedMatch(act);
    if (est === 0) return false;
    return Number(act.type_id) === 1
      ? Number(act.total_value) > est
      : Number(act.total_value) < est;
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
