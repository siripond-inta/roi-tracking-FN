// cypress.config.js — E2E / User Acceptance Test ของ ROI Tracking
// ต้องเปิด backend (http://localhost:3000) และ frontend (http://localhost:4200) ก่อนรัน
// และมีข้อมูลตัวอย่างจาก `npm run db:seed` ฝั่ง backend (บัญชีทดสอบ) — test สร้างข้อมูลของตัวเอง
// แล้วลบทิ้งตอนจบ
const { defineConfig } = require('cypress');
const http = require('node:http');

// `ng serve` บางเครื่องเปิดเฉพาะ IPv6 ([::1]) ขณะที่ Cypress อาจไปเรียก localhost ทาง IPv4 (127.0.0.1)
// แล้วเจอ ECONNREFUSED — ตรวจก่อนว่า frontend ตอบที่ address ไหน แล้วใช้ address นั้น
function reachable(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function resolveBaseUrl(configured) {
  if (process.env.CYPRESS_BASE_URL) return configured;
  for (const candidate of ['http://127.0.0.1:4200', 'http://[::1]:4200']) {
    if (await reachable(candidate)) return candidate;
  }
  return configured; // ไม่ตอบทั้งคู่ — ให้ Cypress แจ้งว่ายังไม่ได้เปิด frontend
}

module.exports = defineConfig({
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'test-reports/e2e',
    reportPageTitle: 'ROI Tracking — E2E / UAT Report (Cypress)',
    reportTitle: 'ROI Tracking — User Acceptance Test',
    charts: true,
    embeddedScreenshots: true,
    inlineAssets: true,
    saveJson: true,
  },
  screenshotsFolder: 'test-reports/e2e/screenshots',
  videosFolder: 'test-reports/e2e/videos',
  downloadsFolder: 'cypress/downloads',
  video: false,
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultCommandTimeout: 10000,
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    env: {
      apiUrl: 'http://localhost:3000/api',
      password: 'Passw0rd!',
    },
    async setupNodeEvents(on, config) {
      require('cypress-mochawesome-reporter/plugin')(on);
      config.baseUrl = await resolveBaseUrl(config.baseUrl);
      return config;
    },
  },
});
