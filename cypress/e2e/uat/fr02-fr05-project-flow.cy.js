// FR02–FR06: วงจรของโครงการตั้งแต่สร้าง → กรอกประมาณการ → คำนวณ → บันทึกผลจริง → เปรียบเทียบ
// → พิมพ์/แชร์ → แก้ไข → ลบ (test ในไฟล์นี้ทำงานต่อเนื่องกันบนโครงการเดียว)
import { title } from '../../uat/uat-cases';
import { USERS } from '../../support/commands';

const NAME = `UAT โครงการทดสอบ ${Date.now()}`;
let projectId;

describe('FR02–FR06 วงจรของโครงการ', () => {
  after(() => {
    if (projectId) cy.apiAs(USERS.owner, 'DELETE', `/projects/${projectId}`);
  });

  it(title('UAT-04'), () => {
    cy.visitAs(USERS.owner, '/user/estimated-form1');
    cy.get('input[name=projectName]').type(NAME);
    cy.get('select[name=projectType]').select('โครงการแบบผสมผสาน');
    cy.contains('นับในการคำนวณ ROI').parent().should('contain', 'รายได้โดยตรง').and('contain', 'ผลประโยชน์ทางอ้อม');
    cy.get('input[name=duration]').clear().type('6');
    cy.get('input[name=budget]').clear().type('100000');
    cy.get('input[name=targetRoi]').clear().type('20');
    cy.evidence('UAT-04');
    cy.contains('button', 'ถัดไป').click();
    cy.url().should('match', /estimated-report\/\d+/).then((url) => {
      projectId = Number(url.match(/estimated-report\/(\d+)/)[1]);
    });
    cy.get('app-ledger-section-editor').should('have.length', 3);
  });

  it(title('UAT-08'), () => {
    cy.visitAs(USERS.owner, `/user/estimated-report/${projectId}?mode=edit`);
    // รายได้โดยตรง: ทุกเดือน เดือน 2–6 เดือนละ 10,000
    cy.section('รายได้โดยตรง').find('.ledger-row-card').first().within(() => {
      cy.contains('button', 'ทุกเดือน').click();
      cy.get('.field-month select').first().select(1);
      cy.get('.field-month select').first().find('option').eq(2).invoke('text').should('match', /เดือนที่ 3 · \S+/);
      cy.get('.amount-input').clear().type('10000');
      cy.contains('รวมรายการนี้').parent().should('contain', '฿50,000');
    });
    // ต้นทุน: ค่าพัฒนาระบบ ครั้งเดียว เดือนที่ 1 = 60,000
    cy.section('ต้นทุน').find('.ledger-row-card').first().within(() => {
      cy.get('select').first().select('INV001');
      cy.contains('button', 'ครั้งเดียว').click();
      cy.get('.field-month').should('have.length', 1);
      cy.get('.amount-input').clear().type('60000');
      cy.contains('รวมรายการนี้').parent().should('contain', '฿60,000');
    });
    cy.evidence('UAT-08');

    // UAT-09: ผลประโยชน์ทางอ้อม 20 ชม. × 250 บาท เดือน 2–6
    cy.section('ผลประโยชน์ทางอ้อม').find('.ledger-row-card').first().within(() => {
      cy.get('select').first().select('BEN001');
      cy.contains('button', 'ทุกเดือน').click();
      cy.get('.field-month select').first().select(1);
      cy.get('.field-qty input').eq(0).clear().type('20');
      cy.get('.field-qty input').eq(1).clear().type('250');
      cy.get('.computed-value').should('contain', '฿5,000');
      cy.contains('รวมรายการนี้').parent().should('contain', '฿25,000');
    });

    // UAT-10: หมวด "อื่นๆ" ต้องระบุชื่อ
    cy.section('ต้นทุน').contains('button', 'เพิ่มต้นทุน').click();
    cy.section('ต้นทุน').find('.ledger-row-card').should('have.length', 2).last().within(() => {
      cy.get('select').first().select('OPCOTH');
      cy.get('.field-custom input').should('have.class', 'is-invalid').type('ค่าโฆษณา');
      cy.contains('button', 'ทุกเดือน').click();
      cy.get('.amount-input').clear().type('1000');
    });
    // ข้อความสถานะอยู่ด้านบนของหน้า (เลื่อนพ้นจอไปแล้ว) — ตรวจว่ามี และพรีวิวคำนวณสำเร็จ
    cy.contains('ตัวเลขด้านบนอัปเดตตามที่กำลังกรอก').should('exist');
    cy.get('.alert-danger').should('not.exist');
    cy.contains('button', 'บันทึกประมาณการ').click();
    cy.get('.swal2-confirm').click();
    cy.get('app-ledger-section-view').should('have.length', 3);
  });

  it(title('UAT-09'), () => {
    cy.visitAs(USERS.owner, `/user/estimated-report/${projectId}`);
    cy.sectionView('ผลประโยชน์ทางอ้อม').within(() => {
      cy.contains('การลดเวลาทำงานของบุคลากร');
      cy.contains('฿5,000');   // มูลค่าต่อเดือน
      cy.contains('฿60,000');  // เทียบรายปี
      cy.contains('฿25,000');  // รวม 5 เดือน
    }).scrollIntoView();
    cy.evidence('UAT-09');
  });

  it(title('UAT-10'), () => {
    cy.visitAs(USERS.owner, `/user/estimated-report/${projectId}`);
    cy.sectionView('ต้นทุน').scrollIntoView().within(() => {
      cy.contains('ค่าโฆษณา');
      cy.contains('ต้นทุนดำเนินงานอื่นๆ (ระบุเอง)');
    });
    cy.evidence('UAT-10');
  });

  it(title('UAT-12'), () => {
    cy.visitAs(USERS.owner, `/user/estimated-report/${projectId}`);
    // ต้นทุน 60,000 + 6 × 1,000 = 66,000 · ผลประโยชน์ 50,000 + 25,000 = 75,000
    cy.get('app-kpi-cards').within(() => {
      cy.contains('13.6%');
      cy.contains('฿9,000');
      cy.contains('฿75,000');
      cy.contains('฿66,000');
      cy.contains('5.3 เดือน');
    });
    cy.evidence('UAT-12');
  });

  it(title('UAT-13'), () => {
    cy.visitAs(USERS.owner, `/user/estimated-report/${projectId}`);
    cy.get('.plain-summary').should('contain', 'ยังไม่คุ้มค่า').and('contain', 'ยังไม่ถึงเป้าหมาย 20%');
    cy.get('app-kpi-cards').should('contain', 'ไม่คุ้มค่า').and('contain', 'เป้า 20%');
    cy.evidence('UAT-13');
  });

  it(title('UAT-11'), () => {
    cy.visitAs(USERS.owner, `/user/actual-report/${projectId}?mode=create`);
    // รายการเตรียมไว้ตามแผน: 4 รายการ พร้อมค่าตามแผนเป็นตัวจางและหมายเหตุจากแผน
    cy.get('app-ledger-section-editor .ledger-row-card').should('have.length', 4);
    cy.get('.plan-hint').should('have.length', 4);
    cy.get('.amount-input').first().should('have.value', '').and('have.attr', 'placeholder', 'แผน 10,000');
    cy.get('.field-custom input').should('have.value', 'ค่าโฆษณา');
    // รายได้จริงเดือน 2–3 เดือนละ 8,000 · ต้นทุนเป็นไปตามแผน
    cy.section('รายได้โดยตรง').find('.ledger-row-card').first().within(() => {
      cy.get('.field-month select').eq(1).select(1);
      cy.get('.amount-input').type('8000');
    });
    cy.section('ต้นทุน').find('.ledger-row-card').first().contains('button', 'ใช้ตัวเลขตามแผน').click();
    cy.section('ต้นทุน').find('.ledger-row-card').first().find('.amount-input').should('have.value', '60000');
    cy.evidence('UAT-11');
    cy.contains('button', 'บันทึก Actual').click();
    cy.get('.swal2-confirm').click();
    cy.get('.compare-table').should('be.visible');
    cy.contains('.status-badge', 'Actual');
  });

  it(title('UAT-15'), () => {
    cy.visitAs(USERS.owner, `/user/actual-report/${projectId}`);
    cy.get('.plain-summary').invoke('text').should('match', /ต่ำกว่าแผน|เท่ากับแผน|สูงกว่าแผน/);
    cy.get('.compare-table tbody tr').should('have.length', 5);
    cy.get('.compare-table .badge').each(($b) => {
      expect($b.text().trim()).to.be.oneOf(['ต่ำกว่าแผน', 'เท่ากับแผน', 'สูงกว่าแผน']);
    });
    cy.get('canvas').should('have.length', 2);
    cy.evidence('UAT-15');
  });

  it(title('UAT-16'), () => {
    cy.visitAs(USERS.owner, `/user/estimated-report/${projectId}`);
    cy.window().then((win) => cy.stub(win, 'print').as('print'));
    cy.get('.print-header').should('contain', NAME);
    cy.contains('button', 'พิมพ์ / PDF').click();
    cy.get('@print').should('have.been.calledOnce');
    cy.visit(`/user/actual-report/${projectId}`);
    cy.window().then((win) => cy.stub(win, 'print').as('print2'));
    cy.contains('button', 'พิมพ์ / PDF').click();
    cy.get('@print2').should('have.been.calledOnce');
    cy.evidence('UAT-16');
  });

  it(title('UAT-17'), () => {
    cy.visitAs(USERS.owner, `/user/actual-report/${projectId}`);
    cy.get('input[role=switch]').should('not.be.checked').click();
    cy.get('.swal2-confirm').click();
    cy.get('input[role=switch]').should('be.checked');
    // ผู้ใช้อื่นเห็นในหน้า Community
    cy.visitAs(USERS.other, '/user/community');
    cy.contains('.project-card', NAME).within(() => {
      cy.get('.roi-hero-number').should('be.visible');
      cy.contains('Nichakan Boonmee');
    });
    cy.evidence('UAT-17');
    cy.contains('.project-card', NAME).contains('ดูรายงาน').click();
    cy.contains('button', 'แก้ไข Actual').should('not.exist');
  });

  it(title('UAT-05'), () => {
    cy.visitAs(USERS.owner, '/user/projects');
    cy.contains('tr', NAME).find('[title="แก้ไขข้อมูลโครงการ"]').click();
    cy.get('.project-edit-panel').within(() => {
      cy.get('input[name=editName]').clear().type(`${NAME} (แก้ไข)`);
      cy.get('select[name=editStatus]').select('completed');
      cy.contains('button', 'บันทึก').click();
    });
    cy.contains('tr', `${NAME} (แก้ไข)`).should('contain', 'Completed');
    cy.evidence('UAT-05');
  });

  it(title('UAT-06'), () => {
    cy.visitAs(USERS.owner, '/user/projects');
    cy.contains('tr', NAME).find('[title="Delete"]').click();
    cy.get('.swal2-confirm').click();
    cy.contains('tr', NAME).should('not.exist');
    cy.evidence('UAT-06');
    projectId = null;
  });
});
