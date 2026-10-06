import { Component, OnInit } from '@angular/core';
import { PROJECT_STATUS_HINTS, PROJECT_STATUS_LABELS, Project } from '../../models/roi-tracking-model';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { timeout } from 'rxjs/operators';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { BahtPipe } from '../project.-report/shared/baht.pipe';
import { PctPipe } from '../project.-report/shared/pct.pipe';
import {
  PlanComparison,
  comparePlan,
  planComparisonClass,
  planComparisonIcon,
  planComparisonLabel,
} from '../project.-report/shared/plan-compare';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BaseChartDirective, BahtPipe, PctPipe],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home implements OnInit {
  projects: Project[] = [];
  searchTerm: string = ''; // ค่าค้นหาที่ผูกกับ input
  isLoading: boolean = false; // สถานะกำลังโหลดข้อมูล

  // ตัวแปรสำหรับแสดงผลใน Summary Cards
  totalBudget: number = 0;
  totalBenefits: number = 0;
  averageROI: number = 0;
  totalDirect = 0;
  totalIndirect = 0;
  worthwhileCount = 0;
  actualCount = 0;

  readonly statusLabels = PROJECT_STATUS_LABELS;
  readonly statusHints = PROJECT_STATUS_HINTS;

  constructor(
    private projectService: ProjectService,
    private toastService: ToastService,
    public authService: AuthService,
    private router: Router
  ) { }

  // คลิกที่การ์ดโปรเจกต์ → ไปหน้ารายงานของโปรเจกต์นั้น (Actual ถ้ามีข้อมูลจริงแล้ว, ไม่งั้น Estimated)
  goToProject(prj: Project): void {
    const route = prj.status === 'Actual' ? '/user/actual-report' : '/user/estimated-report';
    this.router.navigate([route, prj.project_id]);
  }

  ngOnInit(): void {
    this.isLoading = true;
    // ตัวชี้วัดของแต่ละโครงการ (ผลประโยชน์ ต้นทุน ROI แผน/จริง ฯลฯ) คำนวณโดย backend มาพร้อมรายการ
    // โครงการแล้ว — ใช้สูตรเดียวกับหน้ารายงาน ไม่ต้องดึง ledger มาคำนวณเองที่นี่
    this.projectService.getProjects().pipe(timeout(10000)).subscribe({
      next: (projects) => {
        this.projects = projects;
        this.isLoading = false;
        this.calculateSummary();
      },
      error: (err) => {
        console.error('Error loading dashboard data:', err);
        this.toastService.error('ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง');
        this.isLoading = false;
      }
    });
  }

  calculateSummary(): void {
    const sum = (pick: (p: Project) => number | undefined) =>
      this.projects.reduce((s, p) => s + Number(pick(p) || 0), 0);

    this.totalBudget = sum((p) => p.initial_budget);
    this.totalBenefits = sum((p) => p.total_benefit);
    this.totalDirect = sum((p) => p.direct_revenue);
    this.totalIndirect = sum((p) => p.indirect_benefit);

    // ROI เฉลี่ยของโครงการที่มีข้อมูลต้นทุนแล้ว (โครงการเปล่ายังไม่มี ROI จริง ไม่ควรดึงค่าเฉลี่ยลง)
    const withData = this.projects.filter((p) => Number(p.total_cost || 0) > 0);
    this.averageROI = withData.length
      ? withData.reduce((s, p) => s + Number(p.roi || 0), 0) / withData.length
      : 0;
    this.worthwhileCount = this.projects.filter((p) => p.is_worthwhile === true).length;
    this.actualCount = this.projects.filter((p) => p.has_actual).length;
  }

  // ─── แผน vs ผลจริง ─────────────────────────────────────────────────────────
  // โครงการที่มีผลจริงแล้ว: เทียบ ROI จริงกับแผน "ช่วงเดียวกัน" (โครงการที่ยังไม่จบจะได้ไม่ดูแย่
  // เพียงเพราะเก็บผลยังไม่ครบ) — ตัวเลขทุกตัวมาจาก backend
  get comparedProjects(): Project[] {
    return this.projects.filter((p) => p.has_actual);
  }

  // ROI จริงเทียบกับแผนช่วงเดียวกัน: ต่ำกว่าแผน / เท่ากับแผน / สูงกว่าแผน
  planResult(p: Project): PlanComparison {
    return comparePlan(Number(p.actual_roi ?? 0), Number(p.estimated_to_date_roi ?? p.estimated_roi ?? 0), 0.05);
  }

  readonly comparisonLabel = planComparisonLabel;
  readonly comparisonIcon = planComparisonIcon;
  readonly comparisonClass = planComparisonClass;

  // ─── กราฟ: ROI ของแต่ละโครงการ (แผน vs จริง) ─────────────────────────────────
  // แท่งแนวนอนเรียงจาก ROI สูงไปต่ำ อ่านชื่อโครงการภาษาไทยยาวๆ ได้ง่าย
  chartTopN = 8;
  readonly topNOptions = [5, 8, 15, 30];

  private headlineRoi(p: Project): number {
    return Number(p.has_actual ? p.actual_roi : p.estimated_roi) || 0;
  }

  get chartProjects(): Project[] {
    return [...this.projects]
      .sort((a, b) => this.headlineRoi(b) - this.headlineRoi(a))
      .slice(0, this.chartTopN);
  }

  get chartHeightPx(): number {
    return Math.max(220, this.chartProjects.length * 46 + 80);
  }

  get roiChartData(): ChartConfiguration<'bar'>['data'] {
    const projects = this.chartProjects;
    return {
      labels: projects.map((p) => (p.project_name.length > 26 ? p.project_name.slice(0, 26) + '…' : p.project_name)),
      datasets: [
        {
          label: 'ROI ตามแผน',
          data: projects.map((p) => Number(p.estimated_roi || 0)),
          backgroundColor: 'rgba(108,117,125,.35)',
          borderRadius: 6,
          barPercentage: 0.9,
        },
        {
          label: 'ROI ผลจริง',
          data: projects.map((p) => (p.has_actual ? Number(p.actual_roi || 0) : null)),
          backgroundColor: projects.map((p) => (Number(p.actual_roi || 0) >= 0 ? '#198754' : 'rgba(220,53,69,.8)')),
          borderRadius: 6,
          barPercentage: 0.9,
        },
      ],
    };
  }

  readonly roiChartOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => (ctx.parsed.x == null ? `${ctx.dataset.label}: ยังไม่มีข้อมูล` : `${ctx.dataset.label}: ${Number(ctx.parsed.x).toFixed(1)}%`),
        },
      },
    },
    scales: {
      x: {
        ticks: { callback: (v) => `${v}%` },
        // เส้น 0% เข้มกว่า — ซ้ายของเส้น = ขาดทุน, ขวา = มีกำไร
        grid: {
          color: (ctx) => (ctx.tick.value === 0 ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.05)'),
          lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1),
        },
      },
      y: { grid: { display: false }, ticks: { autoSkip: false } },
    },
  };

  // getter คำนวณค่าเมื่อถูกเรียก — กรอง projects ตาม searchTerm แบบ real-time
  get filteredProjects(): Project[] {
    if (!this.searchTerm.trim()) return this.projects;
    const term = this.searchTerm.toLowerCase();
    return this.projects.filter(p =>
      p.project_name.toLowerCase().includes(term)
    );
  }

  // ─── แสดงการ์ดทีละชุด ──────────────────────────────────────────────────────
  // การ์ดแต่ละใบมีตัวเลขหลายค่า ถ้ามีหลายสิบโครงการแล้ว render พร้อมกันหมด หน้าจะยาวมากและ
  // scroll หนืด จึงโหลดเพิ่มทีละชุดตามที่ผู้ใช้กด
  readonly cardPageSize = 9;
  visibleCardCount = this.cardPageSize;

  get visibleProjects(): Project[] {
    return this.filteredProjects.slice(0, this.visibleCardCount);
  }

  get hasMoreProjects(): boolean {
    return this.filteredProjects.length > this.visibleCardCount;
  }

  showMoreProjects(): void {
    this.visibleCardCount += this.cardPageSize;
  }

  // เปลี่ยนคำค้นแล้วต้องกลับไปเริ่มนับใหม่ ไม่งั้นผลการค้นหาจะโชว์ค้างเป็นจำนวนของคำค้นก่อนหน้า
  onSearchChange(): void {
    this.visibleCardCount = this.cardPageSize;
  }

  // สัดส่วนต้นทุน (ตามข้อมูลล่าสุด: ผลจริงถ้ามี ไม่งั้นประมาณการ) เทียบกับงบตั้งต้น
  getProjectBudgetUtilization(prj: Project): number {
    const budget = Number(prj.initial_budget || 0);
    if (budget <= 0) return 0;
    return Math.min((Number(prj.total_cost || 0) / budget) * 100, 100);
  }
}
