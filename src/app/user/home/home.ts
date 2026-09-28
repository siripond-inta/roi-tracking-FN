import { Component, OnInit } from '@angular/core';
import { PROJECT_STATUS_LABELS, Project } from '../../models/roi-tracking-model';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { timeout } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BaseChartDirective],
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
  budgetUtilization: number = 0;

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
    // ตัวชี้วัดของแต่ละโครงการ (ผลประโยชน์ ต้นทุน ROI ฯลฯ) คำนวณโดย backend มาพร้อมรายการโครงการแล้ว
    // — ใช้สูตรเดียวกับหน้ารายงาน และนับผลประโยชน์ตามประเภทโครงการ ไม่ต้องดึง ledger มาคำนวณเองที่นี่
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
    const totalCost = sum((p) => p.total_cost);

    // ROI เฉลี่ยของโครงการที่มีข้อมูลต้นทุนแล้ว (โครงการเปล่ายังไม่มี ROI จริง ไม่ควรดึงค่าเฉลี่ยลง)
    const withData = this.projects.filter((p) => Number(p.total_cost || 0) > 0);
    this.averageROI = withData.length
      ? withData.reduce((s, p) => s + Number(p.roi || 0), 0) / withData.length
      : 0;
    this.worthwhileCount = this.projects.filter((p) => p.is_worthwhile === true).length;

    this.budgetUtilization = this.totalBudget > 0 ? (totalCost / this.totalBudget) * 100 : 0;
  }

  // ─── FR05-1: กราฟแท่งเปรียบเทียบผลประโยชน์รายโครงการบนแดชบอร์ด ─────────────
  // (กราฟเส้นแนวโน้ม ROI รายเดือนอยู่ที่หน้ารายงานของแต่ละโครงการ เพราะต้องใช้ข้อมูลรายงวด)
  //
  // รองรับกรณีโครงการเยอะ: แท่งจะบางจนอ่านไม่ออกถ้ายัดทุกโครงการลงไป จึงเรียงจากมากไปน้อย
  // แล้วแสดงเฉพาะ "อันดับต้นๆ" ตามจำนวนที่ผู้ใช้เลือก และสลับเป็นแท่งแนวนอนเมื่อรายการเยอะ
  // (แนวนอนอ่านชื่อโครงการได้ดีกว่ามาก เพราะชื่อไทยยาว)
  chartTopN = 8;
  chartMetric: 'benefit' | 'roi' = 'benefit';
  readonly topNOptions = [5, 8, 10, 15, 20];

  // โครงการที่จะเอาขึ้นกราฟ: เรียงตามตัวชี้วัดที่เลือก แล้วตัดเอา N อันดับแรก
  private get chartProjects(): Project[] {
    const score = (p: Project) =>
      this.chartMetric === 'roi' ? Number(p.roi || 0) : Number(p.total_benefit || 0);
    return [...this.projects].sort((a, b) => score(b) - score(a)).slice(0, this.chartTopN);
  }

  get isHorizontalChart(): boolean {
    return this.chartProjects.length > 6;
  }

  // ความสูงของกราฟโตตามจำนวนแท่ง เพื่อไม่ให้แท่งบีบจนติดกันเมื่อรายการเยอะ
  get chartHeightPx(): number {
    return this.isHorizontalChart ? Math.max(320, this.chartProjects.length * 42 + 90) : 320;
  }

  get benefitByProjectChartData(): ChartConfiguration<'bar'>['data'] {
    const projects = this.chartProjects;
    const labels = projects.map((p) =>
      p.project_name.length > 28 ? p.project_name.slice(0, 28) + '…' : p.project_name
    );

    if (this.chartMetric === 'roi') {
      return {
        labels,
        datasets: [
          {
            label: 'ROI (%)',
            data: projects.map((p) => Number(p.roi || 0)),
            backgroundColor: projects.map((p) => (Number(p.roi || 0) >= 0 ? '#198754' : 'rgba(220,53,69,.75)')),
            borderRadius: 6,
          },
        ],
      };
    }

    return {
      labels,
      datasets: [
        // ผลประโยชน์ซ้อนเป็นแท่งเดียว (รายได้โดยตรง + ทางอ้อม) เทียบกับแท่งต้นทุน
        {
          label: 'รายได้โดยตรง',
          data: projects.map((p) => Number(p.direct_revenue || 0)),
          backgroundColor: '#198754',
          borderRadius: 6,
          stack: 'benefit',
        },
        {
          label: 'ผลประโยชน์ทางอ้อม',
          data: projects.map((p) => Number(p.indirect_benefit || 0)),
          backgroundColor: '#0f7b8a',
          borderRadius: 6,
          stack: 'benefit',
        },
        {
          label: 'ต้นทุน',
          data: projects.map((p) => Number(p.total_cost || 0)),
          backgroundColor: 'rgba(220,53,69,.75)',
          borderRadius: 6,
          stack: 'cost',
        },
      ],
    };
  }

  get benefitByProjectChartOptions(): ChartConfiguration<'bar'>['options'] {
    const horizontal = this.isHorizontalChart;
    const isRoi = this.chartMetric === 'roi';
    const valueTick = (v: any) => (isRoi ? `${v}%` : `฿${Number(v).toLocaleString()}`);

    return {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', display: !isRoi },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = Number(ctx.parsed[horizontal ? 'x' : 'y'] ?? 0);
              return `${ctx.dataset.label}: ${isRoi ? value.toFixed(1) + '%' : '฿' + value.toLocaleString()}`;
            },
          },
        },
      },
      scales: horizontal
        ? {
            x: { beginAtZero: true, ticks: { callback: valueTick }, grid: { color: 'rgba(0,0,0,.05)' } },
            y: { grid: { display: false }, ticks: { autoSkip: false } },
          }
        : {
            y: { beginAtZero: true, ticks: { callback: valueTick }, grid: { color: 'rgba(0,0,0,.05)' } },
            x: { grid: { display: false } },
          },
    };
  }

  // getter คำนวณค่าเมื่อถูกเรียก — กรอง projects ตาม searchTerm แบบ real-time
  get filteredProjects(): Project[] {
    if (!this.searchTerm.trim()) return this.projects;
    const term = this.searchTerm.toLowerCase();
    return this.projects.filter(p =>
      p.project_name.toLowerCase().includes(term)
    );
  }

  // ─── แสดงการ์ดทีละชุด ──────────────────────────────────────────────────────
  // การ์ดแต่ละใบมี progress bar + ตัวเลขหลายค่า ถ้ามีหลายสิบโครงการแล้ว render พร้อมกันหมด
  // หน้าจะยาวมากและ scroll หนืด จึงโหลดเพิ่มทีละชุดตามที่ผู้ใช้กด
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

  readonly statusLabels = PROJECT_STATUS_LABELS;

  // สัดส่วนต้นทุน (ตามข้อมูลล่าสุด: ผลจริงถ้ามี ไม่งั้นประมาณการ) เทียบกับงบตั้งต้น
  getProjectBudgetUtilization(prj: Project): number {
    const budget = Number(prj.initial_budget || 0);
    if (budget <= 0) return 0;
    return Math.min((Number(prj.total_cost || 0) / budget) * 100, 100);
  }
}
