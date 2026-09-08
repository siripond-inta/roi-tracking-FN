import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from "@angular/router";

@Component({
  selector: 'app-estimated-form1',
  imports: [RouterLink, FormsModule],
  templateUrl: './estimated-form1.html',
  styleUrl: './estimated-form1.css',
})
export class EstimatedForm1 implements OnInit {
  // ข้อมูลโปรเจกต์ใหม่ที่ผู้ใช้จะกรอก — ใช้ number type ตรงกับ model
  newProjectData = {
    project_name: '',
    project_type_id: 1,       // 1 = Revenue, 2 = Cost Saving, 3 = Compliance
    duration_months: null as number | null,
    initial_budget: null as number | null
  };

  constructor(private router: Router) {}

  // โหลดข้อมูลที่เคยกรอกไว้จาก localStorage (กรณี user กด Back จากหน้า 2 กลับมา)
  ngOnInit(): void {
    const saved = localStorage.getItem('temp_project');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.newProjectData.project_name = data.project_name || '';
        this.newProjectData.project_type_id = Number(data.project_type_id) || 1;
        this.newProjectData.duration_months = data.duration_months ? Number(data.duration_months) : null;
        this.newProjectData.initial_budget = data.initial_budget ? Number(data.initial_budget) : null;
      } catch (e) {
        console.error('Error parsing saved project data:', e);
      }
    }
  }

  onNextStep(): void {
    // Validation: ตรวจสอบข้อมูลจำเป็นก่อนไปขั้นตอนถัดไป
    if (!this.newProjectData.project_name.trim()) {
      alert('กรุณากรอกชื่อโปรเจกต์');
      return; // หยุดทันที ไม่ navigate ต่อ
    }
    if (!this.newProjectData.duration_months || this.newProjectData.duration_months <= 0) {
      alert('กรุณากรอกระยะเวลาโครงการที่ถูกต้อง (มากกว่า 0 เดือน)');
      return;
    }
    if (!this.newProjectData.initial_budget || this.newProjectData.initial_budget <= 0) {
      alert('กรุณากรอกงบประมาณเริ่มต้นที่ถูกต้อง (มากกว่า 0)');
      return;
    }

    // บันทึกข้อมูลชั่วคราวใน localStorage เพื่อส่งต่อไปยัง Step 2
    // localStorage เก็บเป็น String เสมอ ต้องใช้ JSON.stringify/parse เพื่อแปลง Object
    localStorage.setItem('temp_project', JSON.stringify(this.newProjectData));
    this.router.navigate(['/user/estimated-form2']);
  }
}
