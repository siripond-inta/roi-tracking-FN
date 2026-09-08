import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from "@angular/router";
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../../../services/project.service';
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
    project_type_id: 1,
    duration_months: 0 as number,
    initial_budget: 0 as number,
    custom_project_type: ''  // สำหรับ "อื่นๆ"
  };

  isLoading = false;

  constructor(
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    // ไม่โหลดข้อมูลเก่าจาก localStorage แล้ว เพราะ flow ใหม่บันทึก DB ทันที
    // เริ่มต้นเป็นฟอร์มว่าง ค่า default = 0
  }

  // ตรวจสอบว่าเลือก "อื่นๆ" หรือเปล่า
  get isOtherType(): boolean {
    return this.newProjectData.project_type_id === 4;
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
    if (this.isOtherType && !this.newProjectData.custom_project_type.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณาระบุประเภทโปรเจกต์ "อื่นๆ" ของคุณ',
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
      custom_project_type: this.isOtherType ? this.newProjectData.custom_project_type.trim() : undefined
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
