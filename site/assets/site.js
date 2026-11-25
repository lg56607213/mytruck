/* ================================================
   Mytruck 공통 스크립트
   - 모바일 메뉴 토글
   - 현재 페이지 GNB 활성화
   - 토스트
   ================================================ */
(function () {
  /* 모바일 햄버거 메뉴 */
  var burger = document.querySelector('.burger');
  var gnb = document.querySelector('.gnb');
  if (burger && gnb) {
    burger.addEventListener('click', function () {
      var open = gnb.classList.toggle('show');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // 메뉴 항목을 누르면 닫기
    gnb.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        gnb.classList.remove('show');
        burger.classList.remove('open');
      }
    });
  }

  /* 현재 페이지 메뉴 활성화 */
  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.gnb a').forEach(function (a) {
    var href = (a.getAttribute('href') || '').split('/').pop();
    if (href && href === here) a.classList.add('on');
  });
})();

/* 토스트 */
var __toastTimer = null;
function showToast(msg, ok) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle('ok', !!ok);
  t.classList.add('show');
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
}

/* ================================================
   유입경로 추적
   ------------------------------------------------
   광고 링크 예시:
     https://www.mytruck.kr/quote?src=insta
     https://www.mytruck.kr/quote?src=tiktok&utm_campaign=7월할인
   주소에 붙은 값을 저장해 두었다가 견적·문의 메일에 함께 보냅니다.
   ================================================ */
var MT_TRACK_KEYS = ['src', 'ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
var MT_STORE = 'mt_src';

/* 한국시간 YYYY-MM-DD HH:mm */
function mtNowKST() {
  try {
    var p = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date()).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
    var h = p.hour === '24' ? '00' : p.hour;
    return p.year + '-' + p.month + '-' + p.day + ' ' + h + ':' + p.minute;
  } catch (e) {
    return new Date().toISOString().slice(0, 16).replace('T', ' ');
  }
}

function mtCapture() {
  var q = new URLSearchParams(location.search);
  var got = {}, has = false;
  MT_TRACK_KEYS.forEach(function (k) {
    var v = q.get(k);
    if (v) { got[k] = String(v).slice(0, 60); has = true; }
  });
  // 네이버 검색광고 클릭은 utm 없이 NaPm 만 붙어서 들어온다 (자동 추적 값)
  if (q.get('NaPm')) {
    got.napm = 1;
    if (!got.src && !got.utm_source) got.src = 'naver_ad';
    has = true;
  }

  if (has) {
    got._at = mtNowKST();
    got._page = location.pathname;
    if (document.referrer) got._ref = document.referrer.slice(0, 160);
    try { localStorage.setItem(MT_STORE, JSON.stringify(got)); } catch (e) {}
    return got;
  }

  // 주소에 값이 없으면 이전에 저장해 둔 값 사용 (홈 → 견적 이동 대비)
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(MT_STORE) || 'null'); } catch (e) {}
  if (stored) return stored;

  // 광고 표시는 없지만 외부 사이트(검색 등)에서 처음 들어온 경우 — 처음 한 번만 기록
  var ext = mtExternalHost(document.referrer);
  if (!ext) return null;
  got = { _ext: ext, _at: mtNowKST(), _page: location.pathname, _ref: document.referrer.slice(0, 160) };
  try { localStorage.setItem(MT_STORE, JSON.stringify(got)); } catch (e) {}
  return got;
}

/* 메일에 넣을 한 줄짜리 표기 */
function mtSourceLabel() {
  var s = null;
  try { s = mtCapture(); } catch (e) {}

  if (s) {
    var main = s.src || s.utm_source || s.ref || '';
    if (main === 'naver_ad') main = '네이버 검색광고';
    if (!main && s._ext) main = '외부 유입: ' + s._ext;
    var extra = [];
    if (s.utm_medium)   extra.push('매체 ' + s.utm_medium);
    if (s.utm_campaign) extra.push('캠페인 ' + s.utm_campaign);
    if (s.utm_content)  extra.push('소재 ' + s.utm_content);
    if (s.utm_term)     extra.push('검색어 ' + s.utm_term);
    if (main) {
      return main + (extra.length ? ' (' + extra.join(', ') + ')' : '') +
             (s._at ? ' · 최초유입 ' + s._at : '');
    }
  }
  // 광고 표시가 없으면 어디서 넘어왔는지라도 남김.
  // 우리 사이트 안에서 페이지를 옮긴 것은 외부 유입이 아니다.
  var ext = mtExternalHost(document.referrer);
  return ext ? '외부 유입: ' + ext : '직접 방문';
}

/* 이전 페이지가 다른 사이트였으면 그 도메인, 아니면 '' */
function mtExternalHost(ref) {
  if (!ref) return '';
  try {
    var h = new URL(ref).hostname.replace(/^www\./, '');
    return h && h !== location.hostname.replace(/^www\./, '') ? h : '';
  } catch (e) {
    return '';
  }
}

/* 견적/문의 링크에 현재 유입 파라미터를 그대로 넘겨줌 (새 탭으로 열려도 유지) */
(function mtPassThrough() {
  var q = new URLSearchParams(location.search);
  var keep = new URLSearchParams();
  MT_TRACK_KEYS.forEach(function (k) { if (q.get(k)) keep.set(k, q.get(k)); });
  var qs = keep.toString();
  if (!qs) return;
  document.querySelectorAll('a[href$="quote.html"], a[href$="contact.html"]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href.indexOf('?') === -1) a.setAttribute('href', href + '?' + qs);
  });
})();

/* 페이지 열릴 때 한 번 저장 */
try { mtCapture(); } catch (e) {}

/* 휴대폰 번호 자동 하이픈 */
function fmtPhone(el) {
  var v = el.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 7) v = v.slice(0, 3) + '-' + v.slice(3, 7) + '-' + v.slice(7);
  else if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
  el.value = v;
}

/* ================================================
   문의 저장소 전송
   기존 EmailJS 메일은 그대로 두고, 같은 내용을 저장소에도 남긴다.
   메일은 즉시 알림용, 저장소는 집계용이다.
   (메일 본문 텍스트만으로는 "어떤 키워드로 몇 건 왔는지" 를 셀 수 없다)

   저장 실패는 폼 동작에 영향을 주지 않는다. 조용히 넘어간다.
   ================================================ */
var MT_LEADS_URL = 'https://leads.jdgp.workers.dev/lead';

/* ================================================
   알림 메일 전송
   Cloudflare 메일(/api/notify, src/index.js)로 먼저 보내고,
   실패하면 예전처럼 EmailJS 로 보낸다. 둘 다 실패하면 오류를 던진다.
   params 는 예전 EmailJS 템플릿 변수 그대로 (quote_detail 이 본문).
   ================================================ */
var MT_EMAILJS = { service: 'service_1tfrm9f', template: 'template_tiosvos' };

async function mtSendMail(params) {
  var hp = document.getElementById('mt-hp');
  var body = Object.assign({}, params, hp && hp.value ? { website: hp.value } : {});
  try {
    var res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) return 'cloudflare';
  } catch (e) { /* 아래 EmailJS 로 */ }

  if (typeof emailjs === 'undefined') throw new Error('메일 전송 실패');
  await emailjs.send(MT_EMAILJS.service, MT_EMAILJS.template, params);
  return 'emailjs';
}

function mtSaveLead(payload) {
  var s = {};
  try { s = mtCapture() || {}; } catch (e) {}

  var body = {
    brand: 'mytruck',
    utm_source:   s.utm_source || s.src || '',
    utm_medium:   s.utm_medium || '',
    utm_campaign: s.utm_campaign || '',
    utm_content:  s.utm_content || '',
    utm_term:     s.utm_term || '',
    referrer:     s._ref || document.referrer || '',
    landing:      s._page || location.pathname,
    first_seen:   s._at || ''
  };
  for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) body[k] = payload[k];

  // 허니팟: 화면에 안 보이는 칸이 채워져 있으면 봇이므로 서버가 걸러낸다
  var hp = document.getElementById('mt-hp');
  if (hp && hp.value) body.website = hp.value;

  try {
    return fetch(MT_LEADS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(function () { /* 저장 실패는 무시 */ });
  } catch (e) {
    return Promise.resolve();
  }
}

/* ================================================
   네이버 프리미엄 로그분석 — 전환 보고
   ------------------------------------------------
   폼 전송이 "성공한 순간"에만 부른다.
   페이지 진입만으로 부르면 전환수가 부풀려져 판단이 망가진다.

   네이버 공식 가이드의 현재 방식(wcs.trans, 전환 유형 코드)을 쓴다.
   https://naver.github.io/conversion-tracking/pages/01_script_guide_wcstrans/
     - 견적·문의 접수 = 'lead'(신청완료). 광고 리포트에 전환으로 나온다.
     - 전화 버튼     = 'custom001'. ('call' 유형은 광고 리포트에 나오지 않는다)
   구 방식 wcs.cnv("2") 는 '회원가입'으로 분류되던 잘못된 코드라 제거했다.
   (trans 로 전환이 한 번 나면 같은 유형의 cnv 는 영구히 걸러지므로 둘을 섞지 않는다)
   페이지 하단 공통 스크립트(wcs_do)가 먼저 실행된 뒤에 불려야 한다 — 폼 전송 성공 후라 항상 그렇다.
   ================================================ */
function mtNaverConv(type) {
  try {
    if (!window.wcs || !wcs.trans) return;   // 스크립트 차단·오프라인 대비
    if (!window.wcs_add) window.wcs_add = {};
    wcs_add["wa"] = "s_2ae8a1ab6bae";
    var conv = {};
    conv.type = type;
    wcs.trans(conv);
  } catch (e) {}
}

/* 견적·문의 접수 완료. value 는 예전 호출부 호환용(거래액이 없어 쓰지 않는다) */
function mtConversion(value) {
  mtNaverConv('lead');
}

/* 전화 버튼(tel:) 클릭 = 전화 문의 전환. 페이지가 나중에 그린 버튼도 잡도록 문서 전체에서 받는다 */
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
  if (a) mtNaverConv('custom001');
}, true);
