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

  if (has) {
    got._at = mtNowKST();
    got._page = location.pathname;
    if (document.referrer) got._ref = document.referrer.slice(0, 160);
    try { localStorage.setItem(MT_STORE, JSON.stringify(got)); } catch (e) {}
    return got;
  }
  // 주소에 값이 없으면 이전에 저장해 둔 값 사용 (홈 → 견적 이동 대비)
  try { return JSON.parse(localStorage.getItem(MT_STORE) || 'null'); } catch (e) { return null; }
}

/* 메일에 넣을 한 줄짜리 표기 */
function mtSourceLabel() {
  var s = null;
  try { s = mtCapture(); } catch (e) {}

  if (s) {
    var main = s.src || s.utm_source || s.ref || '';
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
  // 광고 표시가 없으면 어디서 넘어왔는지라도 남김
  var r = document.referrer || '';
  if (r) {
    try {
      var h = new URL(r).hostname.replace(/^www\./, '');
      if (h && h !== location.hostname.replace(/^www\./, '')) return '외부 유입: ' + h;
    } catch (e) {}
    return '외부 유입';
  }
  return '직접 방문';
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

   type  1 = 회원가입  2 = 신청/상담  3 = 장바구니  4 = 구매  5 = 기타
   화물차는 구매가 아니라 문의가 전환이므로 2 를 쓴다.
   value 는 거래액이 없으므로 0.
   ================================================ */
function mtConversion(value) {
  try {
    if (!window.wcs) return;                 // 스크립트 차단·오프라인 대비
    if (!window.wcs_add) window.wcs_add = {};
    wcs_add["wa"] = "s_2ae8a1ab6bae";
    var p = { type: "2", value: String(value == null ? 0 : value) };
    if (window.wcs.trans) wcs.trans(p);
    else if (window.wcs_trans) wcs_trans(p);
  } catch (e) {}
}
