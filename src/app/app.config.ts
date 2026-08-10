// src/app/app.config.ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // ใช้ XHR mode (ไม่ใช้ withFetch) เพื่อให้ Zone.js trigger Change Detection อัตโนมัติ
    // withFetch() ทำให้ response callback ทำงานนอก Zone → ต้องคลิกก่อนข้อมูลถึงขึ้น
    provideHttpClient(withInterceptors([authInterceptor])),
  ]
};
