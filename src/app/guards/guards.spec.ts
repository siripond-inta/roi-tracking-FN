// Unit test ของ route guard — จำลองสถานะ login ด้วย localStorage แล้วเรียก guard ใน injection context
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { writerGuard } from './writer.guard';

function loginAs(role: 'admin' | 'project_owner' | 'viewer' | null) {
  localStorage.clear();
  if (role) {
    localStorage.setItem('auth_token', 'fake.jwt.token');
    localStorage.setItem('auth_user', JSON.stringify({ userId: 1, fullName: 'Test', email: 't@example.com', role }));
  }
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
}

function run(guard: typeof authGuard): true | false | string {
  const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
  if (result instanceof UrlTree) return TestBed.inject(Router).serializeUrl(result);
  return result as boolean;
}

describe('Route guards', () => {
  afterEach(() => localStorage.clear());

  it('UT-GRD-01 ยังไม่ล็อกอิน เข้าหน้า /user ไม่ได้ → /login', () => {
    loginAs(null);
    expect(run(authGuard)).toBe('/login');
  });

  it('UT-GRD-02 ล็อกอินแล้วเข้าหน้า /user ได้', () => {
    loginAs('project_owner');
    expect(run(authGuard)).toBe(true);
  });

  it('UT-GRD-03 ผู้ใช้ทั่วไปเข้าหน้า admin ไม่ได้ → /user/community', () => {
    loginAs('project_owner');
    expect(run(adminGuard)).toBe('/user/community');
  });

  it('UT-GRD-04 admin เข้าหน้า admin ได้', () => {
    loginAs('admin');
    expect(run(adminGuard)).toBe(true);
  });

  it('UT-GRD-05 viewer เปิดหน้าสร้างโครงการไม่ได้ → /user/dashboard', () => {
    loginAs('viewer');
    expect(run(writerGuard)).toBe('/user/dashboard');
  });

  it('UT-GRD-06 project owner เปิดหน้าสร้างโครงการได้', () => {
    loginAs('project_owner');
    expect(run(writerGuard)).toBe(true);
  });
});
