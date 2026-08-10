// import { Routes } from '@angular/router';
// import { Home } from '../home/home';
// import { Projects } from '../projects/projects';
// import { Settings } from '../settings/settings';
// import { Security } from '../settings/security/security';
// import { EstimatedForm1 } from '../form/estimated/estimated-form1/estimated-form1';
// import { EstimatedForm2 } from '../form/estimated/estimated-form2/estimated-form2';
// import { ActualForm1 } from '../form/actual/actual-form1/actual-form1';
// import { ActualForm2 } from '../form/actual/actual-form2/actual-form2';
// import { Login } from '../user/login/login';
// import { Signup } from '../user/signup/signup';
// import { UserManagement } from '../admin/user-management/user-management';

// export const routes: Routes = [
    
//     { path: 'dashboard', component: Home },
//     { path: 'projects', component: Projects },
// //   { path: 'reports', component: ReportsComponent },
//     { path: 'settings', component: Settings },
//     { path: 'security', component: Security },
//     { path: 'estimated-form1', component: EstimatedForm1 },
//     { path: 'estimated-form2', component: EstimatedForm2 },
//     { path: 'actual-form1', component: ActualForm1 },
//     { path: 'actual-form2', component: ActualForm2 },
//     { path: 'login', component: Login },
//     { path: 'signup', component: Signup },

//     { path: 'user-management', component: UserManagement },

//     { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
// ];


import { Routes } from '@angular/router';

// นำเข้า Component อื่นๆ
import { Home } from './user/home/home';
import { Projects } from './user/projects/projects';
import { Settings } from './user/settings/settings';
import { Security } from './user/settings/security/security';
import { EstimatedForm1 } from './user/form/estimated/estimated-form1/estimated-form1';
import { EstimatedForm2 } from './user/form/estimated/estimated-form2/estimated-form2';
import { ActualForm1 } from './user/form/actual/actual-form1/actual-form1';
import { ActualForm2 } from './user/form/actual/actual-form2/actual-form2';
import { Login } from './login/login'; // แก้ Path ตามที่คุณย้ายมาไว้ข้างนอก
import { Signup } from './signup/signup';
import { UserManagement } from './admin/user-management/user-management';
import { UserLayout } from './user/user-layout/user-layout';
import { AdminLayout } from './admin/admin-layout/admin-layout';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { EstimatedReport } from './user/project.-report/estimated-report/estimated-report';
import { ActualReport } from './user/project.-report/actual-report/actual-report';

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
            { path: 'dashboard', component: Home },
            { path: 'projects', component: Projects },
            { path: 'settings', component: Settings },
            { path: 'security', component: Security },
            { path: 'estimated-form1', component: EstimatedForm1 },
            { path: 'estimated-form2', component: EstimatedForm2 },
            { path: 'actual-form1', component: ActualForm1 },
            { path: 'actual-form2', component: ActualForm2 },
            { path: 'estimated-report/:id', component: EstimatedReport},
            { path: 'actual-report/:id', component: ActualReport},
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
        ]
    },

    // --- 3. กลุ่มหน้า Admin (ต้อง Login และต้องเป็น Admin — adminGuard ตรวจสอบ) ---
    {
        path: 'admin',
        component: AdminLayout,
        canActivate: [adminGuard], // ← Guard: ตรวจ token + role === 'admin'
        children: [
            { path: 'user-management', component: UserManagement },
            { path: '', redirectTo: 'user-management', pathMatch: 'full' }
        ]
    },

    // Default path: ถ้าเปิดมาหน้าแรกให้ไปที่ Login
    { path: '', redirectTo: '/login', pathMatch: 'full' },

    // Wildcard: URL ที่ไม่มีอยู่จริง → ไปหน้า Login
    { path: '**', redirectTo: '/login' }
];