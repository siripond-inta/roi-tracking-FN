import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Project, ProjectLedger } from '../../../models/roi-tracking-model';
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
  type_id: number; // 1=รายจ่าย, 2=รายรับ
}

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

  // ─── KPI Metrics (จากฐานข้อมูลที่บันทึกแล้ว) ──────────────────────────────────
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

  // ─── Real-time Calculations (คำนวณสดอัตโนมัติขณะกรอก) ───────────────────────
  get liveRevenue(): number {
    return this.revenueRows.reduce((sum, r) => sum + (Number(r.total_value) || 0), 0);
  }

  get liveExpense(): number {
    return this.expenseRows.reduce((sum, r) => sum + (Number(r.total_value) || 0), 0);
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
    const monthlyRevenue = duration > 0 ? this.liveRevenue / duration : 0;
    if (monthlyRevenue > 0 && this.liveExpense > 0) {
      return this.liveExpense / monthlyRevenue;
    }
    return null;
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
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const queryMode = this.route.snapshot.queryParamMap.get('mode');

    this.isLoading = true;
    forkJoin({
      project: this.projectService.getProjectById(id),
      ledger: this.projectService.getLedgersByProjectId(id),
      categories: this.categoryService.getCategories()
    }).subscribe({
      next: (result) => {
        this.allCategories = result.categories;
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
  startEdit(): void {
    const today = this.getDefaultDate();

    // รายรับ
    const revs = this.ledger.filter(l => Number(l.type_id) === 2);
    if (revs.length > 0) {
      this.revenueRows = revs.map(l => ({
        ledger_id: l.ledger_id,
        category_id: String(l.category_id),
        transaction_date: l.transaction_date ? new Date(l.transaction_date).toISOString().split('T')[0] : today,
        total_value: Number(l.total_value) || 0,
        note: l.note || '',
        type_id: 2
      }));
    } else {
      this.revenueRows = [this.newBlankRevenueRow()];
    }

    // รายจ่าย
    const exps = this.ledger.filter(l => Number(l.type_id) === 1);
    if (exps.length > 0) {
      this.expenseRows = exps.map(l => ({
        ledger_id: l.ledger_id,
        category_id: String(l.category_id),
        transaction_date: l.transaction_date ? new Date(l.transaction_date).toISOString().split('T')[0] : today,
        total_value: Number(l.total_value) || 0,
        note: l.note || '',
        type_id: 1
      }));
    } else {
      this.expenseRows = [this.newBlankExpenseRow()];
    }

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

  // ─── Save Estimated ────────────────────────────────────────────────────────
  async saveEstimated(): Promise<void> {
    const allRows = [...this.revenueRows, ...this.expenseRows];
    // กรองแถวที่มีการกรอกจำนวนเงิน > 0
    const validRows = allRows.filter(r => Number(r.total_value) > 0);

    if (validRows.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูล',
        text: 'กรุณากรอกจำนวนเงินอย่างน้อย 1 รายการ (รายรับ หรือ รายจ่าย)',
        confirmButtonColor: '#198754'
      });
      return;
    }

    const badDate = validRows.find(r => r.transaction_date && !this.isDateValid(r.transaction_date));
    if (badDate) {
      Swal.fire({
        icon: 'warning',
        title: 'วันที่ไม่ถูกต้อง',
        text: `วันที่ต้องอยู่ภายในระยะเวลาโครงการ ${this.project?.duration_months} เดือน (นับจากวันที่สร้างโครงการ)`,
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
    const ledgersPayload = validRows.map(r => ({
      type_id: r.type_id,
      category_id: r.category_id,
      total_value: Number(r.total_value),
      note: r.note || '',
      transaction_date: r.transaction_date
    }));

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
      this.projectService.updateEstimatedLedgers(projectId, ledgersPayload.map(l => ({
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
      title: 'บันทึกสำเร็จ!',
      text: 'ข้อมูลประมาณการถูกบันทึกเรียบร้อยแล้ว',
      timer: 1800,
      showConfirmButton: false
    });

    const id = this.project!.project_id;
    this.projectService.getLedgersByProjectId(id).subscribe(ls => {
      this.ledger = ls.filter(l => l.phase === 'Estimated');
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

  // ─── KPI Calculation (View Mode) ───────────────────────────────────────────
  private calculateMetrics(): void {
    this.totalEstRevenue = this.sumByType(this.ledger, 2);
    this.totalEstExpense = this.sumByType(this.ledger, 1);
    this.estNetProfit = this.totalEstRevenue - this.totalEstExpense;
    this.estROI = this.totalEstExpense > 0
      ? ((this.totalEstRevenue - this.totalEstExpense) / this.totalEstExpense) * 100 : 0;
    const duration = Number(this.project?.duration_months || 0);
    const monthly = duration > 0 ? this.totalEstRevenue / duration : 0;
    this.estPaybackMonths = monthly > 0 && this.totalEstExpense > 0
      ? this.totalEstExpense / monthly : null;
  }

  private sumByType(list: ProjectLedger[], typeId: number): number {
    return list.filter(l => Number(l.type_id) === typeId)
      .reduce((s, l) => s + Number(l.total_value || 0), 0);
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
