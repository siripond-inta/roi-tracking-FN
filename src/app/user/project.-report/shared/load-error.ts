// แจ้งเตือนเมื่อโหลดรายงานไม่สำเร็จ — แยกกรณี "ไม่พบ/ไม่มีสิทธิ์" (404) ออกจาก error อื่น
// backend ตอบ 404 ทั้งโครงการที่ไม่มีอยู่จริงและโครงการส่วนตัวของคนอื่น (ไม่บอกว่ามี id นั้นไหม)
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

export function showReportLoadError(err: { status?: number } | null | undefined, router: Router): void {
  if (err?.status === 404) {
    Swal.fire({
      icon: 'warning',
      title: 'ไม่พบโครงการนี้',
      text: 'โครงการอาจถูกลบไปแล้ว หรือเป็นโครงการส่วนตัวที่คุณไม่มีสิทธิ์เข้าถึง',
    }).then(() => router.navigate(['/user/projects']));
    return;
  }
  Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: 'กรุณาลองใหม่อีกครั้ง' });
}
