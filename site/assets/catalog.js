/* ================================================
   Mytruck 차량 카탈로그
   ------------------------------------------------
   truck-data.js 의 TRUCK_DATA 를 홈 화면 카드 목록으로 변환한다.
   차량 데이터 자체는 엑셀에서 자동 생성되므로 여기서 건드리지 않고,
   "어느 탭에 넣을지 / 어떤 배지를 붙일지 / 어떤 사진을 쓸지"만 정한다.

   ※ 차량이 추가돼도 이 파일은 대부분 그대로 둬도 된다.
     아래 RULES 의 키워드로 자동 분류되고, 못 찾으면 '화물'로 들어간다.
   ================================================ */

/* ── 탭 ───────────────────────────────────────── */
const CAT_TABS = [
  { key: "all",     label: "전체" },
  { key: "cargo",   label: "화물" },
  { key: "special", label: "특장" },
  { key: "van",     label: "승합·승용" },
];

/* ── 사진 ──────────────────────────────────────
   차량 한 대당 폴더 하나. 그 안에 photo.jpg 를 넣으면 그 차 카드에 나온다.

     site/assets/cars/포터II_냉동탑차/photo.jpg
     site/assets/cars/포터II_윙바디/photo.jpg

   파일 이름은 photo.png 또는 photo.jpg 둘 다 된다.
   폴더 이름은 카드에 보이는 차량명에서 만든다 (괄호·띄어쓰기는 _ 로).
   차끼리 사진을 돌려 쓰거나 대신 찾아주는 동작은 없다.
   그 차 폴더에 사진이 없으면 회색 트럭 그림이 나온다.

   ※ 겉모습이 같은 차(스타리아 / 스타리아 Hybrid, 카고 2WD / 4WD 등)는
     같은 사진 파일을 각 폴더에 하나씩 넣으면 된다.               */
function carFolder(name) {
  return name
    .replace(/\(/g, "_").replace(/\)/g, "")   // 냉동탑차(킹캡) → 냉동탑차_킹캡
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/_$/, "");
}

/* ── 분류 규칙 ────────────────────────────────
   위에서부터 먼저 걸리는 규칙을 따른다.                        */
const RULES = [
  // 특장 — 짐칸을 따로 제작해 올리는 차
  { cat: "special", any: ["탑차", "내장탑", "윙바디", "파워게이트", "덤프", "냉동", "냉장", "특장", "샤시캡"] },
  // 승합·승용 — 사람이 타는 차
  { cat: "van",     any: ["패신저", "WAV", "스타리아"] },
  { cat: "van",     model: "레이", not: ["밴"] },
  // 나머지는 화물
];

/* 카드 순서 — 주력 차종을 앞에 둔다. 여기 없는 차는 뒤로, 같은 차끼리는 싼 순. */
const MODEL_ORDER = [
  "포터II", "봉고3 EV", "포터II Electric", "ST1", "PV5", "스타리아", "스타리아 Hybrid", "레이",
];

/* 전기차 — 이름만으로는 알 수 없는 차종은 여기에 적는다 */
const EV_MODELS = new Set(["PV5"]);
function isEV(v) {
  return EV_MODELS.has(v.model) || /전기|EV|Electric/i.test(v.model + v.cat);
}

/* 배지 — 카드 왼쪽 위에 붙는 색 라벨 */
function badgeOf(v) {
  if (isEV(v))                return { text: "전기차", tone: "ev" };
  if (v.tab === "special")    return { text: "특장", tone: "special" };
  if (/4WD/.test(v.body))     return { text: "4WD", tone: "plain" };
  return null;
}

/* 해시태그 — 카드 아래 회색 글씨 */
function tagsOf(v) {
  const t = [];
  if (v.tab === "special") t.push("#특장제작");
  if (isEV(v)) t.push("#무공해차", "#보조금");
  // 냉동과 냉장은 다른 차다 — 태그를 섞으면 검색 결과도 섞인다
  if (/냉동/.test(v.body)) t.push("#냉동탑");
  else if (/냉장/.test(v.body)) t.push("#냉장탑");
  if (/초장축|장축/.test(v.body + v.model)) t.push("#초장축");
  if (v.tab === "van") t.push(v.model === "레이" ? "#경차" : "#승합");
  if (t.length < 2) t.push("#리스가능", "#할부가능");
  return t.slice(0, 3);
}

/* ── 아래부터는 손댈 일이 거의 없다 ──────────── */

/* 이 이름들은 "분류"이고, 그 아래 단계가 실제 차량명이다.
   반대로 여기 없는 이름(예: 포터II)은 그 자체가 차량명이다. */
const GROUP_KEYS = new Set(["수소/전기차", "MPV", "전기차", "PBV", "승용"]);

function classify(v) {
  // v.sub 은 데이터상 한 단계 위 이름이다. '포터II > 특장차 > 시티밴' 처럼
  // 차량명에는 안 드러나지만 분류에는 필요한 정보가 여기 들어 있다.
  const hay = v.model + " " + v.body + " " + v.cat + " " + v.sub;
  for (const r of RULES) {
    if (r.model && v.model !== r.model) continue;
    if (r.any && !r.any.some(k => hay.includes(k))) continue;
    if (r.not && r.not.some(k => hay.includes(k))) continue;
    return r.cat;
  }
  return "cargo";
}

/* TRUCK_DATA → 카드 배열 */
function buildCatalog() {
  const out = [];
  for (const brand of Object.keys(TRUCK_DATA)) {
    for (const cat of Object.keys(TRUCK_DATA[brand])) {
      const isGroup = GROUP_KEYS.has(cat);
      for (const lv3 of Object.keys(TRUCK_DATA[brand][cat])) {
        for (const lv4 of Object.keys(TRUCK_DATA[brand][cat][lv3])) {
          // 계층이 두 가지라 여기서 맞춘다.
          //   분류가 있는 경우 : 브랜드 > 분류 > 차량명 > 세부사양
          //   분류가 없는 경우 : 브랜드 > 차량명 > 세부구분 > 세부사양
          const model = isGroup ? lv3 : cat;
          const body  = isGroup ? lv4 : (lv3 === "특장차" ? lv4 : lv3 + " " + lv4);

          const trims = TRUCK_DATA[brand][cat][lv3][lv4];
          const prices = Object.values(trims)
            .map(t => t && t.price)
            .filter(p => typeof p === "number" && p > 0);
          if (!prices.length) continue;

          const v = {
            brand, cat, model, body, sub: lv3,
            // 견적 폼에 그대로 넘길 실제 데이터 경로
            path: { brand, cat, model: lv3, body: lv4 },
            name: (model + " " + body).replace(/\s+/g, " ").trim(),
            price: Math.min(...prices),
            trimCount: prices.length,
          };
          v.tab = classify(v);
          v.badge = badgeOf(v);
          v.tags = tagsOf(v);
          v.folder = carFolder(v.name);
          // 확장자는 png / jpg 둘 다 받는다. 앞의 것이 없으면 다음 것을 찾는다.
          v.imgs = ["png", "jpg"].map(
            ext => "assets/cars/" + encodeURIComponent(v.folder) + "/photo." + ext);
          v.img = v.imgs[0];
          out.push(v);
        }
      }
    }
  }
  // 주력 차종 먼저, 같은 차종끼리는 싼 순
  const rank = m => { const i = MODEL_ORDER.indexOf(m); return i < 0 ? MODEL_ORDER.length : i; };
  return out.sort((a, b) => rank(a.model) - rank(b.model) || a.price - b.price);
}

/* 58,740,000 → "5,874만" */
function manwon(won) {
  return Math.round(won / 10000).toLocaleString("ko-KR") + "만";
}

/* 카드에서 견적 폼으로 넘길 주소 */
function quoteUrl(v) {
  const p = new URLSearchParams({
    brand: v.path.brand, cat: v.path.cat,
    model: v.path.model, body: v.path.body,
  });
  // 홈에서 들어온 유입경로(?src=, utm_*)를 그대로 이어붙인다
  const cur = new URLSearchParams(location.search);
  for (const k of ["src", "ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    if (cur.has(k)) p.set(k, cur.get(k));
  }
  return "quote.html?" + p.toString();
}
