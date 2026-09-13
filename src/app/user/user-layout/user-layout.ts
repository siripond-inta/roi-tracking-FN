// src/app/user/user-layout/user-layout.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PageHeaderService } from '../../services/page-header.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './user-layout.html',
  styleUrl: './user-layout.css',
})
export class UserLayout implements OnInit, OnDestroy {
  private navSub?: Subscription;

  constructor(
    public authService: AuthService,
    public pageHeader: PageHeaderService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.updatePageTitle();
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.updatePageTitle());
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  // ตั้งหัวข้อหน้าจาก route data ทุกครั้งที่ navigate — เป็นค่า "เริ่มต้น" ของแต่ละหน้า
  // หน้าที่มีหัวข้อไม่คงที่ (เช่นหน้ารายงานที่โชว์ชื่อโปรเจกต์จริง) จะเรียก pageHeader.set()
  // ทับค่านี้เองอีกทีหลังโหลดข้อมูลเสร็จ
  private updatePageTitle(): void {
    let r = this.route.firstChild;
    while (r?.firstChild) r = r.firstChild;
    const data = r?.snapshot.data ?? {};
    this.pageHeader.set(data['title'] ?? '', data['subtitle'] ?? '');
  }

  async logout(): Promise<void> {
    const result = await Swal.fire({
      icon: 'question',
      title: 'ออกจากระบบ?',
      text: 'คุณต้องการออกจากระบบใช่หรือไม่',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc3545'
    });
    if (result.isConfirmed) {
      this.authService.logout();
    }
  }
}
