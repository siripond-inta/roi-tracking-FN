import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
import { ProjectService } from '../../../../services/project.service';
import { Project, ProjectLedger } from '../../../../models/roi-tracking-model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../services/toast.service';

// Interface ที่ระบุ Type ของแต่ละแถวใน Budget Table อย่างชัดเจน
interface BudgetRow {
  type_id: number;   // 1 = Expense, 2 = Revenue
  category: string;
  note: string;
  amount: number;
}

@Component({
  selector: 'app-estimated-form2',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './estimated-form2.html',
  styleUrl: './estimated-form2.css',
})
export class EstimatedForm2 implements OnInit {
  projectName: string = '';
  initialBudget: number = 0;
  isLoading: boolean = false; // สำหรับบอกสถานะบันทึกข้อมูล

  // ข้อมูลแถว Budget ทุกแถวอยู่ที่นี่
  budgetRows: BudgetRow[] = [
    { type_id: 2, category: 'REV001', note: 'Q1 Sales Projection', amount: 4500000 },
    { type_id: 1, category: 'CAT002', note: 'Software License & API', amount: 2000000 },
    { type_id: 1, category: 'CAT001', note: 'Server Maintenance', amount: 1200000 }
  ];

  constructor(
    private projectService: ProjectService,
    private router: Router,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    // โหลดข้อมูลที่บันทึกไว้จาก Step 1 ผ่าน localStorage
    const temp = localStorage.getItem('temp_project');
    if (temp) {
      const data = JSON.parse(temp);
      this.projectName = data.project_name || 'New Project';
      this.initialBudget = Number(data.initial_budget) || 0;
    }
  }

  // คำนวณยอดรวมทุกแถวใน real-time (ใช้แสดงใน Summary Panel)
  getTotalEstimated(): number {
    return this.budgetRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }

  // งบคงเหลือ — ติดลบแปลว่าเกินงบ
  getRemaining(): number {
    return this.initialBudget - this.getTotalEstimated();
  }

  // เปอร์เซ็นต์การใช้งบ — cap ที่ 100 เพื่อไม่ให้ progress bar ล้น
  getUsagePercentage(): number {
    if (this.initialBudget <= 0) return 0;
    const percent = (this.getTotalEstimated() / this.initialBudget) * 100;
    return percent > 100 ? 100 : percent;
  }

  confirmAndSave(): void {
    // Validation: ต้องมีอย่างน้อย 1 รายการที่ใส่จำนวนเงินไว้
    const hasValidRows = this.budgetRows.some(row => row.amount > 0);
    if (!hasValidRows) {
      this.toastService.warning('กรุณากรอกจำนวนเงินอย่างน้อย 1 รายการ');
      return;
    }

    const newProject: Partial<Project> = {
      project_name: this.projectName,
      project_type_id: 1,
      duration_months: 12,
      initial_budget: this.initialBudget
    };

    // แปลงแต่ละ BudgetRow ให้เป็น ProjectLedger เพื่อรอส่งเซฟในฐานข้อมูล
    // ในขั้นตอนสร้างโปรเจกต์ (Estimated) เรากำหนดเฟสเป็น "Estimated" เสมอ
    const newLedgers: Partial<ProjectLedger>[] = this.budgetRows
      .filter(row => row.amount > 0)
      .map(row => ({
        phase: 'Estimated',
        type_id: row.type_id,
        category_id: row.category,
        total_value: row.amount,
        transaction_date: new Date(),
        note: row.note
      }));

    this.isLoading = true;
    this.projectService.addProject(newProject, newLedgers).subscribe({
      next: () => {
        this.toastService.success('สร้างโปรเจกต์ใหม่และบันทึกประมาณการเรียบร้อยแล้ว');
        // ล้างข้อมูล Step 1 ออกจาก localStorage หลังบันทึกเสร็จ
        localStorage.removeItem('temp_project');
        this.isLoading = false;
        this.router.navigate(['/user/dashboard']);
      },
      error: (err) => {
        console.error('Error creating project:', err);
        this.toastService.error(`เกิดข้อผิดพลาดในการสร้างโปรเจกต์: ${err.error?.message || 'ข้อผิดพลาดระบบ'}`);
        this.isLoading = false;
      }
    });
  }
}
