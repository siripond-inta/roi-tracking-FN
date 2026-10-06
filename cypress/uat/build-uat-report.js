// สร้างเอกสาร User Acceptance Test จากผลการรัน Cypress
//   input : cypress/uat/uat-cases.js (ขั้นตอน + ผลที่คาดหวัง), test-reports/e2e/index.json (ผลจริง),
//           test-reports/e2e/screenshots/**/UAT-xx.png (ภาพหลักฐาน)
//   output: test-reports/uat/UAT-report.html (เปิด/พิมพ์เป็น PDF ได้) และ UAT-report.md (วางในเอกสาร)
// รัน: npm run test:uat:report (หลัง npm run test:e2e)

const fs = require('node:fs');
const path = require('node:path');
const { REQUIREMENTS, CASES } = require('./uat-cases');

const ROOT = path.join(__dirname, '..', '..');
const RESULTS = path.join(ROOT, 'test-reports', 'e2e', 'index.json');
const SHOTS = path.join(ROOT, 'test-reports', 'e2e', 'screenshots');
const OUT = path.join(ROOT, 'test-reports', 'uat');

if (!fs.existsSync(RESULTS)) {
  console.error('ไม่พบผลการทดสอบ — รัน `npm run test:e2e` ก่อน');
  process.exit(1);
}

// ── ผลจาก Cypress: จับคู่ด้วยรหัส UAT-xx ที่ขึ้นต้นชื่อ test ────────────────────
const report = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const results = {};
const walk = (suite) => {
  for (const t of suite.tests || []) {
    const id = (t.title.match(/^(UAT-\d+)/) || [])[1];
    if (id) results[id] = { state: t.state, duration: t.duration, error: t.err && t.err.message };
  }
  (suite.suites || []).forEach(walk);
};
report.results.forEach(walk);

// ── ภาพหลักฐาน ─────────────────────────────────────────────────────────────
const shots = {};
const findShots = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) findShots(full);
    else {
      const id = (name.match(/^(UAT-\d+)\.png$/) || [])[1];
      if (id) shots[id] = full;
    }
  }
};
findShots(SHOTS);

const STATUS = {
  passed: { th: 'ผ่าน', en: 'Pass', css: 'pass' },
  failed: { th: 'ไม่ผ่าน', en: 'Fail', css: 'fail' },
  missing: { th: 'ยังไม่ได้ทดสอบ', en: 'Not run', css: 'none' },
};
const statusOf = (id) => STATUS[results[id]?.state === 'passed' ? 'passed' : results[id] ? 'failed' : 'missing'];

const runDate = new Date(report.stats.start || Date.now());
const dateText = runDate.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });
const total = CASES.length;
const passed = CASES.filter((c) => statusOf(c.id).css === 'pass').length;
const failed = CASES.filter((c) => statusOf(c.id).css === 'fail').length;
const notRun = total - passed - failed;

fs.mkdirSync(path.join(OUT, 'evidence'), { recursive: true });
const evidenceFile = (id) => {
  if (!shots[id]) return null;
  const target = path.join(OUT, 'evidence', `${id}.png`);
  fs.copyFileSync(shots[id], target);
  return `evidence/${id}.png`;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── HTML ─────────────────────────────────────────────────────────────────────
const byFr = Object.keys(REQUIREMENTS).map((fr) => {
  const cases = CASES.filter((c) => c.fr === fr);
  const ok = cases.filter((c) => statusOf(c.id).css === 'pass').length;
  return { fr, name: REQUIREMENTS[fr], total: cases.length, ok };
});

const rows = CASES.map((c) => {
  const st = statusOf(c.id);
  const img = evidenceFile(c.id);
  const actual = st.css === 'pass'
    ? 'เป็นไปตามที่คาดหวัง'
    : st.css === 'fail' ? `ไม่เป็นไปตามที่คาดหวัง: ${esc((results[c.id].error || '').split('\n')[0])}` : '-';
  return `
    <tr>
      <td class="id">${c.id}</td>
      <td>${c.fr}</td>
      <td><strong>${esc(c.title)}</strong></td>
      <td><ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></td>
      <td>${esc(c.expected)}</td>
      <td>${actual}</td>
      <td class="status ${st.css}">${st.th}<br><small>${st.en}</small></td>
    </tr>`;
}).join('');

const evidence = CASES.filter((c) => shots[c.id]).map((c) => `
    <figure>
      <img src="evidence/${c.id}.png" alt="${c.id}">
      <figcaption><strong>${c.id}</strong> ${esc(c.title)} — <span class="${statusOf(c.id).css}">${statusOf(c.id).th}</span></figcaption>
    </figure>`).join('');

const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<title>UAT Report — ROI Tracking</title>
<style>
  body { font-family: 'Sarabun', 'Segoe UI', Tahoma, sans-serif; margin: 32px; color: #212529; font-size: 14px; }
  h1 { margin: 0 0 4px; } h2 { margin-top: 32px; border-bottom: 2px solid #198754; padding-bottom: 4px; }
  .meta td { padding: 2px 16px 2px 0; }
  .cards { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
  .card { border: 1px solid #dee2e6; border-radius: 10px; padding: 12px 18px; min-width: 120px; }
  .card b { display: block; font-size: 26px; }
  table.cases, table.fr { border-collapse: collapse; width: 100%; }
  table.cases th, table.cases td, table.fr th, table.fr td { border: 1px solid #dee2e6; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: #f1f3f5; }
  ol { margin: 0; padding-left: 18px; }
  .id { white-space: nowrap; font-weight: 700; }
  .status { text-align: center; font-weight: 700; white-space: nowrap; }
  .pass { color: #198754; } .fail { color: #dc3545; } .none { color: #6c757d; }
  td.status.pass { background: #e9f7ef; } td.status.fail { background: #fdecea; }
  figure { display: inline-block; width: 48%; margin: 0 1% 18px 0; vertical-align: top; break-inside: avoid; }
  figure img { width: 100%; border: 1px solid #dee2e6; border-radius: 6px; }
  .sign td { padding: 28px 24px 4px 0; }
  @media print { body { margin: 10mm; } tr, figure { break-inside: avoid; } }
</style></head><body>
  <h1>เอกสารการทดสอบการยอมรับของผู้ใช้ (User Acceptance Test)</h1>
  <div>ระบบติดตามผลตอบแทนการลงทุน — ROI Tracking</div>
  <table class="meta" style="margin-top:12px">
    <tr><td>วันที่ทดสอบ</td><td>${dateText}</td></tr>
    <tr><td>วิธีทดสอบ</td><td>ทดสอบผ่านเบราว์เซอร์จริงด้วย Cypress ${esc(report.meta?.cypress?.version || '')} ตามขั้นตอนของผู้ใช้</td></tr>
    <tr><td>สภาพแวดล้อม</td><td>Frontend Angular (localhost:4200) · Backend Express + MySQL (localhost:3000) · ข้อมูลตัวอย่างจาก db:seed</td></tr>
  </table>

  <div class="cards">
    <div class="card">กรณีทดสอบทั้งหมด<b>${total}</b></div>
    <div class="card pass">ผ่าน<b>${passed}</b></div>
    <div class="card fail">ไม่ผ่าน<b>${failed}</b></div>
    <div class="card none">ยังไม่ได้ทดสอบ<b>${notRun}</b></div>
    <div class="card">อัตราการผ่าน<b>${total ? ((passed / total) * 100).toFixed(0) : 0}%</b></div>
  </div>

  <h2>สรุปตาม Requirement</h2>
  <table class="fr"><tr><th>Requirement</th><th>หัวข้อ</th><th>จำนวนกรณี</th><th>ผ่าน</th><th>ผล</th></tr>
  ${byFr.map((r) => `<tr><td>${r.fr}</td><td>${esc(r.name)}</td><td>${r.total}</td><td>${r.ok}</td>
    <td class="status ${r.ok === r.total ? 'pass' : 'fail'}">${r.ok === r.total ? 'ผ่าน' : 'ไม่ผ่าน'}</td></tr>`).join('')}
  </table>

  <h2>รายละเอียดกรณีทดสอบ</h2>
  <table class="cases">
    <tr><th>รหัส</th><th>Req.</th><th>กรณีทดสอบ</th><th>ขั้นตอน</th><th>ผลที่คาดหวัง</th><th>ผลที่ได้</th><th>สถานะ</th></tr>
    ${rows}
  </table>

  <h2>ภาพหลักฐานการทดสอบ</h2>
  ${evidence || '<p>ไม่มีภาพหลักฐาน</p>'}

  <h2>การรับรองผล</h2>
  <table class="sign">
    <tr><td>ผู้ทดสอบ ____________________________</td><td>วันที่ ________________</td></tr>
    <tr><td>ผู้ใช้งาน / ผู้รับรอง ____________________________</td><td>วันที่ ________________</td></tr>
  </table>
</body></html>`;

fs.writeFileSync(path.join(OUT, 'UAT-report.html'), html);

// ── Markdown (สำหรับวางในเอกสาร) ──────────────────────────────────────────────
const md = [
  '# เอกสารการทดสอบการยอมรับของผู้ใช้ (UAT) — ROI Tracking',
  '',
  `วันที่ทดสอบ: ${dateText}  `,
  `ผลรวม: ผ่าน ${passed} / ${total} กรณี (ไม่ผ่าน ${failed}, ยังไม่ได้ทดสอบ ${notRun})`,
  '',
  '| รหัส | Req. | กรณีทดสอบ | ขั้นตอน | ผลที่คาดหวัง | สถานะ |',
  '|---|---|---|---|---|---|',
  ...CASES.map((c) => `| ${c.id} | ${c.fr} | ${c.title} | ${c.steps.map((s, i) => `${i + 1}. ${s}`).join('<br>')} | ${c.expected} | ${statusOf(c.id).th} |`),
  '',
].join('\n');
fs.writeFileSync(path.join(OUT, 'UAT-report.md'), md);

console.log(`UAT: ผ่าน ${passed}/${total} (ไม่ผ่าน ${failed}, ยังไม่ได้ทดสอบ ${notRun})`);
console.log(`→ ${path.relative(ROOT, path.join(OUT, 'UAT-report.html'))}`);
console.log(`→ ${path.relative(ROOT, path.join(OUT, 'UAT-report.md'))}`);
process.exitCode = failed || notRun ? 1 : 0;
