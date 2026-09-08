// src/app/signup/signup.ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  fullName: string = '';
  companyName: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  showPassword: boolean = false;

  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSignup(): void {
    this.errorMessage = '';
    this.successMessage = '';

    // ─── Validation ─────────────────────────────────────
    if (!this.fullName.trim() || !this.email.trim() || !this.password) {
      this.errorMessage = 'กรุณากรอกข้อมูลให้ครบทุกช่อง';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Password ไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง';
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage = 'Password ต้องมีอย่างน้อย 6 ตัวอักษร';
      return;
    }

    this.isLoading = true;

    this.authService.signup(this.fullName.trim(), this.email.trim(), this.password, this.companyName.trim() || undefined).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'สมัครสมาชิกสำเร็จ! กำลังนำคุณไปหน้า Login...';
        // รอ 1.5 วินาทีแล้ว redirect เพื่อให้ user เห็น success message
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }
}
