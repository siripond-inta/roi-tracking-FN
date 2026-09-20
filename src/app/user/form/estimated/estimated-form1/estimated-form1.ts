import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from "@angular/router";
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../../../services/project.service';
import { ProjectTypeService, ProjectType } from '../../../../services/project-type.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-estimated-form1',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './estimated-form1.html',
  styleUrl: './estimated-form1.css',
})
export class EstimatedForm1 implements OnInit {
  newProjectData = {
    project_name: '',
    project_type_id: null as number | null,
    duration_months: 0 as number,
    initial_budget: 0 as number,
    target_roi_percent: null as number | null, // FR02-1: เป้าหมาย ROI (%)
  };

  // FR07-4: ประเภทโครงการดึงจาก database ผ่าน API (admin แก้ลิสต์ได้จากหน้า Admin)
  projectTypes: ProjectType[] = [];
  isLoading = false;

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private projectTypeService: ProjectTypeService
  ) {}

  ngOnInit(): void {
    this.projectTypeService.getProjectTypes().subscribe({
      next: (types) => {
        this.projectTypes = types;
        if (this.newProjectData.project_type_id == null && types.length > 0) {
          this.newProjectData.project_type_id = types[0].type_id;
        }
      },
      error: () =>
        Swal.fire({
          icon: 'error',
          title: 'โหลดประเภทโครงการไม่สำเร็จ',
          text: 'กรุณาลองใหม่อีกครั้ง',
          confirmButtonColor: '#dc3545',
        }),
    });
  }

  onNextStep(): void {
    // --- Validation ด้วย SweetAlert ---
    if (!this.newProjectData.project_name.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณากรอกชื่อโปรเจกต์',
        confirmButtonColor: '#198754'
      });
      return;
    }
    if (!this.newProjectData.duration_months || this.newProjectData.duration_months <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'กรุณากรอกระยะเวลาโครงการ (มากกว่า 0 เดือน)',
        confirmButtonColor: '#198754'
      });
      return;
    }
    if (!this.newProjectData.initial_budget || this.newProjectData.initial_budget <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'กรุณากรอกงบลงทุนเริ่มต้น (มากกว่า 0)',
        confirmButtonColor: '#198754'
      });
      return;
    }
    if (!this.newProjectData.project_type_id) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณาเลือกประเภทโครงการ',
        confirmButtonColor: '#198754'
      });
      return;
    }

    this.isLoading = true;

    // บันทึกลงฐานข้อมูลทันที แล้วค่อย navigate ไปหน้า Report
    this.projectService.addProjectOnly({
      project_name: this.newProjectData.project_name.trim(),
      project_type_id: this.newProjectData.project_type_id,
      duration_months: this.newProjectData.duration_months,
      initial_budget: this.newProjectData.initial_budget,
      target_roi_percent: this.newProjectData.target_roi_percent
    }).subscribe({
      next: (data) => {
        this.isLoading = false;
        // Navigate ไปหน้า Estimated Report พร้อม mode=edit (เพื่อกรอกข้อมูลต่อ)
        this.router.navigate(['/user/estimated-report', data.project_id], {
          queryParams: { mode: 'create' }
        });
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error creating project:', err);
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: err.error?.message || 'ไม่สามารถสร้างโปรเจกต์ได้ กรุณาลองใหม่',
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }
}
