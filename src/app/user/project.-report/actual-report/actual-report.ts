import { Component, OnInit } from '@angular/core';
import { Project, ProjectLedger } from '../../../models/roi-tracking-model';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../../services/project.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-actual-report',
  imports: [CommonModule, RouterModule],
  templateUrl: './actual-report.html',
  styleUrl: './actual-report.css',
})
export class ActualReport implements OnInit {
  projectId!: number;
  project?: Project;
  isLoading: boolean = false;

  estimatedLedger: ProjectLedger[] = [];
  actualLedger: ProjectLedger[] = [];

  // ยอดรวมแยกตาม Estimated vs Actual และ Expense vs Revenue
  totalEstExpense = 0;
  totalActExpense = 0;
  totalEstRevenue = 0;
  totalActRevenue = 0;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    // ดึง project ID จาก URL parameter เช่น /actual-report/101 → id = 101
    this.projectId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    forkJoin({
      project: this.projectService.getProjectById(this.projectId),
      ledgers: this.projectService.getLedgersByProjectId(this.projectId)
    }).subscribe({
      next: (result) => {
        this.project = result.project;
        
        // แยก Estimated vs Actual โดยเช็คจากค่า phase ของ DB
        this.estimatedLedger = result.ledgers.filter(l => l.phase === 'Estimated');
        this.actualLedger = result.ledgers.filter(l => l.phase === 'Actual');

        // คำนวณยอดรวมแต่ละประเภท
        this.totalEstExpense = this.sumAmount(this.estimatedLedger, 1);
        this.totalEstRevenue = this.sumAmount(this.estimatedLedger, 2);
        this.totalActExpense = this.sumAmount(this.actualLedger, 1);
        this.totalActRevenue = this.sumAmount(this.actualLedger, 2);

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading actual report:', err);
        this.isLoading = false;
      }
    });
  }

  private sumAmount(list: ProjectLedger[], typeId: number): number {
    return list
      .filter(l => l.type_id === typeId)
      .reduce((sum, current) => sum + current.total_value, 0);
  }

  // แก้ไข: หาค่า Estimated ที่ตรงกับ Actual entry แบบ dynamic (ไม่ hardcode ตัวเลข)
  // จับคู่โดยใช้ทั้ง category_id และ type_id เพื่อความแม่นยำ
  getEstimatedMatch(act: ProjectLedger): number {
    const match = this.estimatedLedger.find(
      l => l.category_id === act.category_id && l.type_id === act.type_id
    );
    return match?.total_value || 0;
  }

  // ตรวจสอบว่า entry นี้ "เกินงบ" หรือ "ต่ำกว่าเป้า" หรือไม่
  isOverBudget(act: ProjectLedger): boolean {
    const estimated = this.getEstimatedMatch(act);
    if (estimated === 0) return false; // ไม่มี estimated เทียบ ถือว่าปกติ
    // Expense (type 1): เกินงบถ้าจ่ายจริง > ประมาณการ
    // Revenue (type 2): ต่ำกว่าเป้าถ้าได้รับจริง < ประมาณการ
    return act.type_id === 1 ? act.total_value > estimated : act.total_value < estimated;
  }

  // คำนวณส่วนต่างระหว่าง Actual และ Estimated (ใช้ใน Summary Card)
  getVariance(est: number, act: number): number {
    return act - est;
  }
}
