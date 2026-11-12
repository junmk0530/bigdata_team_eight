# SameStory · Vercel + Supabase

## 현재 배포

- 공개 서비스: https://samestory-news-qa.vercel.app
- Supabase 조직: `SameStory` (새 Free 조직)
- Supabase 프로젝트: `samestory-news-qa` / `mhqmrnggjesnfelnpsba` / 서울
- Vercel 프로젝트: `samestory-news-qa` / `prj_93VZarQXQiOPsrLouqZgwrW4ngWM`
- 이 전용 DB에는 아래 스키마가 **이미 적용**되어 있고 가상 제목 23개·7개 그룹이 게시되어 있습니다. 현재 프로젝트에 마이그레이션을 다시 실행하지 마세요.
- 실제 운영 API에서 공유 DB 연결과 조회를 확인했습니다. 개인 북마크의 익명 조회는 401로 차단됩니다.
- 테스트 18개·타입 검사·Next.js 운영 빌드가 통과했습니다. RLS, 관리자 게시, 개인 북마크, QA 한도, AI 한도는 로컬 PostgreSQL 엔진에서도 검증했습니다.
- 이메일 로그인 복귀 주소는 운영 도메인과 `http://localhost:5173`으로 설정했습니다. 실제 메일 발송·다른 기기 로그인은 별도 실사용 확인이 필요합니다. 다수 테스터에게 메일을 보내려면 Supabase 메일 발송/SMTP 제한을 확인하세요.
- 초기 관리자 역할은 아래 SQL로 지정합니다. AI 요약 API 키와 모델은 아직 설정하지 않았습니다.

아래 초기 설정 절차는 새 환경을 다시 만들 때 참고하세요.

기존 `samestory` 및 ChatGPT Sites 배포와 분리된 **새 전용 프로젝트**입니다. 기존 서비스·DB·Vercel 프로젝트를 변경하지 않습니다.

- 화면/서버: Next.js App Router + React + TypeScript
- 배포: 새 Vercel 프로젝트 `samestory-news-qa`
- 데이터: 전용 새 Supabase Postgres 프로젝트
- 공개 열람: 로그인 없이 공통 뉴스 목록과 저장된 요약을 조회
- 선택적 로그인: Supabase 이메일 로그인 링크
- 계정 기능: 공유 그룹 북마크 동기화, QA 의견 저장
- 권한: 데이터 게시 `admin`, AI 요약 실행 `admin` 또는 `tester`

## 로컬 실행

Node.js 24를 권장합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

http://localhost:5173 에 접속합니다. Supabase 설정이 없으면 `공유 DB 설정 대기`가 표시되며 가상 샘플과 로컬 파일 분석만 동작합니다. 연결되지 않은 기능을 완료된 것처럼 표시하지 않습니다.

```powershell
npm test
npm run typecheck
npm run build
npm start
```

## 새 Supabase 공간 준비

기존 데이터베이스에 적용하지 말고 **이 서비스 전용 새 Supabase 프로젝트**를 생성합니다.

1. 새 프로젝트의 SQL Editor에서 `supabase/migrations/202611120001_shared_news.sql`을 한 번 실행합니다. CLI를 쓰면 해당 새 프로젝트에 연결한 뒤 마이그레이션을 적용합니다.
2. `.env.local`에 아래 두 값을 설정합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://새_프로젝트_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=새_프로젝트의_공개용_키
```

3. Supabase Authentication의 Site URL을 최종 Vercel 운영 주소로 설정합니다. Redirect URLs에 로컬 개발 주소와 필요한 QA 배포 주소만 추가합니다.
4. 메일 로그인으로 관리자 계정을 한 번 생성한 다음 SQL Editor에서 해당 사용자를 관리자로 등록합니다.

```sql
insert into public.workspace_members(user_id, role)
select id, 'admin' from auth.users where email = '관리자_이메일'
on conflict(user_id) do update set role=excluded.role;
```

테스터의 AI 요약 실행이 필요하면 같은 방식으로 `tester` 역할을 부여합니다. 단순 열람은 로그인하지 않아도 되고, 일반 로그인 사용자도 개인 북마크와 QA 의견을 저장할 수 있습니다. Supabase 메일 발송 제한에 걸리면 프로젝트의 SMTP 설정을 확인합니다.

### 가상 샘플 게시

실제 공개 뉴스 데이터는 동봉하지 않았습니다. 아래 방법은 기능 시연용 **가상 제목 23개·7개 그룹**을 공유 DB에 게시합니다.

- 관리자 로그인 후 샘플을 로드하고 `현재 데이터를 공유 게시`를 누릅니다.
- 또는 로컬 `.env.local`에 서버 전용 `SUPABASE_SECRET_KEY`를 추가하고 `npm run db:seed`를 실행합니다. 샘플 이름이 이미 있으면 중복 생성하지 않습니다.

서버 비밀 키는 시드 작업에만 필요합니다. 웹사이트 런타임은 공개 키와 검증된 사용자 JWT로 RLS를 적용합니다. `SUPABASE_SECRET_KEY`를 `NEXT_PUBLIC_` 환경 변수나 브라우저에 넣지 마세요.

## Vercel 배포

새 전용 프로젝트 `samestory-news-qa`에 이 폴더만 배포합니다. Framework는 Next.js, Node.js는 24.x, 빌드 명령은 `npm run build`입니다. `vercel.json`이 포함되어 있습니다.

Vercel 프로젝트의 환경 변수에 위 Supabase 공개 설정 두 개를 production/preview/development 용도에 맞게 등록합니다. `NEXT_PUBLIC_` 값은 빌드할 때 브라우저 코드에 포함되므로 설정을 바꿨다면 재배포해야 합니다. 기존 다른 Vercel 프로젝트의 환경 변수나 배포 설정은 변경하지 않습니다.

운영 사이트는 공개 접속을 허용하도록 배포 보호 설정을 확인합니다. 테스터 로그인은 서비스 내부 계정 기능을 위한 선택 사항입니다.

## 공유 데이터 흐름

1. 관리자가 파일을 올려 브라우저 Web Worker에서 MinHash·LSH 결과를 확인합니다.
2. `현재 데이터를 공유 게시`를 누르면 서버가 입력을 다시 검증하고 그룹을 다시 계산합니다.
3. Supabase RPC가 데이터셋과 모든 그룹을 한 트랜잭션으로 저장합니다.
4. 방문자는 `/api/datasets`에서 같은 게시 데이터와 요약을 읽습니다. 데이터셋 선택이나 새로고침으로 최신 목록을 조회합니다.
5. 로그인한 사용자의 공유 그룹 북마크는 Supabase에 저장되어 다른 기기에서도 복원됩니다. 직접 업로드한 로컬 그룹 북마크는 해당 브라우저에만 남습니다.
6. QA 의견은 그룹 ID·데이터셋 이름·유사도 기준과 함께 저장합니다. 제보자와 관리자만 DB 정책상 조회할 수 있습니다. 관리자는 Supabase Table Editor에서 `qa_feedback`을 확인할 수 있습니다.

공유 DB는 1,000행씩 페이지를 나누어 최대 5,000개 그룹을 읽습니다. 브라우저 업로드 제한은 10MB·5,000행이며, 공유 게시 API는 3.5MB까지 받습니다. 너무 큰 파일은 나누어 게시하세요. 기존 브라우저에 저장한 파일이 자동으로 공개 게시되지는 않습니다.

## AI 요약

Vercel 서버 환경 변수에 `OPENAI_API_KEY`, `OPENAI_MODEL`을 설정합니다. 사용 모델은 Responses API Structured Outputs를 지원해야 합니다.

- 공개 방문자는 저장된 요약을 읽습니다.
- `admin`/`tester`만 공유 그룹의 요약을 생성합니다.
- 서버가 DB에서 제목을 읽으므로 클라이언트가 임의의 요약 입력을 보내지 않습니다.
- 요약 → 별도 근거 검토의 두 단계로 호출하고 검증된 결과만 저장합니다.
- 계정별 하루 20회 요청 제한을 DB에서 원자적으로 적용합니다. 실패한 요청도 한도에 포함합니다.
- API 키 미설정 시 제목 기반 요약만 표시합니다. 모델 연결이 없어도 나머지 QA 기능은 사용할 수 있습니다.

## 데이터 권한

`news_datasets`, `news_groups`, `group_summaries`는 모든 방문자가 읽을 수 있습니다. 따라서 공용 뉴스 데이터만 게시합니다. 데이터 게시 RPC는 관리자에게만 허용합니다.

`bookmarks`는 `auth.uid()` 기준으로 본인 행만 접근합니다. QA 의견은 직접 INSERT를 막고, 사용자당 시간당 20건을 제한하는 RPC로 저장합니다. `workspace_members`, `ai_usage`는 공개되지 않습니다. 마이그레이션은 모든 테이블에 RLS를 활성화합니다.

Supabase 프로젝트 연결과 실제 이메일 인증·클라우드 동기화는 운영 환경에서 추가로 검증해야 합니다. 로컬 테스트 통과와 실제 클라우드 연결 완료는 별개입니다.

## 알고리즘 한계

영어 단어 집합, 128개 MinHash 해시, 64밴드×2행 LSH, Jaccard 검증과 연결 요소 그룹화를 사용합니다. LSH는 일부 유사 쌍을 놓칠 수 있고 그룹 내 모든 쌍이 임계값을 넘지는 않습니다. 제목만으로 같은 사건임을 보장하지 않습니다. 수치 차이는 검토 단서이며 NLI 기반 사실 충돌 판정이 아닙니다. 후보 300,000쌍을 넘으면 파일 분할을 안내합니다.

## 주요 파일

- `app/api`: Vercel에서 실행되는 서버 API
- `components/cloud-panel.tsx`: 공통 목록·로그인·게시·QA 의견
- `lib/supabase-server.ts`: JWT 검증·권한·요청 검증
- `supabase/migrations`: 전용 DB 스키마·RLS·RPC
- `scripts/build-worker.mjs`: 프레임워크와 분리된 브라우저 분석 Worker 생성

참고: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase 이메일 로그인](https://supabase.com/docs/reference/javascript/auth-signinwithotp).
