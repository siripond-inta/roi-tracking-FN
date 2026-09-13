import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser, AdminProject } from '../../services/admin.service';
import { CategoryService, Category, EntryType } from '../../services/category.service';
import { ToastService } from '../../services/toast.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

interface CategoryFormModel {
  category_id: string; // ใช้ภายในตอนแก้ไข (ระบุแถวที่จะ PUT) — ไม่ให้ admin กรอกหรือเห็นเอง
  category_name: string;
  type_id: number | null;
  category_group: '' | 'INV' | 'OPC' | 'ADC' | 'BEN';
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
  isLoading = false;

  activeTab: 'users' | 'projects' | 'categories' = 'users';
  userSearchTerm = '';
  projectSearchTerm = '';
  categorySearchTerm = '';

  // ─── Category Form (add/edit ใช้ modal ฟอร์มเดียวกัน) ───────────────────────
  showCategoryForm = false;
  categoryFormMode: 'create' | 'edit' = 'create';
  categoryForm: CategoryFormModel = { category_id: '', category_name: '', type_id: null, category_group: '' };
  isSavingCategory = false;

  readonly categoryGroups: { value: 'INV' | 'OPC' | 'ADC' | 'BEN'; label: string }[] = [
    { value: 'INV', label: 'INV — Investment / ลงทุน' },
    { value: 'OPC', label: 'OPC — Operating Cost / ต้นทุนดำเนินการ' },
    { value: 'ADC', label: 'ADC — Additional Cost / ต้นทุนเพิ่มเติม' },
    { value: 'BEN', label: 'BEN — Benefit / ผลประโยชน์' },
  ];

  constructor(
    private adminService: AdminService,
    private categoryService: CategoryService,
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
    }).subscribe({
      next: ({ users, projects, categories, entryTypes }) => {
        this.users = users;
        this.projects = projects;
        this.categories = categories;
        this.entryTypes = entryTypes;
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
    this.categoryForm = { category_id: '', category_name: '', type_id: this.entryTypes[0]?.type_id ?? null, category_group: '' };
    this.showCategoryForm = true;
  }

  openEditCategory(cat: Category): void {
    this.categoryFormMode = 'edit';
    this.categoryForm = {
      category_id: cat.category_id,
      category_name: cat.category_name,
      type_id: cat.type_id,
      category_group: cat.category_group
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

    this.isSavingCategory = true;

    if (this.categoryFormMode === 'create') {
      // category_id ไม่ต้องส่ง — backend สร้างรหัสให้อัตโนมัติตามประเภทที่เลือก
      this.categoryService.createCategory({
        category_name: f.category_name.trim(),
        type_id: f.type_id,
        category_group: f.category_group
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
        category_group: f.category_group
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
}
