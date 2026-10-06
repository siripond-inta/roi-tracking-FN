// คำสั่งช่วยของชุดทดสอบ E2E/UAT

export const USERS = {
  owner: 'nichakan@example.com',
  other: 'araya@example.com',
  admin: 'admin@example.com',
  viewer: 'viewer@example.com',
};

const api = () => Cypress.env('apiUrl');

// เข้าสู่ระบบผ่าน API แล้วเปิดหน้าที่ต้องการ (เร็วกว่ากรอกฟอร์ม — การกรอกฟอร์มจริงทดสอบใน UAT-02)
Cypress.Commands.add('visitAs', (email, path) => {
  cy.request('POST', `${api()}/auth/login`, { email, password: Cypress.env('password') }).then(({ body }) => {
    cy.visit(path, {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth_token', body.token);
        win.localStorage.setItem('auth_user', JSON.stringify(body.user));
      },
    });
  });
});

// เรียก API ด้วยบัญชีที่ระบุ (ใช้เตรียม/ลบข้อมูลทดสอบ)
Cypress.Commands.add('apiAs', (email, method, path, body) => {
  return cy.request('POST', `${api()}/auth/login`, { email, password: Cypress.env('password') }).then(({ body: auth }) =>
    cy.request({
      method,
      url: `${api()}${path}`,
      body,
      headers: { Authorization: `Bearer ${auth.token}` },
      failOnStatusCode: false,
    })
  );
});

// ภาพหลักฐานของกรณีทดสอบ (เก็บไว้แนบเอกสาร UAT)
Cypress.Commands.add('evidence', (id) => {
  cy.wait(300);
  cy.screenshot(id, { capture: 'viewport', overwrite: true });
});

// หาส่วนของรายงานจากชื่อหัวข้อ: 'รายได้โดยตรง' | 'ผลประโยชน์ทางอ้อม' | 'ต้นทุน'
// จับจากชื่อภาษาอังกฤษในหัวข้อ เพราะคำว่า "ต้นทุน" ยังอยู่ในชื่อหมวดผลประโยชน์ทางอ้อมด้วย
// (เช่น "การลดต้นทุนจากความผิดพลาด") ถ้าค้นด้วยคำไทยจะได้ส่วนผิด
const SUBTITLE = { 'รายได้โดยตรง': 'Direct Revenue', 'ผลประโยชน์ทางอ้อม': 'Indirect Benefit', 'ต้นทุน': 'Costs' };
const sectionOf = (tag, title) =>
  cy.contains(`${tag} .section-title`, SUBTITLE[title]).closest(tag);

Cypress.Commands.add('section', (title) => sectionOf('app-ledger-section-editor', title));
Cypress.Commands.add('sectionView', (title) => sectionOf('app-ledger-section-view', title));
