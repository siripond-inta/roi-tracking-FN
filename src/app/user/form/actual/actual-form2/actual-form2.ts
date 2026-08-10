import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
import { Project, ProjectLedger } from '../../../../models/roi-tracking-model';
import { ProjectService } from '../../../../services/project.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../services/toast.service';

// Interface แทน any[] — ระบุ Type ชัดเจน ทำให้ IDE แจ้งเตือนได้ถ้ากรอก field ผิด
interface ActualRow {
  category: string;
  note: string;
  amount: number;
  type_id: number; // 1 = Expense, 2 = Revenue
}

@Component({
  selector: 'app-actual-form2',
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './actual-form2.html',
  styleUrl: './actual-form2.css',
})
export class ActualForm2 implements OnInit {
  projectName: string = 'กำลังโหลดข้อมูลโปรเจกต์...';
  initialBudget: number = 0;
  isLoading: boolean = false;
  projectId!: number;

  // ใช้ ActualRow interface แทน any[] เพื่อ Type Safety
  actualRows: ActualRow[] = [
    { category: 'REV001', note: 'Actual Revenue', amount: 0, type_id: 2 },
    { category: 'CAT002', note: 'Actual Expense (Labor)', amount: 0, type_id: 1 },
    { category: 'CAT001', note: 'Actual Maintenance (Hardware)', amount: 0, type_id: 1 }
  ];

  constructor(
    private projectService: ProjectService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // ดึง Project ID ที่ต้องการระบุข้อมูลจริง
    this.projectId = Number(localStorage.getItem('current_actual_id'));
    if (!this.projectId) {
      this.toastService.error('ไม่พบข้อมูลโปรเจกต์ กรุณาเลือกใหม่อีกครั้ง');
      this.router.navigate(['/user/actual-form1']);
      return;
    }

    // ดึงชื่อและงบประมาณดั้งเดิมจากฐานข้อมูล
    this.projectService.getProjectById(this.projectId).subscribe({
      next: (project) => {
        this.projectName = project.project_name;
        this.initialBudget = project.initial_budget;
      },
      error: (err) => {
        console.error('Error fetching project:', err);
        this.toastService.error('โหลดข้อมูลรายละเอียดโปรเจกต์ไม่สำเร็จ');
      }
    });
  }

  // ยอดจ่ายจริงทั้งหมด (type_id = 1)
  getTotalActualSpent(): number {
    return this.actualRows
      .filter(row => row.type_id === 1)
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }

  // ยอดต่างงบประมาณ
  getVariance(): number {
    return this.initialBudget - this.getTotalActualSpent();
  }

  // เปอร์เซ็นต์การใช้งบจริงเทียบกับงบเริ่มต้น
  getUsagePercentage(): number {
    if (this.initialBudget <= 0) return 0;
    const percent = (this.getTotalActualSpent() / this.initialBudget) * 100;
    return percent > 100 ? 100 : percent;
  }

  confirmActual(): void {
    // Validation: ต้องมีอย่างน้อย 1 รายการที่กรอกจำนวนเงินไว้
    const hasData = this.actualRows.some(row => row.amount > 0);
    if (!hasData) {
      this.toastService.warning('กรุณากรอกจำนวนเงินจริงอย่างน้อย 1 รายการ');
      return;
    }

    // แปลงแต่ละ ActualRow เป็น ProjectLedger พร้อมบันทึก
    const actualLedgers: Partial<ProjectLedger>[] = this.actualRows
      .filter(row => row.amount > 0)
      .map(row => ({
        phase: 'Actual',
        type_id: row.type_id,
        category_id: row.category,
        total_value: row.amount,
        transaction_date: new Date(),
        note: row.note
      }));

    this.isLoading = true;
    this.projectService.saveActualData(this.projectId, actualLedgers).subscribe({
      next: () => {
        this.toastService.success('บันทึกผลการดำเนินงานจริง (Actual) เรียบร้อยแล้ว');
        // ล้าง ID ชั่วคราวออกหลังบันทึกเสร็จ
        localStorage.removeItem('current_actual_id');
        this.isLoading = false;
        this.router.navigate(['/user/dashboard']);
      },
      error: (err) => {
        console.error('Error saving actual data:', err);
        this.toastService.error(`บันทึกไม่สำเร็จ: ${err.error?.message || 'ข้อผิดพลาดระบบ'}`);
        this.isLoading = false;
      }
    });
  }
}
