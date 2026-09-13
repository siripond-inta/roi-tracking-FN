// src/app/login/login.ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  // ผูกกับ input ผ่าน [(ngModel)]
  email: string = '';
  password: string = '';
  showPassword: boolean = false;

  // สถานะสำหรับ UI
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(private authService: AuthService) {}

  // เรียกเมื่อกด Submit
  onLogin(): void {
    // ล้าง error เดิมก่อน
    this.errorMessage = '';

    // Validation เบื้องต้น
    if (!this.email.trim() || !this.password) {
      this.errorMessage = 'กรุณากรอก Email และ Password';
      return;
    }

    this.isLoading = true;

    // เรียก AuthService.login() ซึ่งจะ POST ไป Backend
    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.isLoading = false;
        // redirect ตาม role ที่ได้จาก Backend — ใช้ window.location.href (full page reload)
        // แทน router.navigate() โดยตั้งใจ เพื่อล้าง state ของ SPA ทั้งหมดจาก session/user ก่อนหน้า
        // ในแท็บเดิม (กันข้อมูลของ user คนเก่าค้างแสดงตอน login เป็นคนใหม่)
        if (response.user.role === 'admin') {
          window.location.href = '/admin/user-management';
        } else {
          window.location.href = '/user/community';
        }
      },
      error: (err) => {
        this.isLoading = false;
        // ดึง error message จาก Backend response
        this.errorMessage = err.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      }
    });
  }

  // สลับแสดง/ซ่อน password
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }
}
