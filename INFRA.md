# 인프라 · 도메인 설정 (Cloudflare)

2026-08-09 **Netlify → Cloudflare 이전** 완료. 이 문서는 대시보드에만 저장되어
저장소 코드로는 확인할 수 없는 설정들을 기록해 둔 것이다.

> 아래 설정은 **코드가 아니라 Cloudflare 대시보드 값**이다.
> 저장소를 아무리 뒤져도 나오지 않으니, 설정을 바꾸면 이 문서도 같이 고칠 것.

---

## 1. 호스팅 구조

| 항목 | 값 |
|---|---|
| 호스팅 | **Cloudflare Workers** (정적 자산) — Pages 아님 |
| 설정 파일 | [`wrangler.jsonc`](wrangler.jsonc) |
| 배포할 폴더 | `./site` |
| 배포 방식 | `main` 브랜치에 push → `npx wrangler deploy` 자동 실행 |
| Worker 이름 | `mytruck` |

`netlify.toml` 은 Netlify 시절 잔재이며 현재 사용하지 않는다. (참고용으로만 남겨둠)

## 2. DNS (Cloudflare)

네임서버: `grant.ns.cloudflare.com` / `magdalena.ns.cloudflare.com`

| 타입 | 이름 | 값 | Proxy |
|---|---|---|---|
| — | `mytruck.kr` (apex) | Workers 라우트로 연결 | Proxied (주황 구름) |
| CNAME | `www` | `mytruck.kr` | **Proxied (주황 구름)** |

`www` 는 **Workers 커스텀 도메인으로 등록되어 있지 않다.** 아래 리다이렉트 룰이
엣지에서 먼저 잡아 apex 로 넘기기 때문에 오리진까지 갈 일이 없다.

## 3. 리다이렉트 룰 (Rules → Redirect Rules)

**이름:** `Redirect from WWW to root`

| 항목 | 값 |
|---|---|
| Request URL (Wildcard pattern) | `https://www.*` |
| Target URL | `https://${1}` |
| Status code | `301` |
| Preserve query string | **꺼짐** |

`www.` 뒤의 `*` 가 도메인·경로·쿼리스트링을 전부 `${1}` 로 캡처한다.
Cloudflare 와일드카드는 `http.request.full_uri` 기준이라 쿼리스트링이 이미 포함되므로,
"Preserve query string" 을 켜면 `?src=insta?src=insta` 처럼 **중복된다. 끈 상태가 맞다.**

## 4. SSL/TLS → Edge Certificates

- **Always Use HTTPS: 켜짐**

리다이렉트 룰 패턴이 `https://` 로 시작해 HTTPS 요청만 잡는다.
이 설정이 꺼져 있으면 `http://www.mytruck.kr` 이 룰을 통과하지 못하고 522 가 난다.

## 5. 최종 동작

어떤 주소로 들어와도 `https://mytruck.kr` 로 모인다.

```
http://www.mytruck.kr/quote?src=insta
  → 301 (Always Use HTTPS)   https://www.mytruck.kr/quote?src=insta
  → 301 (Redirect Rule)      https://mytruck.kr/quote?src=insta
  → 200                      경로 · 쿼리스트링 그대로 보존
```

---

## 장애 이력

### 2026-08-10 — `www.mytruck.kr` 접속 불가

**증상:** `www.mytruck.kr` 접속 불가. `mytruck.kr` 은 정상.

**원인:** Netlify → Cloudflare 이전 시 `www` DNS 레코드가 함께 넘어오지 않아
`www.mytruck.kr` 이 **NXDOMAIN**(도메인 자체가 없음) 상태였다.
Netlify 에서는 `CNAME www → <사이트>.netlify.app` 이 있었으나 이전 과정에서 누락됐다.

**조치 3가지:**

1. `www` CNAME 레코드 추가 (Proxied)
2. WWW → root 301 리다이렉트 룰 배포
3. Always Use HTTPS 활성화

**중간에 만난 HTTP 522:** 1번만 하고 확인했을 때 `www` 가 522 를 냈다.
DNS·SSL 은 정상이고, **Cloudflare 가 `www.mytruck.kr` 이라는 호스트명을
어느 오리진으로 보낼지 몰라서** 나는 오류였다 (Workers 커스텀 도메인 미등록).
2번 리다이렉트 룰이 엣지에서 먼저 처리하므로 522 가 사라졌다.

> **522 는 오리진 장애가 아니라 "이 호스트명에 대한 라우팅이 없다"는 신호로 읽을 것.**

---

## 앞으로 주의할 점

### 서브도메인을 새로 추가할 때

`blog.mytruck.kr` 같은 걸 추가한다면 **둘 다** 해야 한다. DNS 레코드만 추가하면
위와 똑같은 522 를 다시 만난다.

1. DNS 레코드 추가 (Proxied)
2. **Workers 커스텀 도메인 등록** (또는 그 호스트명을 처리할 리다이렉트 룰)

### 광고 링크는 apex 로 쓸 것

[README](README.md#광고-링크--유입경로-추적) 의 예시가 `https://www.mytruck.kr/quote?src=...`
형태인데, 지금은 `www` 로 들어오면 301 을 한 번 더 타고 apex 로 넘어간다.
동작에는 문제없고 `?src=` 값도 보존되지만, 새로 만드는 광고는 홉을 아끼도록
**apex 를 직접** 쓰는 편이 낫다.

```
https://mytruck.kr/quote?src=insta      ← 권장
https://www.mytruck.kr/quote?src=insta  ← 동작함 (301 한 번 경유)
```

### `_redirects` 를 건드릴 때

[`site/_redirects`](site/_redirects) 파일 맨 위 주석을 반드시 읽을 것.
`/quote → /quote.html` 같은 규칙을 넣으면 `wrangler.jsonc` 의
`html_handling: "auto-trailing-slash"` 와 서로를 가리켜 **무한 리다이렉트**가 난다
(커밋 `702d1eb` 참고). 확장자 없는 주소는 규칙 없이도 이미 동작한다.

### EmailJS 허용 도메인

`Account → Security → Allowed Origins` 에 `https://mytruck.kr` 과
`https://www.mytruck.kr` 이 모두 들어 있어야 한다.

---

## 문제가 생겼을 때 확인 순서

```bash
# 1. DNS 가 뜨는지 (공용 DNS 로 조회 — 내 PC 캐시 무시)
nslookup www.mytruck.kr 8.8.8.8

# 2. 엣지 응답 코드 (DNS 전파를 기다리지 않고 바로 확인)
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  --resolve www.mytruck.kr:443:104.21.33.222 https://www.mytruck.kr/

# 3. 리다이렉트 체인 끝까지 따라가 보기
curl -sSL -o /dev/null -w "%{url_effective} %{http_code}\n" http://www.mytruck.kr/
```

| 결과 | 의미 |
|---|---|
| `NXDOMAIN` | DNS 레코드가 없음 → DNS 탭에서 추가 |
| `522` | 해당 호스트명의 오리진 라우팅이 없음 → 커스텀 도메인 또는 리다이렉트 룰 |
| `301` + 올바른 Location | 정상 |

> 내 PC 에서만 안 열린다면 사이트가 아니라 **로컬/사내 DNS 의 negative 캐시**다.
> Cloudflare 의 NXDOMAIN 캐시 TTL 은 보통 30분이라 시간이 지나면 저절로 풀린다.
> 급하면 모바일 데이터나 시크릿 모드로 확인.
