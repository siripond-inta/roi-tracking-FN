import { Component, OnInit } from '@angular/core';
import { Project, ProjectLedger } from '../../models/roi-tracking-model';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { forkJoin, of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home implements OnInit {
  projects: Project[] = [];
  ledger: ProjectLedger[] = [];
  searchTerm: string = ''; // ค่าค้นหาที่ผูกกับ input
  isLoading: boolean = false; // สถานะกำลังโหลดข้อมูล

  // ตัวแปรสำหรับแสดงผลใน Summary Cards
  totalBudget: number = 0;
  totalBenefits: number = 0;
  averageROI: number = 0;
  budgetUtilization: number = 0;

  constructor(
    private projectService: ProjectService,
    public authService: AuthService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.isLoading = true;
    // ใช้ forkJoin เพื่อรอให้ดึงโปรเจกต์และ Ledger ครบทั้งสองส่วน
    // catchError: ถ้า observable ใดล้มเหลว → คืน array ว่างแทน ไม่ให้ forkJoin ค้าง
    // timeout(10000): ถ้ารอเกิน 10 วินาที → จบทันที ไม่โหลดตลอดไป
    forkJoin({
      projects: this.projectService.getProjects().pipe(
        timeout(10000),
        catchError(err => { console.error('getProjects error:', err); return of([]); })
      ),
      ledger: this.projectService.getLedgers().pipe(
        timeout(10000),
        catchError(err => { console.error('getLedgers error:', err); return of([]); })
      )
    }).subscribe({
      next: (result) => {
        this.projects = result.projects as Project[];
        this.ledger = result.ledger as ProjectLedger[];
        this.isLoading = false; // ← เซ็ตก่อน calculateSummary() เสมอ
        this.calculateSummary();
        if (this.projects.length === 0) {
          this.toastService.error('ไม่สามารถโหลดข้อมูลโปรเจกต์ได้ กรุณาตรวจสอบ connection');
        }
      },
      error: (err) => {
        console.error('Error loading dashboard data:', err);
        this.toastService.error('ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง');
        this.isLoading = false;
      }
    });
  }

  // ─── Helper: เลือก Ledger Phase ที่ถูกต้องตาม Project Status ───────────
  // หลักการ: โปรเจกต์ที่มีข้อมูล Actual แล้ว → ใช้แค่ Actual (ของจริง)
  //          โปรเจกต์ที่ยังเป็น Estimated → ใช้แค่ Estimated (ประมาณการ)
  // เหตุผล: ถ้าใช้ทั้งสอง Phase ปนกัน ยอดจะถูกนับซ้ำ (doubled)
  private getRelevantLedgers(projectId: number): ProjectLedger[] {
    const project = this.projects.find(p => p.project_id === projectId);
    // เลือก phase ตาม status ของโปรเจกต์
    const preferredPhase = project?.status === 'Actual' ? 'Actual' : 'Estimated';
    return this.ledger.filter(
      l => l.project_id === projectId && l.phase === preferredPhase
    );
  }

  calculateSummary(): void {
    // 1. รวมงบประมาณเริ่มต้นของทุกโปรเจกต์ด้วย reduce()
    this.totalBudget = this.projects.reduce((sum, prj) => sum + prj.initial_budget, 0);

    // 2-3. รวม Revenue และ Expense โดยใช้เฉพาะ Phase ที่ถูกต้องของแต่ละโปรเจกต์
    // วน loop ทีละโปรเจกต์เพื่อเลือก Phase ก่อนรวมยอด (ไม่รวมทุก Phase ปนกัน)
    let totalRevenue = 0;
    let totalExpenses = 0;

    this.projects.forEach(project => {
      const relevant = this.getRelevantLedgers(project.project_id);
      totalRevenue  += relevant
        .filter(l => l.type_id === 2)
        .reduce((sum, l) => sum + l.total_value, 0);
      totalExpenses += relevant
        .filter(l => l.type_id === 1)
        .reduce((sum, l) => sum + l.total_value, 0);
    });

    this.totalBenefits = totalRevenue;

    // 4. คำนวณ Average ROI: ((Revenue - Expenses) / Expenses) × 100
    // ตรวจ totalExpenses > 0 ก่อนเสมอเพื่อป้องกัน division by zero
    if (totalExpenses > 0) {
      this.averageROI = ((totalRevenue - totalExpenses) / totalExpenses) * 100;
      // Budget Utilization: สัดส่วนค่าใช้จ่ายเทียบกับงบตั้งต้น
      this.budgetUtilization = (totalExpenses / this.totalBudget) * 100;
    }
  }

  // getter คำนวณค่าเมื่อถูกเรียก — กรอง projects ตาม searchTerm แบบ real-time
  get filteredProjects(): Project[] {
    if (!this.searchTerm.trim()) return this.projects;
    const term = this.searchTerm.toLowerCase();
    return this.projects.filter(p =>
      p.project_name.toLowerCase().includes(term)
    );
  }

  // แก้ไข: รับ Project object แทน project_id เพื่อดูสถานะจริง ไม่ใช่ตรวจ ID ตรงๆ
  getStatusClass(project: Project): string {
    return project.status === 'Actual'
      ? 'bg-success-subtle text-success'
      : 'bg-warning-subtle text-warning';
  }

  // คำนวณ ROI รายโปรเจกต์ โดยใช้เฉพาะ Phase ที่ถูกต้อง
  // (ใช้ getRelevantLedgers() เพื่อไม่ให้ Estimated + Actual นับซ้ำกัน)
  getProjectROI(projectId: number): number {
    const relevant = this.getRelevantLedgers(projectId);
    const revenue = relevant
      .filter(l => l.type_id === 2)
      .reduce((s, l) => s + l.total_value, 0);
    const expenses = relevant
      .filter(l => l.type_id === 1)
      .reduce((s, l) => s + l.total_value, 0);
    // ป้องกัน division by zero: ถ้าไม่มีค่าใช้จ่าย ROI = 0
    return expenses > 0 ? ((revenue - expenses) / expenses) * 100 : 0;
  }
}