import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Project, ProjectLedger } from '../../../models/roi-tracking-model';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-estimated-report',
  imports: [CommonModule, RouterModule],
  templateUrl: './estimated-report.html',
  styleUrl: './estimated-report.css',
})
export class EstimatedReport implements OnInit {
  project?: Project;
  ledger: ProjectLedger[] = [];
  isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    // ดึง ID จาก URL parameter (เช่น /estimated-report/101)
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.isLoading = true;
    forkJoin({
      project: this.projectService.getProjectById(id),
      ledger: this.projectService.getLedgersByProjectId(id)
    }).subscribe({
      next: (result) => {
        this.project = result.project;
        this.ledger = result.ledger;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading estimated report:', err);
        this.isLoading = false;
      }
    });
  }

  // แยก Ledger ตามประเภทเพื่อแสดงในตาราง
  getExpenses(): ProjectLedger[] {
    return this.ledger.filter(l => l.type_id === 1); // type 1 = Expense
  }

  getRevenues(): ProjectLedger[] {
    return this.ledger.filter(l => l.type_id === 2); // type 2 = Revenue
  }

  // ดึงรายการ Category ที่ไม่ซ้ำกันทั้งหมดในโปรเจกต์นี้
  // Set ตัดค่าซ้ำออกโดยอัตโนมัติ, spread [...] แปลงกลับเป็น array
  getUniqueCategories(): string[] {
    return [...new Set(this.ledger.map(l => l.category_id))];
  }

  // สร้างข้อมูลเปรียบเทียบรายแถว สำหรับ Variance Breakdown Table
  getComparisonRow(category: string) {
    const items = this.ledger.filter(l => l.category_id === category);

    // ค้นหายอดของแต่ละ Phase — optional chaining (?.) ป้องกัน error ถ้าไม่พบ
    const estimated = items.find(l => l.phase === 'Estimated')?.total_value || 0;
    const actual = items.find(l => l.phase === 'Actual')?.total_value || 0;
    const variance = actual - estimated;

    return {
      category,
      note: items[0]?.note || '-',
      estimated,
      actual,
      variance,
      // ternary ซ้อนกัน: บวก = up, ลบ = down, ศูนย์ = stable
      status: variance > 0 ? 'up' : (variance < 0 ? 'down' : 'stable')
    };
  }
}
