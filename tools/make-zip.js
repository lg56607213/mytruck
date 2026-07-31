/* deploy 폴더 → deploy.zip (표준 ZIP, 경로 구분자 '/')
 * Netlify 드래그가 안 될 때 이 zip 파일을 대신 올리면 됩니다.
 * 배포파일준비.bat 이 자동으로 실행합니다. 외부 라이브러리 불필요.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = path.join(__dirname, '..', 'deploy');
const OUT = path.join(__dirname, '..', 'deploy.zip');

/* CRC32 */
const TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? base + '/' + e.name : e.name;      // 항상 '/' 사용
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(abs, rel));
    else out.push({ rel, abs });
  }
  return out;
}

const files = walk(SRC);
const chunks = [], central = [];
let offset = 0;
const DOS_TIME = 0x9800;   // 19:00
const DOS_DATE = 0x5CFE;   // 2026-07-30

for (const f of files) {
  const name = Buffer.from(f.rel, 'utf8');
  const raw = fs.readFileSync(f.abs);
  const def = zlib.deflateRawSync(raw, { level: 9 });
  const crc = crc32(raw);

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);        // version needed
  lh.writeUInt16LE(0x0800, 6);    // flag: UTF-8 filename
  lh.writeUInt16LE(8, 8);         // method: deflate
  lh.writeUInt16LE(DOS_TIME, 10);
  lh.writeUInt16LE(DOS_DATE, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(def.length, 18);
  lh.writeUInt32LE(raw.length, 22);
  lh.writeUInt16LE(name.length, 26);
  lh.writeUInt16LE(0, 28);
  chunks.push(lh, name, def);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);        // version made by
  ch.writeUInt16LE(20, 6);        // version needed
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt16LE(DOS_TIME, 12);
  ch.writeUInt16LE(DOS_DATE, 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(def.length, 20);
  ch.writeUInt32LE(raw.length, 24);
  ch.writeUInt16LE(name.length, 28);
  ch.writeUInt16LE(0, 30);        // extra
  ch.writeUInt16LE(0, 32);        // comment
  ch.writeUInt16LE(0, 34);        // disk
  ch.writeUInt16LE(0, 36);        // internal attr
  ch.writeUInt32LE((0o100644 << 16) >>> 0, 38);  // external attr (unix rw-r--r--)
  ch.writeUInt32LE(offset, 42);
  central.push(ch, name);

  offset += lh.length + name.length + def.length;
}

const cdBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cdBuf.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

fs.writeFileSync(OUT, Buffer.concat([...chunks, cdBuf, eocd]));
console.log('생성: deploy.zip  (' + fs.statSync(OUT).size.toLocaleString() + ' bytes, ' + files.length + '개 파일)');
files.forEach(f => console.log('  ' + f.rel));
