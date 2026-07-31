# Mytruck — 화물차 리스 · 할부 홈페이지

정적 웹사이트입니다. 서버 없이 Netlify에 파일만 올리면 동작합니다.
견적요청과 문의하기는 EmailJS를 통해 이메일로 전달됩니다.

- 도메인: **https://mytruck.kr**
- 운영사: (주)제이디엔드

## 폴더 구조

```
화물차Online/
├─ site/                  ← 홈페이지 소스 (여기를 수정합니다)
│   ├─ index.html            홈
│   ├─ about.html            회사소개
│   ├─ products.html         상품안내
│   ├─ board.html            게시판
│   ├─ contact.html          문의하기
│   ├─ quote.html            견적요청하기 (5단계 폼)
│   ├─ truck-data.js         차량 데이터 (엑셀에서 자동 생성)
│   └─ assets/
│       ├─ style.css         공통 디자인
│       ├─ site.js           공통 스크립트 (모바일 메뉴 등)
│       └─ posts.js          게시판 글 데이터  ← 글은 여기에 씁니다
├─ deploy/                ← 배포용 (자동 생성, 직접 수정하지 않습니다)
├─ tools/xlsx-to-data.js  엑셀 → truck-data.js 변환기
├─ 화물차 Jason.xlsx       가격표 원본
├─ 데이터갱신.bat          엑셀 수정 후 실행
├─ 배포파일준비.bat        Netlify에 올릴 deploy 폴더 생성
└─ README.md
```

## 페이지 구성

| 페이지 | 내용 |
|---|---|
| **홈** | 히어로 · 강점 3가지 · 상품 3종 요약 · 정비포함 안내 · 진행 절차 4단계 · CTA |
| **회사소개** | 인사말 · 하는 일 · 회사 개요 표 · 오시는 길 |
| **상품안내** | 3종 비교표 · 운용리스 / 금융리스 / 할부 상세 · 정비포함 상품(4단계) · 계약 조건 |
| **게시판** | 카테고리 필터(공지 · 상품안내 · 이벤트) · 제목 검색 · 목록 · 상세 · 이전/다음 글 |
| **문의하기** | 연락처 안내 · 문의 폼 (EmailJS 전송) |
| **견적요청하기** | 5단계 폼 — 내차만들기 → 외주옵션 → 고객정보 → 계약조건 → 견적받기 |

모든 페이지 상단 우측에 골드 색상 **[견적요청하기]** 버튼이 고정으로 붙어 있습니다.

## 견적요청 폼 5단계

1. **내차만들기** — 제조사 → 차종 구분 → 모델 → 세부사양 → 트림 → 제조사 옵션
   - 트림가 + 선택 옵션가가 실시간 합산되어 **예상 차량가**로 표시됩니다.
2. **외주옵션** — 썬팅 / 블랙박스 / 적재함 바닥 / 공구함 / 파워게이트 + 직접 입력(개수 제한 없음)
3. **고객정보** — 고객 구분(개인 · 개인사업자 · 법인), 상품 종류(할부 · 운용리스 · 금융리스), 운영 방법(영업용 · 자가용)
4. **계약조건** — 선납금, 보증금, 계약기간, 연간 주행거리, 보험 가입, 정비 서비스
5. **견적받기** — 이름·상호, 이메일(필수), 연락처(선택), 개인정보 동의 + 신청 내용 요약

---

## 자주 하는 작업

### 게시판에 글 올리기

`site/assets/posts.js` 를 메모장으로 열고, `POSTS = [` 바로 아래에 아래 형식으로 붙여넣으면 됩니다.

```js
  {
    id: 5,                      // 다른 글과 겹치지 않는 숫자
    cat: '공지',                 // 공지 | 상품안내 | 이벤트
    title: '제목을 여기에',
    date: '2026-08-01',
    top: true,                  // 맨 위 고정 (필요 없으면 이 줄 삭제)
    body: `내용을 여기에 씁니다.

줄바꿈은 그대로 화면에 나옵니다.`
  },
```

저장 후 **배포파일준비.bat → deploy 폴더 드래그**하면 반영됩니다.

### 가격표(차량 데이터) 갱신하기

1. `화물차 Jason.xlsx` 수정
2. **`데이터갱신.bat`** 더블클릭 → `site/truck-data.js` 자동 갱신
3. **`배포파일준비.bat`** 더블클릭
4. `deploy` 폴더를 Netlify에 드래그

엑셀 Sheet1 컬럼 규칙 (2행부터, 위 칸과 같으면 비워두는 병합 방식 그대로 지원):

```
B 제조사 | C 구분 | D 모델 | E 세부사양 | F 트림 | G 차량가 | H 옵션명 | I 옵션가
```

차량가가 비어 있는 트림이 있으면 실행 시 경고로 알려줍니다.

### 배포하기

**`배포파일준비.bat`** 더블클릭 → 열린 `deploy` 폴더를 Netlify 화면의
"Drag and drop your project folder here" 영역에 드래그.

> `화물차Online` 폴더 전체를 드래그하면 안 됩니다.
> 가격표 엑셀이 `https://mytruck.kr/화물차%20Jason.xlsx` 로 공개됩니다.

---

## 연락처

| 항목 | 값 | 표시 위치 |
|---|---|---|
| 대표전화 | `02-6925-0516` | 전 페이지 푸터, about 회사개요표, contact 연락처 카드 |
| 대표이메일 | `jdgp@jdgp.co.kr` | 위와 동일 |
| 주소 | 서울특별시 영등포구 여의대방로 379, 605호 | 전 페이지 푸터, about, contact |

contact / about 에서는 `tel:` · `mailto:` 링크로 걸려 있어 휴대폰에서 바로 통화·메일 작성이 됩니다.
변경 시에는 메모장의 "모두 바꾸기"로 `site` 폴더의 모든 html 을 한 번에 고치시면 됩니다.

## 광고 링크 · 유입경로 추적

`_redirects` 파일 덕분에 아래 짧은 주소가 모두 동작합니다.

| 주소 | 결과 |
|---|---|
| `mytruck.kr/quote` | 견적요청 폼 (홈 안 거침) |
| `mytruck.kr/q` | 견적요청 폼 |
| `/about` `/products` `/board` `/contact` | 각 페이지 |

광고 채널을 구분하려면 뒤에 `?src=` 를 붙이세요.

```
https://www.mytruck.kr/quote?src=insta
https://www.mytruck.kr/quote?src=tiktok
https://www.mytruck.kr/quote?src=tiktok&utm_campaign=7월할인
```

붙인 값은 견적·문의 메일의 **유입경로** 항목에 그대로 찍힙니다.

```
유입경로   : tiktok (캠페인 7월할인) · 최초유입 2026-07-31 09:07
```

동작 방식:

- `src`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `ref` 를 인식합니다.
- 홈(`/?src=insta`)으로 들어와 견적 버튼을 눌러도 값이 따라갑니다.
- 값은 브라우저에 저장되어, 나중에 주소를 직접 입력해 다시 들어와도 유지됩니다.
- 광고 표시가 없으면 어디서 넘어왔는지라도 남깁니다 → `외부 유입: instagram.com`
- 아무 정보도 없으면 → `직접 방문`

## EmailJS 설정

```js
const EMAILJS_PUBLIC_KEY  = "5-wSho3g1I9sELOfE";   // 계정 공용 키
const EMAILJS_SERVICE_ID  = "service_1tfrm9f";     // Mytruck (Gmail)
const EMAILJS_TEMPLATE_ID = "template_tiosvos";    // Mytruck 견적신청
```

`quote.html` 과 `contact.html` 이 **같은 템플릿을 함께 사용합니다.**
템플릿 본문은 반드시 코드(HTML) 모드에서 아래처럼 넣어야 줄바꿈이 유지됩니다.

```html
<pre style="font-family:'Courier New',monospace;font-size:13px;line-height:1.7;">
{{quote_detail}}
</pre>
```

| 항목 | 값 |
|---|---|
| Subject | `[Mytruck 견적신청] {{customer_name}} / {{car_full}}` |
| To Email | 견적·문의를 받을 주소 |
| From Name | `Mytruck 견적신청` |
| Reply To | `{{customer_email}}` |

메일 제목의 `{{car_full}}` 자리에 견적요청은 차량명이, 문의하기는 `문의하기 (문의유형)` 이 표시되어 구분됩니다.

무료 플랜은 **월 200건**이며 계정 전체가 공유합니다.

배포 후에는 EmailJS `Account → Security → Allowed Origins` 에
`https://mytruck.kr` 과 `https://www.mytruck.kr` 을 추가해 주세요.

## 도메인 (가비아 + Netlify)

| 타입 | 호스트 | 값 |
|---|---|---|
| A | `@` | `75.2.60.5` |
| CNAME | `www` | `<사이트이름>.netlify.app.` |

HTTPS 인증서(Let's Encrypt)는 Netlify가 자동 발급·갱신합니다.
