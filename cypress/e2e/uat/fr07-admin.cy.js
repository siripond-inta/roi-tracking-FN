// FR07 การจัดการระบบโดยผู้ดูแล
import { title } from '../../uat/uat-cases';
import { USERS } from '../../support/commands';

const TABS = [
  { button: 'Users', heading: 'User Accounts' },
  { button: 'All Projects', heading: 'All Projects' },
  { button: 'Categories', heading: 'Benefit / Cost Categories' },
  { button: 'Project Types', heading: 'Project Types' },
];

describe('FR07 การจัดการระบบโดยผู้ดูแล', () => {
  it(title('UAT-18'), () => {
    cy.visitAs(USERS.admin, '/admin/user-management');
    cy.window().then((win) => cy.stub(win, 'print').as('print'));
    TABS.forEach(({ button, heading }, i) => {
      cy.contains('.rounded-pill button', button).click();
      cy.contains('.admin-section', heading).within(() => {
        cy.get('tbody tr').should('have.length.at.least', 1);
        cy.contains('button', 'Export PDF').click();
      });
      cy.get('@print').should('have.callCount', i + 1);
      // ระหว่างพิมพ์แสดงเฉพาะหัวข้อนี้ พร้อมหัวกระดาษ
      cy.get('.admin-section').should('have.length', 1);
      cy.get('.print-header').should('contain', heading);
      if (i === 0) cy.evidence('UAT-18');
      cy.window().then((win) => win.dispatchEvent(new Event('afterprint')));
    });
  });

  it(title('UAT-19'), () => {
    const name = `หมวดทดสอบ UAT ${Date.now()}`;
    cy.visitAs(USERS.admin, '/admin/user-management');
    cy.contains('.rounded-pill button', 'Categories').click();
    cy.contains('button', 'เพิ่มหมวดหมู่').click();
    cy.get('.modal-panel-custom').within(() => {
      cy.get('input').first().type(name);
      cy.get('select').first().select('BEN');
      cy.contains('button', 'บันทึก').click();
    });
    cy.get('.modal-panel-custom').should('be.visible'); // ยังไม่มีชื่อหน่วย → บันทึกไม่ได้
    cy.get('.modal-panel-custom').within(() => {
      cy.get('input[placeholder*="ชั่วโมงที่ลดได้"]').type('จำนวนครั้งที่ลดได้ต่อเดือน');
      cy.get('input[placeholder*="อัตราค่าจ้าง"]').type('ต้นทุนต่อครั้ง (บาท)');
      cy.contains('button', 'บันทึก').click();
    });
    cy.contains('tr', name).should('contain', 'BEN');
    cy.evidence('UAT-19');
    cy.contains('tr', name).contains('button', 'ลบ').click();
    cy.get('.swal2-confirm').click();
    cy.contains('tr', name).should('not.exist');
  });
});
