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

  // ─── Estimated KPIs ───────────────────────────────────────────────────────
  totalEstRevenue = 0;
  totalEstExpense = 0;
  estNetProfit = 0;
  estROI = 0;
  estPaybackMonths: number | null = null;

  // ─── Actual KPIs ─────────────────────────────────────────────────────────
  totalActRevenue = 0;
  totalActExpense = 0;
  actNetProfit = 0;
  actROI = 0;
  actPaybackMonths: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
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

        // แยก Estimated vs Actual
        this.estimatedLedger = result.ledgers.filter(l => l.phase === 'Estimated');
        this.actualLedger    = result.ledgers.filter(l => l.phase === 'Actual');

        this.calculateMetrics();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading actual report:', err);
        this.isLoading = false;
      }
    });
  }

  private calculateMetrics(): void {
    const duration = Number(this.project?.duration_months || 0);

    // ── Estimated metrics ──
    this.totalEstRevenue = this.sumByType(this.estimatedLedger, 2);
    this.totalEstExpense = this.sumByType(this.estimatedLedger, 1);
    this.estNetProfit    = this.totalEstRevenue - this.totalEstExpense;
    this.estROI = this.totalEstExpense > 0
      ? ((this.totalEstRevenue - this.totalEstExpense) / this.totalEstExpense) * 100
      : 0;
    const monthlyEstRev = duration > 0 ? this.totalEstRevenue / duration : 0;
    this.estPaybackMonths = (monthlyEstRev > 0 && this.totalEstExpense > 0)
      ? this.totalEstExpense / monthlyEstRev
      : null;

    // ── Actual metrics ──
    this.totalActRevenue = this.sumByType(this.actualLedger, 2);
    this.totalActExpense = this.sumByType(this.actualLedger, 1);
    this.actNetProfit    = this.totalActRevenue - this.totalActExpense;
    this.actROI = this.totalActExpense > 0
      ? ((this.totalActRevenue - this.totalActExpense) / this.totalActExpense) * 100
      : 0;
    const monthlyActRev = duration > 0 ? this.totalActRevenue / duration : 0;
    this.actPaybackMonths = (monthlyActRev > 0 && this.totalActExpense > 0)
      ? this.totalActExpense / monthlyActRev
      : null;
  }

  private sumByType(list: ProjectLedger[], typeId: number): number {
    return list
      .filter(l => Number(l.type_id) === typeId)
      .reduce((sum, l) => sum + Number(l.total_value || 0), 0);
  }

  // ─── หา Estimated ที่ตรงกับ Actual entry (จับคู่ด้วย category + type) ────
  getEstimatedMatch(act: ProjectLedger): number {
    const match = this.estimatedLedger.find(
      l => String(l.category_id) === String(act.category_id) &&
           Number(l.type_id) === Number(act.type_id)
    );
    return Number(match?.total_value || 0);
  }

  // ─── ตรวจสอบว่าเกินงบหรือต่ำกว่าเป้า ─────────────────────────────────────
  isOverBudget(act: ProjectLedger): boolean {
    const estimated = this.getEstimatedMatch(act);
    if (estimated === 0) return false;
    const actVal = Number(act.total_value || 0);
    return Number(act.type_id) === 1 ? actVal > estimated : actVal < estimated;
  }

  // ─── Variance: Actual - Estimated ─────────────────────────────────────────
  getVariance(act: ProjectLedger): number {
    return Number(act.total_value || 0) - this.getEstimatedMatch(act);
  }

  // ─── เอาเครื่องหมายถูกต้องตามประเภท ─────────────────────────────────────
  getVarianceSign(act: ProjectLedger): string {
    const v = this.getVariance(act);
    return v > 0 ? '+' : '';
  }

  // ─── getter แยกแสดงในตาราง ────────────────────────────────────────────────
  getActualExpenses(): ProjectLedger[] {
    return this.actualLedger.filter(l => Number(l.type_id) === 1);
  }

  getActualRevenues(): ProjectLedger[] {
    return this.actualLedger.filter(l => Number(l.type_id) === 2);
  }
}
