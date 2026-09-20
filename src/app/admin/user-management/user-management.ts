import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser, AdminProject } from '../../services/admin.service';
import { CategoryService, Category, EntryType } from '../../services/category.service';
import { ProjectTypeService, ProjectType } from '../../services/project-type.service';
import { ToastService } from '../../services/toast.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

interface CategoryFormModel {
  category_id: string; // ใช้ภายในตอนแก้ไข (ระบุแถวที่จะ PUT) — ไม่ให้ admin กรอกหรือเห็นเอง
  category_name: string;
  type_id: number | null;
  category_group: '' | 'INV' | 'OPC' | 'ADC' | 'BEN';
  // FR03-4: หมวดที่คิดจาก "ปริมาณ × อัตรา" ต้องระบุชื่อหน่วยทั้งคู่ (เว้นว่าง = กรอกยอดเงินตรงๆ)
  unit_label: string;
  rate_label: string;
}

interface ProjectTypeFormModel {
  type_id: number | null; // null = เพิ่มใหม่
  type_name: string;
  description: string;
  calculation_method: '' | 'REVENUE' | 'COST_SAVING' | 'MIXED';
}

@Component({
  selector: 'app-user-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.html',
  styleUrl: './user-management.css',
})
export class UserManagement implements OnInit {
  users: AdminUser[] = [];
  projects: AdminProject[] = [];
  categories: Category[] = [];
  entryTypes: EntryType[] = [];
  projectTypes: ProjectType[] = [];
  isLoading = false;

  activeTab: 'users' | 'projects' | 'categories' | 'project-types' = 'users';
  userSearchTerm = '';
  projectSearchTerm = '';
  categorySearchTerm = '';

  // ─── Category Form (add/edit ใช้ modal ฟอร์มเดียวกัน) ───────────────────────
  showCategoryForm = false;
  categoryFormMode: 'create' | 'edit' = 'create';
  categoryForm: CategoryFormModel = {
    category_id: '', category_name: '', type_id: null, category_group: '', unit_label: '', rate_label: ''
  };
  isSavingCategory = false;

  // ─── Project Type Form (FR07-4) ─────────────────────────────────────────────
  showProjectTypeForm = false;
  projectTypeForm: ProjectTypeFormModel = { type_id: null, type_name: '', description: '', calculation_method: '' };
  isSavingProjectType = false;

  readonly calculationMethods: { value: 'REVENUE' | 'COST_SAVING' | 'MIXED'; label: string }[] = [
    { value: 'REVENUE', label: 'REVENUE — เน้นสร้างรายได้' },
    { value: 'COST_SAVING', label: 'COST_SAVING — เน้นลดต้นทุน' },
    { value: 'MIXED', label: 'MIXED — ทั้งเพิ่มรายได้และลดต้นทุน' },
  ];

  readonly categoryGroups: { value: 'INV' | 'OPC' | 'ADC' | 'BEN'; label: string }[] = [
    { value: 'INV', label: 'INV — Investment / ลงทุน' },
    { value: 'OPC', label: 'OPC — Operating Cost / ต้นทุนดำเนินการ' },
    { value: 'ADC', label: 'ADC — Additional Cost / ต้นทุนเพิ่มเติม' },
    { value: 'BEN', label: 'BEN — Benefit / ผลประโยชน์' },
  ];

  constructor(
    private adminService: AdminService,
    private categoryService: CategoryService,
    private projectTypeService: ProjectTypeService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading = true;
    forkJoin({
      users: this.adminService.getUsers(),
      projects: this.adminService.getProjects(),
      categories: this.categoryService.getCategories(),
      entryTypes: this.categoryService.getEntryTypes(),
      projectTypes: this.projectTypeService.getProjectTypes(),
    }).subscribe({
      next: ({ users, projects, categories, entryTypes, projectTypes }) => {
        this.users = users;
        this.projects = projects;
        this.categories = categories;
        this.entryTypes = entryTypes;
        this.projectTypes = projectTypes;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading admin data:', err);
        this.toastService.error('ไม่สามารถโหลดข้อมูลระบบได้');
        this.isLoading = false;
      }
    });
  }

  // ─── Aggregate stats (คำนวณจากข้อมูลจริงทั้งหมด ไม่มีการ hardcode) ──────────
  get totalUsers(): number {
    return this.users.length;
  }

  get activeUserCount(): number {
    return this.users.filter(u => u.is_active).length;
  }

  get dormantCount(): number {
    return this.users.filter(u => u.is_dormant).length;
  }

  get deactivatedCount(): number {
    return this.users.filter(u => !u.is_active).length;
  }

  get totalProjects(): number {
    return this.projects.length;
  }

  get publicProjectCount(): number {
    return this.projects.filter(p => p.is_public).length;
  }

  get totalBudgetTracked(): number {
    return this.projects.reduce((sum, p) => sum + Number(p.initial_budget || 0), 0);
  }

  // ─── Filters ─────────────────────────────────────────────────────────────
  get filteredUsers(): AdminUser[] {
    if (!this.userSearchTerm.trim()) return this.users;
    const term = this.userSearchTerm.toLowerCase();
    return this.users.filter(u =>
      u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }

  get filteredProjects(): AdminProject[] {
    if (!this.projectSearchTerm.trim()) return this.projects;
    const term = this.projectSearchTerm.toLowerCase();
    return this.projects.filter(p =>
      p.project_name.toLowerCase().includes(term) || p.owner_name?.toLowerCase().includes(term)
    );
  }

  get filteredCategories(): Category[] {
    if (!this.categorySearchTerm.trim()) return this.categories;
    const term = this.categorySearchTerm.toLowerCase();
    return this.categories.filter(c =>
      c.category_name.toLowerCase().includes(term) || c.category_id.toLowerCase().includes(term)
    );
  }

  // ─── Actions ─────────────────────────────────────────────────────────────
  async deactivate(user: AdminUser): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: `ปิดใช้งานบัญชี "${user.full_name}"?`,
      text: 'บัญชีนี้ไม่ได้ login มานานเกิน 3 ปีแล้ว การปิดใช้งานจะทำให้ผู้ใช้ login เข้าระบบไม่ได้อีก',
      showCancelButton: true,
      confirmButtonText: 'ปิดใช้งาน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc3545'
    });
    if (!result.isConfirmed) return;

    this.adminService.deactivateUser(user.user_id).subscribe({
      next: () => {
        this.toastService.success(`ปิดใช้งานบัญชี "${user.full_name}" แล้ว`);
        this.loadAll();
      },
      error: (err) => {
        console.error('Error deactivating user:', err);
        this.toastService.error(err.error?.message || 'ปิดใช้งานไม่สำเร็จ');
      }
    });
  }

  // ─── Category CRUD ───────────────────────────────────────────────────────
  openCreateCategory(): void {
    this.categoryFormMode = 'create';
    this.categoryForm = {
      category_id: '',
      category_name: '',
      type_id: this.entryTypes[0]?.type_id ?? null,
      category_group: '',
      unit_label: '',
      rate_label: ''
    };
    this.showCategoryForm = true;
  }

  openEditCategory(cat: Category): void {
    this.categoryFormMode = 'edit';
    this.categoryForm = {
      category_id: cat.category_id,
      category_name: cat.category_name,
      type_id: cat.type_id,
      category_group: cat.category_group,
      unit_label: cat.unit_label || '',
      rate_label: cat.rate_label || ''
    };
    this.showCategoryForm = true;
  }

  closeCategoryForm(): void {
    this.showCategoryForm = false;
  }

  saveCategory(): void {
    const f = this.categoryForm;
    if (!f.category_name.trim() || !f.type_id || !f.category_group) {
      this.toastService.warning('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    // FR03-4: ถ้าจะให้หมวดนี้คิดแบบ ปริมาณ × อัตรา ต้องตั้งชื่อหน่วยทั้งสองช่อง
    const hasUnit = !!f.unit_label.trim();
    const hasRate = !!f.rate_label.trim();
    if (hasUnit !== hasRate) {
      this.toastService.warning('หมวดหมู่แบบคำนวณจากปริมาณ ต้องระบุทั้งชื่อหน่วยปริมาณและชื่ออัตราต่อหน่วย');
      return;
    }

    this.isSavingCategory = true;

    if (this.categoryFormMode === 'create') {
      // category_id ไม่ต้องส่ง — backend สร้างรหัสให้อัตโนมัติตามกลุ่มค่าใช้จ่าย
      this.categoryService.createCategory({
        category_name: f.category_name.trim(),
        type_id: f.type_id,
        category_group: f.category_group,
        unit_label: hasUnit ? f.unit_label.trim() : null,
        rate_label: hasRate ? f.rate_label.trim() : null
      }).subscribe({
        next: () => {
          this.toastService.success('เพิ่มหมวดหมู่ใหม่เรียบร้อยแล้ว');
          this.isSavingCategory = false;
          this.showCategoryForm = false;
          this.loadAll();
        },
        error: (err) => {
          this.isSavingCategory = false;
          this.toastService.error(err.error?.message || 'เพิ่มหมวดหมู่ไม่สำเร็จ');
        }
      });
    } else {
      this.categoryService.updateCategory(f.category_id, {
        category_name: f.category_name.trim(),
        type_id: f.type_id,
        category_group: f.category_group,
        unit_label: hasUnit ? f.unit_label.trim() : null,
        rate_label: hasRate ? f.rate_label.trim() : null
      }).subscribe({
        next: () => {
          this.toastService.success('บันทึกการแก้ไขหมวดหมู่เรียบร้อยแล้ว');
          this.isSavingCategory = false;
          this.showCategoryForm = false;
          this.loadAll();
        },
        error: (err) => {
          this.isSavingCategory = false;
          this.toastService.error(err.error?.message || 'บันทึกไม่สำเร็จ');
        }
      });
    }
  }

  async deleteCategory(cat: Category): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: `ลบหมวดหมู่ "${cat.category_name}"?`,
      text: 'หากมีรายการรายรับ/รายจ่ายที่ใช้หมวดหมู่นี้อยู่ ระบบจะไม่อนุญาตให้ลบ',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc3545'
    });
    if (!result.isConfirmed) return;

    this.categoryService.deleteCategory(cat.category_id).subscribe({
      next: () => {
        this.toastService.success(`ลบหมวดหมู่ "${cat.category_name}" แล้ว`);
        this.loadAll();
      },
      error: (err) => {
        console.error('Error deleting category:', err);
        this.toastService.error(err.error?.message || 'ลบไม่สำเร็จ — อาจมีรายการที่ใช้หมวดหมู่นี้อยู่');
      }
    });
  }

  // ─── Project Type CRUD (FR07-4) ──────────────────────────────────────────
  openCreateProjectType(): void {
    this.projectTypeForm = { type_id: null, type_name: '', description: '', calculation_method: '' };
    this.showProjectTypeForm = true;
  }

  openEditProjectType(type: ProjectType): void {
    this.projectTypeForm = {
      type_id: type.type_id,
      type_name: type.type_name,
      description: type.description || '',
      calculation_method: type.calculation_method || ''
    };
    this.showProjectTypeForm = true;
  }

  closeProjectTypeForm(): void {
    this.showProjectTypeForm = false;
  }

  saveProjectType(): void {
    const f = this.projectTypeForm;
    if (!f.type_name.trim()) {
      this.toastService.warning('กรุณากรอกชื่อประเภทโครงการ');
      return;
    }

    this.isSavingProjectType = true;
    const payload = {
      type_name: f.type_name.trim(),
      description: f.description.trim() || null,
      calculation_method: f.calculation_method || null
    };

    const request$ = f.type_id == null
      ? this.projectTypeService.createProjectType(payload)
      : this.projectTypeService.updateProjectType(f.type_id, payload);

    request$.subscribe({
      next: () => {
        this.toastService.success(f.type_id == null ? 'เพิ่มประเภทโครงการเรียบร้อยแล้ว' : 'บันทึกการแก้ไขเรียบร้อยแล้ว');
        this.isSavingProjectType = false;
        this.showProjectTypeForm = false;
        this.loadAll();
      },
      error: (err) => {
        this.isSavingProjectType = false;
        this.toastService.error(err.error?.message || 'บันทึกไม่สำเร็จ');
      }
    });
  }

  async deleteProjectType(type: ProjectType): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: `ลบประเภทโครงการ "${type.type_name}"?`,
      text: 'หากมีโครงการที่ใช้ประเภทนี้อยู่ ระบบจะไม่อนุญาตให้ลบ',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc3545'
    });
    if (!result.isConfirmed) return;

    this.projectTypeService.deleteProjectType(type.type_id).subscribe({
      next: () => {
        this.toastService.success(`ลบประเภทโครงการ "${type.type_name}" แล้ว`);
        this.loadAll();
      },
      error: (err) => {
        console.error('Error deleting project type:', err);
        this.toastService.error(err.error?.message || 'ลบไม่สำเร็จ — อาจมีโครงการที่ใช้ประเภทนี้อยู่');
      }
    });
  }
}
