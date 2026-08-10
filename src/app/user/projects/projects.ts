import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project } from '../../models/roi-tracking-model';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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
    private toastService: ToastService
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

  // ลบโปรเจกต์: เรียก API แล้วโหลด list ใหม่
  deleteProject(projectId: number, projectName: string): void {
    // ถาม confirm ก่อนลบ
    if (!confirm(`ยืนยันลบโปรเจกต์ "${projectName}" ออกจากระบบ?`)) return;

    this.projectService.deleteProject(projectId).subscribe({
      next: () => {
        this.toastService.success(`ลบโปรเจกต์ "${projectName}" เรียบร้อยแล้ว`);
        this.loadProjects(); // โหลดข้อมูลใหม่หลังจากลบเสร็จสิ้น
      },
      error: (err) => {
        console.error('Error deleting project:', err);
        this.toastService.error(`ลบโปรเจกต์ไม่สำเร็จ: ${err.error?.message || 'ข้อผิดพลาดระบบ'}`);
      }
    });
  }

  // navigate ไปหน้า report ที่ถูกต้องตาม status
  viewReport(prj: Project): void {
    // ไม่ต้อง return string เพราะใช้ routerLink ใน template ได้ดีกว่า
    // method นี้เตรียมไว้สำหรับ programmatic navigation ถ้าต้องการในอนาคต
  }
}