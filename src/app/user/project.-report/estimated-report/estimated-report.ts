import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Project, ProjectLedger } from '../../../models/roi-tracking-model';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-estimated-report',
  imports: [CommonModule, RouterModule],
  templateUrl: './estimated-report.html',
  styleUrl: './estimated-report.css',
})
export class EstimatedReport implements OnInit {
  project?: Project;
  ledger: ProjectLedger[] = [];
  isLoading: boolean = false;

  // ─── Summary Metrics (Estimated Phase) ───────────────────────────────────
  totalEstRevenue = 0;
  totalEstExpense = 0;
  estNetProfit = 0;
  estROI = 0;
  estPaybackMonths: number | null = null; // null = ไม่สามารถคำนวณได้

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    // ดึง ID จาก URL parameter (เช่น /estimated-report/101)
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.isLoading = true;
    forkJoin({
      project: this.projectService.getProjectById(id),
      ledger: this.projectService.getLedgersByProjectId(id)
    }).subscribe({
      next: (result) => {
        this.project = result.project;
        // ใช้เฉพาะ Estimated phase สำหรับหน้านี้
        this.ledger = result.ledger.filter(l => l.phase === 'Estimated');
        this.calculateMetrics();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading estimated report:', err);
        this.isLoading = false;
      }
    });
  }

  // ─── คำนวณ KPI ทั้งหมดสำหรับ Estimated Phase ─────────────────────────────
  private calculateMetrics(): void {
    this.totalEstRevenue = this.sumByType(this.ledger, 2);
    this.totalEstExpense = this.sumByType(this.ledger, 1);
    this.estNetProfit = this.totalEstRevenue - this.totalEstExpense;

    // ROI (%) = ((Revenue - Expense) / Expense) × 100
    this.estROI = this.totalEstExpense > 0
      ? ((this.totalEstRevenue - this.totalEstExpense) / this.totalEstExpense) * 100
      : 0;

    // Payback Period (เดือน) = Expense / (Revenue / duration_months)
    // หมายความว่า: ใช้เวลากี่เดือนถึงจะคืนทุน
    const duration = Number(this.project?.duration_months || 0);
    const monthlyRevenue = duration > 0 ? this.totalEstRevenue / duration : 0;
    this.estPaybackMonths = (monthlyRevenue > 0 && this.totalEstExpense > 0)
      ? this.totalEstExpense / monthlyRevenue
      : null;
  }

  private sumByType(list: ProjectLedger[], typeId: number): number {
    return list
      .filter(l => Number(l.type_id) === typeId)
      .reduce((sum, l) => sum + Number(l.total_value || 0), 0);
  }

  // ─── Getters สำหรับแสดงรายการในตาราง ─────────────────────────────────────
  getExpenses(): ProjectLedger[] {
    return this.ledger.filter(l => Number(l.type_id) === 1);
  }

  getRevenues(): ProjectLedger[] {
    return this.ledger.filter(l => Number(l.type_id) === 2);
  }

  // ─── ดึงรายการ Category ที่ไม่ซ้ำกัน (ใช้ใน Variance Table ถ้า Actual มีข้อมูล) ───
  getUniqueCategories(): string[] {
    return [...new Set(this.ledger.map(l => String(l.category_id)))];
  }
}
