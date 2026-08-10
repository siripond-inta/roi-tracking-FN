import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from "@angular/router";

@Component({
  selector: 'app-estimated-form1',
  imports: [RouterLink, FormsModule],
  templateUrl: './estimated-form1.html',
  styleUrl: './estimated-form1.css',
})
export class EstimatedForm1 {
  // ข้อมูลโปรเจกต์ใหม่ที่ผู้ใช้จะกรอก — ใช้ string เพราะ input ส่งค่าเป็น string เสมอ
  newProjectData = {
    project_name: '',
    project_type: 'Revenue Project',
    duration_months: '',
    initial_budget: ''
  };

  constructor(private router: Router) {}

  onNextStep(): void {
    // Validation: ตรวจสอบข้อมูลจำเป็นก่อนไปขั้นตอนถัดไป
    if (!this.newProjectData.project_name.trim()) {
      alert('กรุณากรอกชื่อโปรเจกต์');
      return; // หยุดทันที ไม่ navigate ต่อ
    }
    if (!this.newProjectData.initial_budget || Number(this.newProjectData.initial_budget) <= 0) {
      alert('กรุณากรอกงบประมาณเริ่มต้นที่ถูกต้อง (มากกว่า 0)');
      return;
    }

    // บันทึกข้อมูลชั่วคราวใน localStorage เพื่อส่งต่อไปยัง Step 2
    // localStorage เก็บเป็น String เสมอ ต้องใช้ JSON.stringify/parse เพื่อแปลง Object
    localStorage.setItem('temp_project', JSON.stringify(this.newProjectData));
    this.router.navigate(['/user/estimated-form2']);
  }
}
