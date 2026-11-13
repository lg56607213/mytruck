/* ================================================
   Mytruck Worker
   ------------------------------------------------
   화면은 site/ 정적 파일이 그대로 나가고, 이 Worker 는 /api/* 만 받는다
   (wrangler.jsonc 의 assets.run_worker_first).

   POST /api/notify  견적 · 문의 · 빠른상담 알림 메일
     Cloudflare Email Routing 으로 NOTIFY_TO 주소에 보낸다.
     무료 발송은 Email Routing 에 '인증된 대상 주소'로만 가능하다 — 고객에게는 못 보낸다.
     실패하면 502 를 돌려주고, 화면(site.js mtSendMail)이 EmailJS 로 다시 보낸다.
   ================================================ */
import { EmailMessage } from 'cloudflare:email';

const MAX_BODY = 30000;          // 요청 본문 최대 크기 (견적 상세가 길어도 수 KB)
const RATE_MAX = 5;              // 같은 IP 에서 1분에 최대 5건
const hits = new Map();          // IP → [시각...]  (isolate 하나 안에서만 세는 간이 제한)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/notify') {
      if (request.method !== 'POST') return json({ error: 'POST 만 받습니다.' }, 405);
      return notify(request, env);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: '없는 주소입니다.' }, 404);
    return env.ASSETS.fetch(request);
  },
};

async function notify(request, env) {
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: '내용이 너무 깁니다.' }, 413);
  let p;
  try { p = JSON.parse(text); } catch { return json({ error: '잘못된 요청입니다.' }, 400); }

  // 허니팟: 화면에 안 보이는 칸이 채워져 있으면 봇. 성공한 척하고 버린다.
  if (p.website) return json({ ok: true });

  const detail = str(p.quote_detail || p.message, 20000);
  if (!detail) return json({ error: '내용이 없습니다.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (limited(ip)) return json({ error: '잠시 후 다시 시도해 주세요.' }, 429);

  const name = str(p.customer_name, 100) || '-';
  const title = str(p.car_full, 200) || '홈페이지 접수';
  const email = str(p.customer_email, 200);
  const replyTo = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : '';

  const subject = `[Mytruck] ${title} · ${name}`;
  const html = mailHtml({
    title,
    rows: [
      ['이름/상호', name],
      ['연락처', str(p.customer_phone, 50)],
      ['이메일', email],
      ['예상 차량가', str(p.estimated_price, 50)],
      ['유입경로', str(p.lead_source, 300)],
    ],
    detail,
  });

  const to = String(env.NOTIFY_TO || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!env.MAILER || !env.MAIL_FROM || !to.length) return json({ error: '메일 설정이 없습니다.' }, 502);

  let sent = 0;
  const errors = [];
  for (const addr of to) {
    try {
      const raw = buildMime({ from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: addr, replyTo, subject, html });
      await env.MAILER.send(new EmailMessage(env.MAIL_FROM, addr, raw));
      sent++;
    } catch (e) {
      errors.push(addr + ': ' + (e && e.message ? e.message : e));
    }
  }
  if (errors.length) console.error('notify 발송 실패', errors);
  // 한 곳이라도 받았으면 성공. 전부 실패해야 화면이 EmailJS 로 다시 보낸다 (중복 메일 방지).
  return sent ? json({ ok: true }) : json({ error: '메일 발송에 실패했습니다.' }, 502);
}

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_MAX;
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function mailHtml({ title, rows, detail }) {
  const tr = rows
    .filter(r => r[1] && r[1] !== '-')
    .map(([k, v]) => `<tr><th style="width:110px;text-align:left;padding:8px 10px;background:#f5f5f5;border-bottom:1px solid #e5e5e5">${esc(k)}</th><td style="padding:8px 10px;border-bottom:1px solid #e5e5e5">${esc(v)}</td></tr>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fff;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1a1a1a;font-size:14px">
<div style="max-width:640px;margin:0 auto;border-top:4px solid #C9A84C">
<h1 style="font-size:18px;margin:18px 0 12px">${esc(title)}</h1>
<table style="width:100%;border-collapse:collapse;border-top:2px solid #0A1628">${tr}</table>
<pre style="margin:18px 0 0;padding:14px;background:#f7f7f7;border:1px solid #e5e5e5;font-family:Consolas,'D2Coding','Malgun Gothic',monospace;font-size:13px;line-height:1.6;white-space:pre-wrap">${esc(detail)}</pre>
<p style="margin:20px 0 0;color:#888;font-size:12px">mytruck.kr 홈페이지에서 자동으로 보낸 메일입니다. 고객 이메일이 있으면 답장 버튼으로 바로 회신됩니다.</p>
</div></body></html>`;
}

function b64utf8(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const encodeWord = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`);

function buildMime({ from, fromName, to, replyTo, subject, html }) {
  const domain = from.split('@')[1] || 'localhost';
  const headers = [
    `From: ${fromName ? encodeWord(fromName) + ' ' : ''}<${from}>`,
    `To: <${to}>`,
    replyTo && `Reply-To: <${replyTo}>`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean);
  return headers.join('\r\n') + '\r\n\r\n' + b64utf8(html).replace(/.{1,76}/g, '$&\r\n');
}
