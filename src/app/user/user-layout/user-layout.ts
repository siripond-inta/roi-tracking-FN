// src/app/user/user-layout/user-layout.ts
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './user-layout.html',
  styleUrl: './user-layout.css',
})
export class UserLayout {
  // inject AuthService เพื่อให้ template เข้าถึง currentUser() และ logout()
  // ใช้ public เพื่อให้ HTML template ใช้ได้ตรงๆ
  constructor(public authService: AuthService) {}

  logout(): void {
    this.authService.logout(); // ลบ token และ redirect ไป /login
  }
}
