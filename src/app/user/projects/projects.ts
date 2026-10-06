import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PROJECT_STATUS_HINTS, PROJECT_STATUS_LABELS, Project, ProjectStatus } from '../../models/roi-tracking-model';
import { ProjectService } from '../../services/project.service';
import { ProjectTypeService, ProjectType } from '../../services/project-type.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import Swal from 'sweetalert2';
import { PctPipe } from '../project.-report/shared/pct.pipe';

// FR02-2: ฟอร์มแก้ไขข้อมูลพื้นฐานของโครงการ
interface ProjectEditForm {
  project_id: number;
  project_name: string;
  project_type_id: number | null;
  duration_months: number;
  initial_budget: number;
  target_roi_percent: number | null;
  project_status: ProjectStatus;
  has_actual: boolean; // มีผลจริงแล้วกลับไป Estimated ไม่ได้ / ยังไม่มีผลจริงปิดโครงการไม่ได้
  original_status: ProjectStatus; // สถานะก่อนแก้ — Completed ล็อกค่าที่กระทบการคำนวณ
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterLink, RouterModule, CommonModule, FormsModule, PctPipe],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects implements OnInit {
  projectList: Project[] = [];
  searchTerm: string = ''; // ค่าค้นหาที่ผูกกับ search input
  isLoading: boolean = false; // สถานะโหลดข้อมูล

  // ─── แก้ไขโครงการ (FR02-2) ─────────────────────────────────────────────────
  projectTypes: ProjectType[] = [];
  showEditForm = false;
  isSavingEdit = false;
  editForm: ProjectEditForm = {
    project_id: 0, project_name: '', project_type_id: null,
    duration_months: 12, initial_budget: 0, target_roi_percent: null,
    project_status: 'planning', has_actual: false, original_status: 'planning'
  };

  readonly statusLabels = PROJECT_STATUS_LABELS;
  readonly statusHints = PROJECT_STATUS_HINTS;
  readonly editableStatuses: ProjectStatus[] = ['planning', 'in_progress', 'completed'];

  // ─── ตัวกรอง (ปุ่ม filter) — ประเภทโครงการมาจาก database, สถานะคือค่าที่ระบบรองรับ ───────
  showFilters = false;
  filterTypeId: number | null = null;
  filterStatus: ProjectStatus | '' = '';
  filterWorth: '' | 'yes' | 'no' | 'none' = '';

  get activeFilterCount(): number {
    return [this.filterTypeId != null, !!this.filterStatus, !!this.filterWorth].filter(Boolean).length;
  }

  clearFilters(): void {
    this.filterTypeId = null;
    this.filterStatus = '';
    this.filterWorth = '';
    this.pageIndex = 0;
  }

  onFilterChange(): void {
    this.pageIndex = 0;
  }

  // โครงการ Completed ที่ยังคงสถานะเดิม: ห้ามเปลี่ยนประเภท/ระยะเวลา/เป้า ROI (ตัวเลขถูกล็อก — backend ตรวจซ้ำ)
  get editLocked(): boolean {
    return this.editForm.original_status === 'completed' && this.editForm.project_status === 'completed';
  }

  // สถานะที่เลือกได้ในฟอร์มแก้ไข — กฎเดียวกับ backend (backend ตรวจซ้ำอีกชั้น)
  statusDisabled(status: ProjectStatus): boolean {
    if (status === 'planning') return this.editForm.has_actual;
    // Actual/Completed ต้องมีผลจริงก่อน (Actual ระบบตั้งให้เองเมื่อบันทึกผลจริงครั้งแรก)
    if (status === 'completed' || status === 'in_progress') return !this.editForm.has_actual;
    return false;
  }

  constructor(
    private projectService: ProjectService,
    private projectTypeService: ProjectTypeService,
    private toastService: ToastService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProjects();
    this.projectTypeService.getProjectTypes().subscribe({
      next: (types) => (this.projectTypes = types),
      error: () => this.toastService.error('โหลดประเภทโครงการไม่สำเร็จ')
    });
  }

  openEdit(prj: Project): void {
    this.editForm = {
      project_id: prj.project_id,
      project_name: prj.project_name,
      project_type_id: prj.project_type_id ?? null,
      duration_months: prj.duration_months,
      initial_budget: prj.initial_budget,
      target_roi_percent: prj.target_roi_percent ?? null,
      project_status: prj.project_status ?? 'planning',
      has_actual: prj.status === 'Actual',
      original_status: prj.project_status ?? 'planning'
    };
    this.showEditForm = true;
  }

  closeEdit(): void {
    this.showEditForm = false;
  }

  saveEdit(): void {
    const f = this.editForm;
    if (!f.project_name.trim()) {
      this.toastService.warning('กรุณากรอกชื่อโครงการ');
      return;
    }
    if (!f.duration_months || f.duration_months < 1) {
      this.toastService.warning('ระยะเวลาโครงการต้องอย่างน้อย 1 เดือน');
      return;
    }
    if (!f.initial_budget || f.initial_budget <= 0) {
      this.toastService.warning('งบลงทุนเริ่มต้นต้องมากกว่า 0');
      return;
    }

    this.isSavingEdit = true;
    this.projectService.updateProject(f.project_id, {
      project_name: f.project_name.trim(),
      project_type_id: f.project_type_id ?? undefined,
      duration_months: f.duration_months,
      initial_budget: f.initial_budget,
      target_roi_percent: f.target_roi_percent,
      project_status: f.project_status
    }).subscribe({
      next: () => {
        this.isSavingEdit = false;
        this.showEditForm = false;
        this.toastService.success('บันทึกการแก้ไขโครงการเรียบร้อยแล้ว');
        this.loadProjects();
      },
      error: (err) => {
        this.isSavingEdit = false;
        this.toastService.error(err.error?.message || 'บันทึกไม่สำเร็จ');
      }
    });
  }

  // โหลดรายชื่อโปรเจกต์จากฐานข้อมูล
  loadProjects(): void {
    this.isLoading = true;
    this.projectService.getProjects().pipe(
      timeout(10000),
      catchError(err => {
        console.error('Error loading projects:', err);
        this.toastService.error('ไม่สามารถโหลดรายชื่อโปรเจกต์ได้ กรุณาตรวจสอบ server');
        this.isLoading = false;
        return of([]);
      })
    ).subscribe({
      next: (projects) => {
        this.projectList = projects as Project[];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading projects:', err);
        this.toastService.error('ไม่สามารถโหลดรายชื่อโปรเจกต์ได้ กรุณาลองใหม่อีกครั้ง');
        this.isLoading = false;
      }
    });
  }

  // getter: กรองโปรเจกต์ตาม searchTerm แบบ real-time
  get filteredProjects(): Project[] {
    const term = this.searchTerm.trim().toLowerCase();
    const list = this.projectList.filter((p) => {
      if (term && !p.project_name.toLowerCase().includes(term) && !String(p.project_id).includes(term)) return false;
      if (this.filterTypeId != null && Number(p.project_type_id) !== this.filterTypeId) return false;
      if (this.filterStatus && p.project_status !== this.filterStatus) return false;
      if (this.filterWorth === 'yes' && p.is_worthwhile !== true) return false;
      if (this.filterWorth === 'no' && p.is_worthwhile !== false) return false;
      if (this.filterWorth === 'none' && p.is_worthwhile != null) return false;
      return true;
    });
    return this.sortProjects(list);
  }

  // ─── ส่งออก CSV (เปิดด้วย Excel ได้ — ใส่ BOM ให้อ่านภาษาไทยถูก) ───────────────────
  exportCsv(): void {
    const header = [
      'รหัส', 'ชื่อโครงการ', 'ประเภท', 'สถานะ', 'ระยะเวลา (เดือน)', 'งบลงทุนเริ่มต้น',
      'ข้อมูลที่ใช้', 'รายได้โดยตรง', 'ผลประโยชน์ทางอ้อม', 'ผลประโยชน์รวม', 'ต้นทุนรวม',
      'ผลประโยชน์สุทธิ', 'ROI (%)', 'ระยะคืนทุน (เดือน)', 'เป้าหมาย ROI (%)', 'ความคุ้มค่า',
    ];
    const rows = this.filteredProjects.map((p) => [
      `PRJ-${p.project_id}`,
      p.project_name,
      p.project_type ?? '',
      p.project_status ? this.statusLabels[p.project_status] : '',
      p.duration_months,
      p.initial_budget,
      p.summary_phase === 'Actual' ? 'ผลจริง' : 'ประมาณการ',
      p.direct_revenue ?? 0,
      p.indirect_benefit ?? 0,
      p.total_benefit ?? 0,
      p.total_cost ?? 0,
      p.net_profit ?? 0,
      p.roi != null ? Number(p.roi).toFixed(2) : '',
      p.payback_months != null ? Number(p.payback_months).toFixed(1) : '',
      p.target_roi_percent ?? '',
      p.is_worthwhile == null ? '' : p.is_worthwhile ? 'คุ้มค่า' : 'ไม่คุ้มค่า',
    ]);
    const escape = (v: unknown) => {
      const text = String(v ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roi-projects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── เรียงลำดับ + แบ่งหน้า ────────────────────────────────────────────────
  // ตารางนี้โตตามจำนวนโครงการ ถ้า render ทุกแถวพร้อมกันจะช้าและเลื่อนหายาวมาก
  // จึงแบ่งหน้าและให้เลือกคอลัมน์ที่ใช้เรียงได้ (ทำงานฝั่ง client เพราะข้อมูลโหลดมาครบแล้ว)
  sortKey: 'name' | 'budget' | 'duration' | 'created' | 'roi' = 'created';
  sortDir: 'asc' | 'desc' = 'desc';
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50, 100];

  private sortProjects(list: Project[]): Project[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (this.sortKey) {
        case 'name':
          return a.project_name.localeCompare(b.project_name, 'th') * dir;
        case 'budget':
          return (Number(a.initial_budget) - Number(b.initial_budget)) * dir;
        case 'duration':
          return (Number(a.duration_months) - Number(b.duration_months)) * dir;
        case 'roi':
          return (Number(a.roi ?? 0) - Number(b.roi ?? 0)) * dir;
        default:
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
    });
  }

  setSort(key: 'name' | 'budget' | 'duration' | 'created' | 'roi'): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = key === 'name' ? 'asc' : 'desc';
    }
    this.pageIndex = 0;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProjects.length / this.pageSize));
  }

  // แถวที่แสดงจริงบนหน้าปัจจุบัน — clamp หน้าไว้เผื่อผลการค้นหาสั้นลงจนหน้าปัจจุบันเกินช่วง
  get pagedProjects(): Project[] {
    const total = this.filteredProjects.length;
    const maxIndex = Math.max(0, Math.ceil(total / this.pageSize) - 1);
    if (this.pageIndex > maxIndex) this.pageIndex = maxIndex;
    const start = this.pageIndex * this.pageSize;
    return this.filteredProjects.slice(start, start + this.pageSize);
  }

  get pageStart(): number {
    return this.filteredProjects.length === 0 ? 0 : this.pageIndex * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min((this.pageIndex + 1) * this.pageSize, this.filteredProjects.length);
  }

  goToPage(index: number): void {
    this.pageIndex = Math.min(Math.max(0, index), this.totalPages - 1);
  }

  onPageSizeChange(): void {
    this.pageIndex = 0;
  }

  // เลขหน้าที่แสดงบนแถบ pagination — ถ้ามีหลายสิบหน้า จะโชว์แค่ช่วงรอบๆ หน้าปัจจุบัน
  get visiblePages(): number[] {
    const total = this.totalPages;
    const current = this.pageIndex;
    const span = 2;
    const from = Math.max(0, Math.min(current - span, total - (span * 2 + 1)));
    const to = Math.min(total - 1, Math.max(current + span, span * 2));
    const pages: number[] = [];
    for (let i = from; i <= to; i++) pages.push(i);
    return pages;
  }

  // ลบโปรเจกต์: ถาม confirm แบบ modal (กันกดลบพลาด — ลบแล้วกู้คืนไม่ได้) แล้วเรียก API + โหลด list ใหม่
  async deleteProject(projectId: number, projectName: string): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: `ลบโปรเจกต์ "${projectName}"?`,
      text: 'ข้อมูลทั้งหมดของโปรเจกต์นี้ (รวมถึง ledger) จะถูกลบถาวร ไม่สามารถกู้คืนได้',
      showCancelButton: true,
      confirmButtonText: 'ลบโปรเจกต์',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc3545'
    });
    if (!result.isConfirmed) return;

    this.projectService.deleteProject(projectId).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'ลบโปรเจกต์สำเร็จ',
          text: `"${projectName}" ถูกลบออกจากระบบแล้ว`,
          timer: 1800,
          showConfirmButton: false
        });
        this.loadProjects(); // โหลดข้อมูลใหม่หลังจากลบเสร็จสิ้น
      },
      error: (err) => {
        console.error('Error deleting project:', err);
        Swal.fire({
          icon: 'error',
          title: 'ลบโปรเจกต์ไม่สำเร็จ',
          text: err.error?.message || 'เกิดข้อผิดพลาดที่ระบบ กรุณาลองใหม่อีกครั้ง'
        });
      }
    });
  }

  // navigate ไปหน้า report ที่ถูกต้องตาม status (ใช้ตอนคลิกทั้งแถวในตาราง)
  viewReport(prj: Project): void {
    const route = prj.status === 'Actual'
      ? '/user/actual-report'
      : '/user/estimated-report';
    this.router.navigate([route, prj.project_id]);
  }
}