// src/app/user/form/actual/actual-form1/actual-form1.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Project } from '../../../../models/roi-tracking-model';
import { ProjectService } from '../../../../services/project.service';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'app-actual-form1',
  imports: [RouterLink, CommonModule],
  templateUrl: './actual-form1.html',
  styleUrl: './actual-form1.css',
})
export class ActualForm1 implements OnInit {
  // แสดงเฉพาะโปรเจกต์ที่ status = 'Estimated' (ยังไม่มี Actual)
  estimatedProjects: Project[] = [];
  selectedProjectId: number | null = null;
  isLoading: boolean = false;

  constructor(
    private projectService: ProjectService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute  // อ่าน queryParams จาก URL
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.projectService.getProjects().subscribe({
      next: (projects) => {
        this.estimatedProjects = projects.filter(p => p.status === 'Estimated' || !p.status);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching estimated projects:', err);
        this.toastService.error('ไม่สามารถโหลดข้อมูลโปรเจกต์ได้ กรุณาลองใหม่อีกครั้ง');
        this.isLoading = false;
      }
    });

    // ถ้ามี ?projectId=xxx ใน URL (มาจากปุ่ม Record Actual ใน Home)
    // ให้ pre-select โปรเจกต์นั้นทันที ผู้ใช้ไม่ต้องเลือกซ้ำอีก
    const preSelectId = this.route.snapshot.queryParamMap.get('projectId');
    if (preSelectId) {
      this.selectedProjectId = Number(preSelectId);
    }
  }

  // เลือก / deselect โปรเจกต์
  selectProject(id: number): void {
    // ถ้าคลิก project ที่เลือกอยู่แล้ว → deselect
    this.selectedProjectId = this.selectedProjectId === id ? null : id;
  }

  onNext(): void {
    if (!this.selectedProjectId) {
      this.toastService.warning('กรุณาเลือกโปรเจกต์ที่ต้องการบันทึก Actual');
      return;
    }
    // บันทึก Project ID ชั่วคราวใน localStorage เพื่อส่งต่อไป actual-form2
    localStorage.setItem('current_actual_id', String(this.selectedProjectId));
    this.router.navigate(['/user/actual-form2']);
  }
}
