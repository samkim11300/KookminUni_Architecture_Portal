# 보안 점검 결과 (2026-09-08)

> 점검 범위: `src/` 전체, `dist/` 빌드 산출물, `package.json`, `.env`, git 히스토리
> 상태: **분석만 완료. 코드 수정 없음.**
> ⚠️ 이 문서는 미공개 취약점 정보를 담고 있습니다. 공개 저장소에 푸시하지 마세요.

**요약: Critical 2건, High 2건, Medium 1건.** 특히 CRITICAL-1은 최우선 처리 대상입니다.

---

## 🔴 CRITICAL-1. Supabase Service Role 키가 브라우저에 노출

**위치:** `src/supabase.js:12`, `.env`

`VITE_SUPABASE_SERVICE_ROLE_KEY`를 클라이언트 코드에서 읽고 있습니다. `VITE_` 접두사가 붙은
환경변수는 Vite가 빌드 시 값을 번들에 문자열로 그대로 박아 넣습니다.

실제 확인 결과 — `dist/assets/index-*.js` 안의 JWT를 디코드하면:

```
{"iss":"supabase","ref":"vjupxl...","role":"service_role","exp":2087620259}
                                            ^^^^^^^^^^^^        ^ 2036년 만료
```

`service_role` 키는 **모든 RLS 정책을 우회**합니다. 사이트 접속자 누구나 F12 → 소스 검색만으로
이 키를 얻어 DB 전체 읽기/수정/삭제와 Storage 전체 접근이 가능합니다.
학생 개인정보(학번·이름·이메일·안전교육이수증 파일)가 전부 열려 있습니다.

`src/supabase.js` 상단에 이미 위험을 인지한 주석이 달려 있으나 코드는 그대로 사용 중입니다.

### 수정안
1. **Supabase 대시보드에서 service_role 키를 즉시 rotate**
   (코드 수정보다 이게 먼저 — 이미 배포됐다면 유출된 것으로 간주해야 함)
2. `.env`에서 `VITE_SUPABASE_SERVICE_ROLE_KEY` 줄 삭제
3. `src/supabase.js`의 `supabaseAdmin`을 `supabase`(anon)로 통일
4. Storage 업로드/서명URL 발급을 Supabase Edge Function으로 이관하거나,
   `certificates` / `forms` 버킷에 anon으로 동작하는 Storage 정책 작성

---

## 🔴 CRITICAL-2. 인증이 100% 클라이언트에서만 이뤄짐 (권한 통제 부재)

Supabase Auth를 전혀 사용하지 않습니다 (`signIn` 호출 0건).
모든 DB 요청이 익명 권한으로 나가며, 로그인 판정은 브라우저 안에서만 일어납니다.

| 위치 | 문제 |
|---|---|
| `src/pages/LoginPage.jsx:325-326` | 근로학생 — 입력값 SHA-256을 번들에 박힌 해시와 JS로 비교 |
| `src/pages/LoginPage.jsx:340-341` | 관리자 — 동일 방식 |
| `src/pages/LoginPage.jsx:209` | 학생 — PIN을 **평문으로** 클라이언트에서 비교 |
| `src/App.jsx:152-160` | `sessionStorage`의 role을 검증 없이 신뢰해 세션 복원 |

공격자는 브라우저 콘솔에서 아래 한 줄로 관리자 화면에 진입할 수 있습니다:

```js
sessionStorage.setItem('kmu_active_portal_session', '{"user":{},"role":"admin"}')
```

애초에 anon 키만으로 `portal_data` 테이블을 직접 조작하는 것도 가능합니다.
**화면 단의 role 분기는 UI 편의일 뿐 보안 경계가 아닙니다.**

### 수정안
1. **최우선: Supabase 대시보드에서 `portal_data` 테이블의 RLS 활성화 상태 확인.**
   지금 앱이 정상 동작한다는 것은 RLS가 꺼져 있거나 anon 전체 허용 정책이라는 뜻이며,
   이 경우 anon 키만으로도 전체 데이터가 노출됩니다.
2. Supabase Auth 도입 → 관리자/근로/학생을 실제 계정으로 만들고
   RLS 정책을 `auth.jwt()` 기반 역할로 작성
3. (Auth 도입이 당장 어렵다면 최소한) 로그인 검증과 관리자 쓰기 작업을
   Edge Function으로 옮겨 서버에서 판정

---

## 🟠 HIGH-3. 하드코딩된 인증정보 + 자명한 비밀번호

**위치:** `src/constants/data.js:66`, `src/constants/data.js:94`

환경변수 fallback으로 해시가 하드코딩되어 있으며, 이 해시들은 잘 알려진 값입니다:

```
03ac6742...c846f4  = SHA256("1234")      ← worker1
ac9689e2...c6e270  = SHA256("admin123")  ← admin
```

레인보우 테이블 최상위에 있는 값입니다. 솔트도 key stretching도 없는 단일 SHA-256입니다.
`.env`에도 동일한 비밀번호가 평문으로 들어 있습니다.

추가로 학생 PIN이 `src/pages/LoginPage.jsx:302` 및 `:311`에서
`certificates` 객체와 `studentPin_*` 키에 **평문 그대로** 저장됩니다.

> ✅ 참고 — `.env`는 `.gitignore`에 포함되어 있고 git 히스토리에도 커밋된 적이 없습니다. 이 부분은 정상입니다.

### 수정안
- `data.js`의 fallback 해시 문자열 제거 (환경변수 없으면 로그인 실패하도록)
- 비밀번호를 추측 불가능한 값으로 변경
- CRITICAL-2 해결 시 이 항목은 자연히 서버 측으로 이관됨

---

## 🟠 HIGH-4. GAS API 키와 엔드포인트가 번들에 노출

**위치:** `src/constants/data.js:69, 82, 87, 95`

Google Apps Script URL 3개와 `VITE_GAS_API_KEY`가 모두 클라이언트에 노출됩니다.
이 키로 접근 가능한 기능:

- **`verify_student`** — `src/App.jsx:928`에서 응답의 `student.password`
  (구글시트 평문 비밀번호)를 브라우저로 그대로 받아옵니다.
  **학번 + 이름만 알면 해당 학생의 비밀번호를 조회할 수 있습니다.**
- **`send_email`** — 임의 수신자에게 학교 명의 메일 발송 (피싱 악용 가능)
- **`upload_to_drive`** — 학교 드라이브에 임의 파일 업로드

또한 `src/pages/LoginPage.jsx:238-244`의 업로드 핸들러는 `accept` 속성 외에
파일 크기·MIME 타입 검증이 전혀 없습니다.

### 수정안
- GAS 측에서 `verify_student` 응답의 `password` 필드를 **제거**하고,
  비밀번호 대조를 GAS 내부에서 수행한 뒤 `{ok: true/false}`만 반환
- `send_email`의 수신자를 GAS 내부 화이트리스트로 제한
- `upload_to_drive`에 파일 크기 / MIME 타입 제한 추가 (클라이언트·GAS 양쪽)

---

## 🟡 MEDIUM-5. 의존성

**낯설거나 의심스러운 패키지는 없습니다.** 전부 정상적인 주류 패키지이며 타이포스쿼팅 흔적도 없습니다.

다만 두 가지:

- **`pg` (^8.18.0)** 가 devDependencies에 있으나 코드에서 전혀 사용되지 않습니다.
  프론트엔드 전용 프로젝트에 PostgreSQL 드라이버는 불필요 → 제거 권장
- **`npm audit`**: high 6 / moderate 1 / low 1 (총 8건)
  `vite`, `esbuild`, `rollup`, `postcss`, `nanoid`, `ws`, `browserslist`, `@babel/core`
  전부 빌드 툴체인의 transitive 의존성이라 런타임 노출은 없으나 `npm audit fix`로 정리 권장

---

## ✅ 문제 없었던 항목

- **XSS** — `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write` 사용 0건.
  React 기본 이스케이핑이 온전히 유지됨
- **SQL 인젝션** — 직접 SQL이나 `.rpc()` 호출 없음.
  Supabase JS 클라이언트만 사용하므로 파라미터가 자동 바인딩됨
- **경로 조작** — `src/supabase.js`의 `replace(/[^a-zA-Z0-9._-]/g, '_')`로 차단됨
- **git 히스토리** — 비밀정보가 커밋된 이력 없음

---

## 권장 조치 순서

| 순위 | 작업 | 위치 |
|---|---|---|
| 1 | Supabase service_role 키 rotate | Supabase 대시보드 |
| 2 | `portal_data` RLS 활성화 여부 확인 | Supabase 대시보드 |
| 3 | service_role 키를 코드 / `.env`에서 제거 | 코드 |
| 4 | GAS `verify_student`에서 password 반환 제거 | GAS 편집기 |
| 5 | 하드코딩 해시 제거 + 비밀번호 변경 | 코드 |
| 6 | 파일 업로드 크기·타입 검증 추가 | 코드 |
| 7 | `pg` 제거, `npm audit fix` | 코드 |
| 8 | Supabase Auth 도입 (구조 개선, 대규모) | 코드 |


###나중에 작업하실 때 이 파일 열고 "3번부터 해줘" 같은 식으로 말씀해주시면 됩니다.