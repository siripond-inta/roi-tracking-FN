import { Routes } from '@angular/router';

// หน้า Login / Signup และ layout โหลดทันที ส่วนหน้าอื่นโหลดเมื่อเปิดใช้ (lazy) — ลดขนาด bundle แรก
// (Chart.js / หน้า admin ไม่ต้องโหลดตอนเปิดหน้า Login)
import { Login } from './login/login';
import { Signup } from './signup/signup';
import { UserLayout } from './user/user-layout/user-layout';
import { AdminLayout } from './admin/admin-layout/admin-layout';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { writerGuard } from './guards/writer.guard';

export const routes: Routes = [
    // --- 1. กลุ่มหน้า Login / Signup (ไม่มี Navbar) ---
    { path: 'login', component: Login },
    { path: 'signup', component: Signup },

    // --- 2. กลุ่มหน้า User (ต้อง Login ก่อน — authGuard ตรวจสอบ) ---
    {
        path: 'user',
        component: UserLayout,
        canActivate: [authGuard], // ← Guard: ถ้าไม่มี token → redirect ไป /login
        children: [
            // data: {title, subtitle} อ่านโดย UserLayout เพื่อโชว์หัวข้อหน้าปัจจุบันที่ header
            // ด้านบน — หน้า report/form ไม่ใส่ data ไว้ เพราะมี breadcrumb + หัวข้อของตัวเองอยู่แล้ว
            { path: 'community', loadComponent: () => import('./user/community/community').then((m) => m.Community), data: { title: 'Community', subtitle: 'Public Projects' } },
            { path: 'dashboard', loadComponent: () => import('./user/home/home').then((m) => m.Home), data: { title: 'Dashboard', subtitle: 'Total Project Overview' } },
            { path: 'projects', loadComponent: () => import('./user/projects/projects').then((m) => m.Projects), data: { title: 'Projects', subtitle: 'All Projects' } },
            { path: 'settings', loadComponent: () => import('./user/settings/settings').then((m) => m.Settings), data: { title: 'Settings', subtitle: 'Account Settings' } },
            { path: 'security', loadComponent: () => import('./user/settings/security/security').then((m) => m.Security), data: { title: 'Settings', subtitle: 'Security' } },
            // สร้างโครงการได้เฉพาะ project_owner / admin — viewer ถูกส่งกลับไป Dashboard
            { path: 'estimated-form1', canActivate: [writerGuard], loadComponent: () => import('./user/form/estimated/estimated-form1/estimated-form1').then((m) => m.EstimatedForm1) },
            // ฟอร์ม wizard แบบเก่า (estimated-form2 / actual-form1 / actual-form2) เลิกใช้แล้ว —
            // กรอกข้อมูลทั้งหมดที่หน้ารายงานแทน คง redirect ไว้กันคนที่ bookmark URL เดิมไว้
            { path: 'estimated-form2', redirectTo: 'projects', pathMatch: 'full' },
            { path: 'actual-form1', redirectTo: 'projects', pathMatch: 'full' },
            { path: 'actual-form2', redirectTo: 'projects', pathMatch: 'full' },
            { path: 'estimated-report/:id', loadComponent: () => import('./user/project.-report/estimated-report/estimated-report').then((m) => m.EstimatedReport) },
            { path: 'actual-report/:id', loadComponent: () => import('./user/project.-report/actual-report/actual-report').then((m) => m.ActualReport) },
            { path: '', redirectTo: 'community', pathMatch: 'full' }
        ]
    },

    // --- 3. กลุ่มหน้า Admin (ต้อง Login และต้องเป็น Admin — adminGuard ตรวจสอบ) ---
    {
        path: 'admin',
        component: AdminLayout,
        canActivate: [adminGuard], // ← Guard: ตรวจ token + role === 'admin'
        children: [
            { path: 'user-management', loadComponent: () => import('./admin/user-management/user-management').then((m) => m.UserManagement), data: { title: 'Admin', subtitle: 'Admin Dashboard' } },
            { path: '', redirectTo: 'user-management', pathMatch: 'full' }
        ]
    },

    // Default path: ถ้าเปิดมาหน้าแรกให้ไปที่ Login
    { path: '', redirectTo: '/login', pathMatch: 'full' },

    // Wildcard: URL ที่ไม่มีอยู่จริง → ไปหน้า Login
    { path: '**', redirectTo: '/login' }
];
