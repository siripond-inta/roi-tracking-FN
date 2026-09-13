import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project } from '../../models/roi-tracking-model';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterLink, RouterModule, CommonModule, FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects implements OnInit {
  projectList: Project[] = [];
  searchTerm: string = ''; // ค่าค้นหาที่ผูกกับ search input
  isLoading: boolean = false; // สถานะโหลดข้อมูล

  constructor(
    private projectService: ProjectService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProjects();
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
    if (!this.searchTerm.trim()) return this.projectList;
    const term = this.searchTerm.toLowerCase();
    return this.projectList.filter(p =>
      p.project_name.toLowerCase().includes(term) ||
      String(p.project_id).includes(term)
    );
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