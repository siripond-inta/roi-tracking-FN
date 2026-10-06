// FR02 รายการโครงการ (ค้นหา/กรอง/CSV) และ FR05 Dashboard — ใช้ข้อมูลตัวอย่างจาก seed (อ่านอย่างเดียว)
import { title } from '../../uat/uat-cases';
import { USERS } from '../../support/commands';

describe('FR02 / FR05 ภาพรวมโครงการ', () => {
  it(title('UAT-07'), () => {
    cy.visitAs(USERS.owner, '/user/projects');
    cy.get('table tbody tr').should('have.length.at.least', 3);
    cy.get('[title="ตัวกรอง"]').click();
    cy.contains('label', 'สถานะ').parent().find('select').select('Completed');
    // ตรวจทุกแถวพร้อมกัน (Angular อาจ render ตารางใหม่ระหว่างตรวจทีละแถว)
    cy.get('table tbody tr').should(($rows) => {
      expect($rows.length).to.be.greaterThan(0);
      $rows.each((_, tr) => expect(tr.textContent).to.contain('Completed'));
    });
    cy.evidence('UAT-07');
    cy.contains('button', 'CSV').click();
    const file = `cypress/downloads/roi-projects-${new Date().toISOString().slice(0, 10)}.csv`;
    cy.readFile(file).should((csv) => {
      expect(csv).to.contain('ผลประโยชน์ทางอ้อม');
      expect(csv).to.contain('ระยะคืนทุน (เดือน)');
      expect(csv).to.contain('Completed');
    });
  });

  it(title('UAT-14'), () => {
    cy.visitAs(USERS.owner, '/user/dashboard');
    cy.get('.summary-card').should('have.length', 4);
    cy.contains('ผลตอบแทน (ROI) ของแต่ละโครงการ').should('be.visible');
    cy.get('canvas').should('have.length', 1);
    cy.get('.compare-list .list-group-item').should('have.length.at.least', 1).first()
      .invoke('text').should('match', /ต่ำกว่าแผน|เท่ากับแผน|สูงกว่าแผน/);
    cy.get('.project-card .roi-hero-number').should('have.length.at.least', 3)
      .first().invoke('text').should('match', /-?\d+\.\d%/);
    cy.evidence('UAT-14');
  });
});
