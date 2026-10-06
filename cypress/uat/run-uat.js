// npm run test:uat — รัน Cypress ทุก spec แล้วสร้างเอกสาร UAT ต่อทันที (สร้างแม้มีกรณีไม่ผ่าน
// เพื่อให้เอกสารบันทึกผลไม่ผ่านไว้ด้วย) ต้องเปิด backend + frontend ไว้ก่อน
const cypress = require('cypress');

// บาง editor/terminal ตั้งตัวแปรนี้ไว้ ทำให้ Cypress (Electron) เปิดไม่ได้
delete process.env.ELECTRON_RUN_AS_NODE;

(async () => {
  const result = await cypress.run({ browser: 'electron' });
  if (result.status === 'failed') {
    console.error(`Cypress เปิดไม่สำเร็จ: ${result.message}`);
    process.exit(1);
  }
  require('./build-uat-report');
  if (result.totalFailed > 0) process.exitCode = 1;
})();
