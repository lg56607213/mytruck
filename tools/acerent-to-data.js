/* 에이스렌트 견적기 차량 데이터 → truck-data.js 변환기
 *
 * 사용법 (mytruck 폴더에서):
 *   node tools/acerent-to-data.js
 *   node tools/acerent-to-data.js "../acerent/src/data/quote-data.json"
 *
 * 원본: acerent 저장소의 src/data/quote-data.json (에이스렌트 견적기가 쓰는 가격표)
 *   T: [제조사, 구분, 차종, 라인업, 트림, 기본가, 배기량, 세금구분, 정액세, 잔가그룹, 옵션[[이름,가격]]]
 *   C: [차종, 외장|내장, 색상명, 추가금]
 *
 * 결과: site/truck-data.js 를 새로 씁니다.
 *   TRUCK_DATA   제조사 > 구분 > 모델 > 세부사양 > 트림 = { price, opts: [{n, p}] }
 *   TRUCK_COLORS 제조사 > 구분 > 모델 = { ext: [{n, p}], int: [{n, p}] }
 *
 * 마이트럭에서 파는 차만 가져온다: 세금구분이 '화물'인 차 + PV5 · 레이 전 라인업.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, '..', 'acerent', 'src', 'data', 'quote-data.json');
const OUT = path.join(ROOT, 'site', 'truck-data.js');

if (!fs.existsSync(SRC)) {
  console.error('원본을 찾지 못했습니다: ' + SRC);
  console.error('acerent 저장소를 mytruck 옆 폴더에 받아 두거나, 파일 경로를 직접 적어 주세요.');
  process.exit(1);
}
const DATA = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const FULL_MODELS = new Set(['PV5', '레이']);
const keep = t => t[7] === '화물' || FULL_MODELS.has(t[2]);

/* 에이스 견적기는 '포터II > 포터II 카고' 처럼 차종명에 구분명이 붙어 있다.
   마이트럭은 '포터II > 카고' 로 써 왔고 사진 폴더 이름도 여기서 나오므로 앞부분을 뗀다. */
const modelName = (cat, model) => model.startsWith(cat + ' ') ? model.slice(cat.length + 1) : model;

const data = {}, colorKey = {}, warn = [];
let count = 0;
for (const t of DATA.T) {
  if (!keep(t)) continue;
  const [mk, cat, rawModel, line, trim, price] = t;
  const model = modelName(cat, rawModel);
  const lines = ((data[mk] ||= {})[cat] ||= {})[model] ||= {};
  const trims = lines[line] ||= {};
  if (trims[trim]) warn.push('중복 트림(뒤의 값 사용): ' + [mk, cat, rawModel, line, trim].join(' > '));
  if (!price) warn.push('차량가 없음: ' + [mk, cat, rawModel, line, trim].join(' > '));
  trims[trim] = { price, opts: (t[10] || []).map(([n, p]) => ({ n, p })) };
  colorKey[[mk, cat, model].join('|')] = rawModel;
  count++;
}

/* 색상: 차종명으로 찾고, 특장차는 색상표가 없으면 같은 차의 카고 색상을 쓴다 (캡은 같은 차) */
const colorsOf = raw => {
  const rows = DATA.C.filter(c => c[0] === raw);
  if (rows.length || !/특장차$/.test(raw)) return rows;
  return DATA.C.filter(c => c[0] === raw.replace(/특장차$/, '카고'));
};
const colors = {};
for (const [key, raw] of Object.entries(colorKey)) {
  const rows = colorsOf(raw);
  if (!rows.length) continue;
  const [mk, cat, model] = key.split('|');
  const pick = side => rows.filter(c => c[1] === side).map(c => ({ n: c[2], p: c[3] || 0 }));
  ((colors[mk] ||= {})[cat] ||= {})[model] = { ext: pick('외장'), int: pick('내장') };
}

const head = `/* 화물차 리스 견적 - 차량 데이터
 * 원본: 에이스렌트 견적기 가격표 (acerent/src/data/quote-data.json) 자동 변환 — tools/acerent-to-data.js
 * 구조: 제조사 > 구분 > 모델 > 세부사양 > 트림 = { price: 차량가(원), opts: [{n:옵션명, p:옵션가}] }
 *       TRUCK_COLORS 제조사 > 구분 > 모델 = { ext: 외장 [{n, p}], int: 내장 [{n, p}] }
 */
`;
fs.writeFileSync(OUT, head
  + 'const TRUCK_DATA = ' + JSON.stringify(data, null, 1) + ';\n\n'
  + 'const TRUCK_COLORS = ' + JSON.stringify(colors, null, 1) + ';\n');

warn.forEach(w => console.warn('[주의] ' + w));
console.log(`완료: 트림 ${count}개 → ${path.relative(ROOT, OUT)}`);
