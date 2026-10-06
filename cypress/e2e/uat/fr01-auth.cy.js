// FR01 การยืนยันตัวตนและสิทธิ์ผู้ใช้
import { title } from '../../uat/uat-cases';
import { USERS } from '../../support/commands';

describe('FR01 การยืนยันตัวตนและสิทธิ์ผู้ใช้', () => {
  const email = `uat.${Date.now()}@example.com`;

  after(() => {
    // ลบบัญชีที่สร้างระหว่างทดสอบ
    cy.apiAs(USERS.admin, 'GET', '/admin/users').then(({ body }) => {
      const user = body.data.find((u) => u.email === email);
      if (user) cy.apiAs(USERS.admin, 'DELETE', `/admin/users/${user.user_id}`);
    });
  });

  it(title('UAT-01'), () => {
    cy.visit('/signup');
    cy.get('input[name=fullName]').type('UAT Tester');
    cy.get('input[name=email]').type(email);
    cy.get('input[name=password]').type('secret123');
    cy.get('input[name=confirmPassword]').type('secret123');
    cy.get('button[type=submit]').click();
    cy.get('.alert-success').should('contain', 'สมัครสมาชิกสำเร็จ');
    cy.evidence('UAT-01');
    cy.url().should('include', '/login');
    cy.get('input[name=email]').type(email);
    cy.get('input[name=password]').type('secret123');
    cy.get('button[type=submit]').click();
    cy.url().should('include', '/user/');
    cy.contains('UAT Tester');
  });

  it(title('UAT-02'), () => {
    cy.visit('/login');
    cy.get('input[name=email]').type(USERS.owner);
    cy.get('input[name=password]').type('wrong-password');
    cy.get('button[type=submit]').click();
    cy.get('.alert-danger').should('be.visible');
    cy.get('input[name=password]').clear().type(Cypress.env('password'));
    cy.get('button[type=submit]').click();
    cy.url().should('include', '/user/community');
    cy.contains('Nichakan Boonmee');
    cy.evidence('UAT-02');
  });

  it(title('UAT-03'), () => {
    cy.visitAs(USERS.viewer, '/user/dashboard');
    cy.get('.summary-card').should('have.length.at.least', 1);
    cy.contains('button', 'สร้างโครงการใหม่').should('not.exist');
    cy.visit('/user/projects');
    cy.get('[title="แก้ไขข้อมูลโครงการ"]').should('not.exist');
    cy.get('[title="Delete"]').should('not.exist');
    cy.evidence('UAT-03');
    cy.visit('/user/estimated-form1');
    cy.url().should('include', '/user/dashboard');
  });
});
