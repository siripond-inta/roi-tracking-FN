import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Project, ProjectLedger } from '../models/roi-tracking-model';

// Interface สำหรับโครงสร้าง Response ทั่วไปของ backend API
interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

// แปลง ledger หนึ่งแถวเป็น payload ที่ backend รับ — ใช้ร่วมกันทุก endpoint ที่ส่ง ledger
// period_index (FR03-2 งวด/เดือน) และ unit_qty/unit_cost (FR03-4 ประโยชน์ทางอ้อม) ต้องส่งไปด้วย
function toLedgerPayload(l: Partial<ProjectLedger>) {
  return {
    period_index: l.period_index ?? 1,
    type_id: l.type_id,
    category_id: l.category_id,
    unit_qty: l.unit_qty ?? null,
    unit_cost: l.unit_cost ?? null,
    total_value: l.total_value,
    note: l.note,
    transaction_date:
      l.transaction_date instanceof Date
        ? l.transaction_date.toISOString().split('T')[0]
        : l.transaction_date,
  };
}

// ตัวเลขจาก MySQL DECIMAL มาเป็น string — แปลงเป็น number ให้ทุกที่ใช้ต่อได้เลย
function normalizeLedger(l: ProjectLedger): ProjectLedger {
  return {
    ...l,
    ledger_id: Number(l.ledger_id),
    project_id: Number(l.project_id),
    period_index: Number(l.period_index ?? 1),
    type_id: Number(l.type_id),
    unit_qty: l.unit_qty != null ? Number(l.unit_qty) : null,
    unit_cost: l.unit_cost != null ? Number(l.unit_cost) : null,
    total_value: Number(l.total_value || 0),
  };
}

function normalizeProject(p: Project): Project {
  return {
    ...p,
    project_id: Number(p.project_id),
    initial_budget: Number(p.initial_budget || 0),
    target_roi_percent: p.target_roi_percent != null ? Number(p.target_roi_percent) : null,
  };
}

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private http = inject(HttpClient);
  // URL พื้นฐานของระบบ Project API
  private readonly API_URL = 'http://localhost:3000/api/projects';

  // 1. ดึงรายการโปรเจกต์ทั้งหมดจาก MySQL
  getProjects(): Observable<Project[]> {
    return this.http
      .get<ApiResponse<Project[]>>(this.API_URL)
      .pipe(map((res) => (res.data || []).map(normalizeProject)));
  }

  // 1.5 ดึงโปรเจกต์ public ของคนอื่นที่แชร์ไว้ให้ดู (หน้า Community)
  getCommunityProjects(): Observable<Project[]> {
    return this.http
      .get<ApiResponse<Project[]>>(`${this.API_URL}/community`)
      .pipe(map((res) => (res.data || []).map(normalizeProject)));
  }

  // 2. ดึงข้อมูลโปรเจกต์เดียวด้วย ID
  getProjectById(id: number): Observable<Project> {
    return this.http
      .get<ApiResponse<Project>>(`${this.API_URL}/${id}`)
      .pipe(map((res) => normalizeProject(res.data)));
  }

  // 3. ดึงรายการ Ledger ทั้งหมด (ใช้คำนวณ Summary สถิติที่หน้า Dashboard)
  getLedgers(): Observable<ProjectLedger[]> {
    return this.http
      .get<ApiResponse<ProjectLedger[]>>(`${this.API_URL}/ledgers`)
      .pipe(map((res) => (res.data || []).map(normalizeLedger)));
  }

  // 4. ดึงรายการ Ledger ของโปรเจกต์ที่ระบุ
  getLedgersByProjectId(projectId: number): Observable<ProjectLedger[]> {
    return this.http
      .get<ApiResponse<ProjectLedger[]>>(`${this.API_URL}/${projectId}/ledgers`)
      .pipe(map((res) => (res.data || []).map(normalizeLedger)));
  }

  // 5. สร้างโปรเจกต์ใหม่และบันทึกข้อมูล Ledger เริ่มต้น (Estimated)
  // ใช้ switchMap ในการจอง ID และบันทึก Ledger ต่อเนื่องกันใน Stream เดียว
  addProject(newProject: Partial<Project>, initialLedgers: Partial<ProjectLedger>[]): Observable<any> {
    return this.http
      .post<ApiResponse<{ project_id: number }>>(this.API_URL, {
        project_name: newProject.project_name,
        project_type_id: newProject.project_type_id,
        duration_months: newProject.duration_months,
        initial_budget: newProject.initial_budget,
        target_roi_percent: newProject.target_roi_percent ?? null,
      })
      .pipe(
        switchMap((res) => {
          const createdProjectId = res.data.project_id;
          // บันทึก Ledger Phase "Estimated" ไปยังโปรเจกต์ที่สร้างใหม่
          return this.http.post(`${this.API_URL}/${createdProjectId}/ledgers`, {
            phase: 'Estimated',
            ledgers: initialLedgers.map(toLedgerPayload),
          });
        })
      );
  }

  // 6. บันทึกข้อมูลจริง (Actual) ไปยังตาราง project_ledger
  saveActualData(projectId: number, actualLedgers: Partial<ProjectLedger>[]): Observable<any> {
    return this.http.post(`${this.API_URL}/${projectId}/ledgers`, {
      phase: 'Actual',
      ledgers: actualLedgers.map(toLedgerPayload),
    });
  }

  // 7. ลบโปรเจกต์และข้อมูล Ledger ที่เกี่ยวข้อง
  deleteProject(projectId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${projectId}`);
  }

  // 7.5 แก้ไขข้อมูลพื้นฐานของโปรเจกต์ (FR02-2)
  updateProject(projectId: number, changes: Partial<Project>): Observable<any> {
    return this.http.put(`${this.API_URL}/${projectId}`, {
      project_name: changes.project_name,
      project_type_id: changes.project_type_id,
      duration_months: changes.duration_months,
      initial_budget: changes.initial_budget,
      target_roi_percent: changes.target_roi_percent ?? null,
    });
  }

  // 8. สร้างโปรเจกต์อย่างเดียว (ไม่ส่ง Ledger) — ใช้กับ Flow ใหม่ที่บันทึกก่อน navigate
  addProjectOnly(newProject: Partial<Project>): Observable<{ project_id: number }> {
    return this.http
      .post<ApiResponse<{ project_id: number }>>(this.API_URL, {
        project_name: newProject.project_name,
        project_type_id: newProject.project_type_id,
        duration_months: newProject.duration_months,
        initial_budget: newProject.initial_budget,
        target_roi_percent: newProject.target_roi_percent ?? null,
      })
      .pipe(map((res) => res.data));
  }

  // 9. อัปเดต Estimated Ledgers (replace ทั้งหมด)
  updateEstimatedLedgers(projectId: number, ledgers: Partial<ProjectLedger>[]): Observable<any> {
    return this.http.put(`${this.API_URL}/${projectId}/ledgers/estimated`, {
      ledgers: ledgers.map(toLedgerPayload),
    });
  }

  // 10. อัปเดต Actual Ledgers (replace ทั้งหมด)
  updateActualLedgers(projectId: number, ledgers: Partial<ProjectLedger>[]): Observable<any> {
    return this.http.put(`${this.API_URL}/${projectId}/ledgers/actual`, {
      ledgers: ledgers.map(toLedgerPayload),
    });
  }

  // 11. สลับ Public/Private
  toggleVisibility(projectId: number, isPublic: boolean): Observable<any> {
    return this.http.patch(`${this.API_URL}/${projectId}/visibility`, { is_public: isPublic });
  }
}
