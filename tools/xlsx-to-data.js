/* 화물차 가격표 엑셀 → truck-data.js 변환기
 *
 * 사용법 (화물차Online 폴더에서):
 *   node tools/xlsx-to-data.js "화물차 Jason.xlsx"
 *   node tools/xlsx-to-data.js            (인자 없으면 "화물차 Jason.xlsx" 사용)
 *
 * 결과: truck-data.js 를 새로 씁니다. 외부 라이브러리 필요 없음.
 *
 * 엑셀 Sheet1 컬럼 규칙 (2행부터, 위 칸과 같으면 비워두는 방식 그대로 지원)
 *   B 제조사 | C 구분 | D 모델 | E 세부사양 | F 트림 | G 차량가 | H 옵션명 | I 옵션가
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- 최소 ZIP 리더 (xlsx = zip) ---------- */
function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP(EOCD)을 찾지 못했습니다: ' + file);

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = {};

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method   = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen  = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const cmtLen   = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name     = buf.toString('utf8', off + 46, off + 46 + nameLen);

    const lNameLen  = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    entries[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return entries;
}

/* ---------- XLSX 파싱 ---------- */
const unesc = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function colToNum(c) { let n = 0; for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }

function parseRows(zip) {
  const shared = [];
  const ssBuf = zip['xl/sharedStrings.xml'];
  if (ssBuf) {
    for (const m of ssBuf.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      let txt = '';
      for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) txt += t[1];
      shared.push(unesc(txt));
    }
  }

  const sheetBuf = zip['xl/worksheets/sheet1.xml'];
  if (!sheetBuf) throw new Error('xl/worksheets/sheet1.xml 을 찾지 못했습니다');
  const xml = sheetBuf.toString('utf8');

  const rows = [];
  for (const r of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    // 빈 셀 <c .../> 과 값 셀 <c ...>...</c> 를 모두 처리해야 컬럼이 밀리지 않음
    for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>\/]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const idx = colToNum(c[1]) - 1;
      const attrs = c[2] || '', inner = c[3] || '';
      let v = '';
      const im = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
      const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (im) v = unesc(im[1]);
      else if (vm) v = /t="s"/.test(attrs) ? shared[+vm[1]] : vm[1];
      cells[idx] = (v || '').replace(/\s+/g, ' ').trim();
    }
    rows.push({ r: +r[1], c: cells });
  }
  return rows;
}

/* ---------- 트리 구성 ---------- */
function build(rows) {
  const DATA = {};
  let brand = '', cat = '', model = '', body = '', trim = '', curTrim = null;
  let trims = 0, opts = 0;

  for (const { r, c } of rows) {
    if (r < 2) continue;                       // 1행은 헤더
    const g = i => (c[i] === undefined ? '' : c[i]);
    if (g(1)) brand = g(1);                    // B 제조사
    if (g(2)) cat   = g(2);                    // C 구분
    if (g(3)) model = g(3);                    // D 모델
    if (g(4)) body  = g(4);                    // E 세부사양
    const newTrim  = g(5);                     // F 트림
    const price    = g(6);                     // G 차량가
    const optName  = g(7);                     // H 옵션명
    const optPrice = g(8);                     // I 옵션가

    if (!brand || !cat) continue;

    if (newTrim) {
      trim = newTrim;
      DATA[brand]                         = DATA[brand] || {};
      DATA[brand][cat]                    = DATA[brand][cat] || {};
      DATA[brand][cat][model]             = DATA[brand][cat][model] || {};
      DATA[brand][cat][model][body]       = DATA[brand][cat][model][body] || {};
      curTrim = { price: price ? Number(price) : 0, opts: [] };
      DATA[brand][cat][model][body][trim] = curTrim;
      trims++;
    } else if (price && curTrim && !curTrim.price) {
      curTrim.price = Number(price);
    }

    if (optName && curTrim) {
      curTrim.opts.push({ n: optName, p: optPrice ? Number(optPrice) : 0 });
      opts++;
    }
  }
  return { DATA, trims, opts };
}

/* ---------- 실행 ---------- */
const root = path.join(__dirname, '..');
const src  = path.resolve(root, process.argv[2] || '화물차 Jason.xlsx');
const dest = path.join(root, 'site', 'truck-data.js');   // 홈페이지 소스 폴더

console.log('================================================');
console.log(' 화물차 가격표 엑셀  →  truck-data.js  갱신');
console.log('================================================\n');

if (!fs.existsSync(src)) {
  console.error('[오류] 엑셀 파일을 찾을 수 없습니다:');
  console.error('       ' + src);
  console.error('       이 폴더에 엑셀 파일이 있는지 확인해 주세요.');
  process.exit(1);
}

const { DATA, trims, opts } = build(parseRows(readZip(src)));
if (!trims) { console.error('추출된 트림이 없습니다. 엑셀 컬럼 구성을 확인하세요.'); process.exit(1); }

fs.writeFileSync(dest,
  '/* 화물차 리스 견적 - 차량 데이터\n' +
  ' * 원본: ' + path.basename(src) + ' (Sheet1) 자동 변환 — tools/xlsx-to-data.js\n' +
  ' * 구조: 제조사 > 구분 > 모델 > 세부사양 > 트림 = { price: 차량가(원), opts: [{n:옵션명, p:옵션가}] }\n' +
  ' */\n' +
  'const TRUCK_DATA = ' + JSON.stringify(DATA, null, 1) + ';\n', 'utf8');

console.log('완료: site/' + path.basename(dest) + ' 갱신됨');
console.log('  제조사 ' + Object.keys(DATA).length + '개 / 트림 ' + trims + '개 / 옵션 ' + opts + '개');
console.log('  → index.html 을 Ctrl+F5 로 새로고침하면 반영됩니다.');

const noPrice = [];
for (const b in DATA) for (const c in DATA[b]) for (const m in DATA[b][c]) for (const bd in DATA[b][c][m]) for (const t in DATA[b][c][m][bd])
  if (!DATA[b][c][m][bd][t].price) noPrice.push([b, c, m, bd, t].join(' > '));
if (noPrice.length) {
  console.log('  ! 차량가가 비어있는 트림 ' + noPrice.length + '건:');
  noPrice.forEach(x => console.log('    - ' + x));
}
