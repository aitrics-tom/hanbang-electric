<p align="center">
  <img src="https://img.shields.io/badge/2026-Fast%20Builderthon-FF6B35?style=for-the-badge&logo=fastapi&logoColor=white" alt="Fast Builderthon 2026"/>
  <img src="https://img.shields.io/badge/Fastcampus-AI%20Hackathon-00C4B4?style=for-the-badge" alt="Fastcampus"/>
</p>

<h1 align="center">
  <br>
  한방전기 (HanBang Electric)
  <br>
</h1>

<h3 align="center">
  AI 멀티 에이전트 기반 전기기사 실기 학습 플랫폼
</h3>

<p align="center">
  <strong>문제를 찍으면, AI가 풀어드립니다</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google" alt="Gemini AI"/>
  <img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase" alt="Supabase"/>
</p>

---

## 프로젝트 소개

**한방전기**는 전기기사 실기 시험을 준비하는 수험생을 위한 AI 학습 플랫폼입니다.

복잡한 전기 공학 문제를 사진으로 찍거나 텍스트로 입력하면, **6명의 전문 AI 에이전트**가 분야별로 최적화된 풀이를 제공합니다.

### 핵심 가치

| 문제점 | 한방전기의 해결책 |
|--------|------------------|
| 전기기사 실기는 범위가 넓고 어렵다 | 6개 분야 전문 AI가 맞춤 풀이 제공 |
| 손글씨/회로도 문제는 검색이 어렵다 | Vision AI가 이미지를 분석하고 텍스트로 변환 |
| 내 취약점을 모른다 | AI가 학습 패턴을 분석하고 취약 분야 진단 |
| 단순 정답만 있고 풀이가 없다 | 단계별 풀이 + 사용 공식 + 핵심 포인트 제공 |

---

## 주요 기능

### 1. 멀티 에이전트 AI 시스템

<table>
<tr>
<td align="center" width="33%">
<strong>DESIGN</strong><br/>
설계 및 시공<br/>
<sub>조명, 배선, 접지 설계</sub>
</td>
<td align="center" width="33%">
<strong>SEQUENCE</strong><br/>
시퀀스 제어<br/>
<sub>자동화 회로, 타이머, PLC</sub>
</td>
<td align="center" width="33%">
<strong>LOAD</strong><br/>
부하 계산<br/>
<sub>전력량, 케이블 사이즈</sub>
</td>
</tr>
<tr>
<td align="center">
<strong>POWER</strong><br/>
전력 설비<br/>
<sub>변압기, 차단기, 보호계전기</sub>
</td>
<td align="center">
<strong>RENEWABLE</strong><br/>
신재생 에너지<br/>
<sub>태양광, ESS, 풍력</sub>
</td>
<td align="center">
<strong>KEC</strong><br/>
전기 규정<br/>
<sub>한국전기설비규정</sub>
</td>
</tr>
</table>

### 2. 이미지 인식 (Vision AI)

- 손글씨 문제 인식
- 회로도/시퀀스 다이어그램 분석
- 수식 및 표 추출
- 자동 분야 분류

### 3. 개인화 학습 대시보드

- 총 풀이 수 / 오늘 학습량 / 연속 학습일
- 카테고리별 진도 차트
- AI 취약점 분석 및 학습 추천
- 풀이 이력 관리 (정답/오답 표시)

### 4. 단계별 풀이 제공

```
문제 분석 → 공식 선택 → 계산 과정 → 최종 답안
     ↓           ↓            ↓           ↓
  문제 해석   관련 공식    LaTeX 수식   답 + 단위
```

---

## 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 15.1 | App Router, SSR |
| React | 19 | UI Components |
| TypeScript | 5.0 | Type Safety |
| Tailwind CSS | 3.4 | Styling |
| KaTeX | 0.16 | 수식 렌더링 |
| Recharts | 2.15 | 차트 시각화 |

### Backend & AI
| 기술 | 용도 |
|------|------|
| Gemini 2.5 Pro | 문제 풀이 (Solver) |
| Gemini 2.0 Flash | 이미지 분석 (Vision) |
| Gemini 2.0 Flash | 학습 분석 (Analytics) |
| Supabase | PostgreSQL + Auth + Realtime |
| pgvector | RAG 임베딩 검색 |

### Infrastructure
| 기술 | 용도 |
|------|------|
| Vercel | 배포 & Edge Functions |
| Supabase | BaaS (Database, Auth) |

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  HeroSection  │  SolvePage  │  Dashboard  │  Auth Pages     │
└───────┬───────┴──────┬──────┴──────┬──────┴────────┬────────┘
        │              │             │               │
        ▼              ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Routes (Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│  /api/solve  │  /api/chat  │  /api/analytics  │  /api/rag   │
└───────┬──────┴──────┬──────┴───────┬──────────┴──────┬──────┘
        │             │              │                 │
        ▼             ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                          │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Vision       │ Gemini       │ Analytics    │ RAG            │
│ Service      │ Solver       │ Service      │ Service        │
│ (이미지분석)    │ (문제풀이)      │ (학습분석)     │ (지식검색)       │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                        │
├─────────────────────┬───────────────────────────────────────┤
│   Google Gemini AI  │           Supabase                    │
│   - gemini-3.0-pro  │   - PostgreSQL (profiles, sessions)   │
│   - gemini-3.0-flash│   - pgvector (embeddings)             │
│   - gemini-2.0-flash│   - Auth (OAuth, Email)               │
└─────────────────────┴───────────────────────────────────────┘
```

---

## 시작하기

### 필수 요구사항

- Node.js 18.17+
- pnpm (권장) 또는 npm
- Supabase 계정
- Google AI Studio API Key

### 설치

```bash
# 저장소 클론
git clone https://github.com/aitrics-tom/hanbang-electric.git
cd hanbang-electric

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env.local
```

### 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
```

### 실행

```bash
# 개발 서버
pnpm dev

# 프로덕션 빌드
pnpm build
pnpm start
```

---

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 홈페이지
│   ├── solve/             # 문제 풀이 페이지
│   ├── dashboard/         # 학습 대시보드
│   ├── login/             # 로그인
│   └── api/               # API Routes
│
├── components/            # React 컴포넌트
│   ├── home/             # 홈 컴포넌트
│   ├── solve/            # 풀이 컴포넌트
│   ├── dashboard/        # 대시보드 컴포넌트
│   ├── layout/           # 레이아웃 (Navbar, Footer)
│   └── common/           # 공통 컴포넌트
│
├── hooks/                 # Custom React Hooks
│   ├── useAuth.ts        # 인증 상태
│   ├── useSolveProblem.ts # 문제 풀이
│   ├── useStats.ts       # 통계 조회
│   └── useAnalytics.ts   # AI 분석
│
├── lib/                   # 유틸리티 & 서비스
│   ├── services/         # AI 서비스
│   │   ├── vision.service.ts      # Vision AI
│   │   ├── gemini-solver.service.ts # Solver AI
│   │   └── analytics.service.ts   # Analytics AI
│   ├── ai/agents/        # 에이전트 정의
│   ├── rag/              # RAG 시스템
│   └── utils/            # 유틸리티 함수
│
└── types/                 # TypeScript 타입 정의
```

---

## 라이선스

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.

---

<p align="center">
  <strong>2026 Fast Builderthon by Fastcampus</strong>
  <br/>
  <sub>Made with AI + Passion</sub>
</p>
