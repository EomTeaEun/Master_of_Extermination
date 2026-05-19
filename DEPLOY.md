# 🪳 박멸의 달인 — 배포 가이드

## 1. Supabase 설정

### 프로젝트 생성
1. https://supabase.com 접속 → New Project
2. 프로젝트 이름: `bakmelui`, Region: Northeast Asia (Tokyo)

### DB 스키마 실행
Supabase Dashboard → SQL Editor → 새 쿼리 → `supabase/schema.sql` 내용 전체 붙여넣기 → Run

### 환경변수 복사
Dashboard → Settings → API:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 2. .env.local 생성 (로컬 테스트용)

```bash
cp .env.local.example .env.local
# 파일 열어서 실제 Supabase 값 입력
```

---

## 3. 로컬 실행

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## 4. Vercel 배포

### 방법 A: Vercel CLI (권장)
```bash
npm i -g vercel
vercel login
vercel --prod
# 프롬프트에서 환경변수 설정하거나 아래 대시보드에서 설정
```

### 방법 B: GitHub 연동
1. GitHub에 push
2. https://vercel.com → New Project → Import Git Repository
3. Framework: Next.js (자동 감지)
4. Environment Variables 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

---

## 5. Supabase Auth 설정 (이메일 인증 끄기)

회원가입 즉시 플레이 가능하게 하려면:
Dashboard → Authentication → Settings → Email Auth → "Confirm email" OFF

---

## 프로젝트 구조

```
bakmelui/
├── pages/
│   ├── _app.js          # 글로벌 CSS
│   ├── index.js         # 랜딩 + 로그인/회원가입
│   └── game.js          # 게임 메인 (Three.js + UI 통합)
├── components/
│   ├── Opening.jsx      # 오프닝 컷씬 (7장면, 스킵 가능)
│   ├── GameUI.jsx       # HUD (HP/타이머/킬수/귗/콤보/무기)
│   ├── UpgradeShop.jsx  # 집 업그레이드 + 숨은고수 고용
│   ├── Leaderboard.jsx  # 일간/전체 랭킹
│   └── Endings.jsx      # 배드엔딩(HP0) / 해피엔딩(생존)
├── lib/
│   ├── GameEngine.js    # Three.js 3D 게임 엔진 (전체 로직)
│   └── supabase.js      # Auth + Score + Achievement helpers
├── styles/
│   └── globals.css      # Tailwind + 커스텀 애니메이션
└── supabase/
    └── schema.sql       # DB 테이블/뷰/RLS 정책
```
