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
  <a href="https://jeonsilai.vercel.app">Live Demo</a> •
  <a href="#주요-기능">Features</a> •
  <a href="#기술-스택">Tech Stack</a> •
  <a href="#시작하기">Getting Started</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Gemini_3-AI-4285F4?style=flat-square&logo=google" alt="Gemini AI"/>
  <img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase" alt="Supabase"/>
  <img src="https://img.shields.io/badge/Vercel-Deployed-000?style=flat-square&logo=vercel" alt="Vercel"/>
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
| AI가 잘못된 답을 줄 수 있다 | NeMo Guardrails + RAG 검증으로 정확도 보장 |

---

## 라이브 데모

**[https://jeonsilai.vercel.app](https://jeonsilai.vercel.app)**

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
<sub>역률, 콘덴서, 전동기</sub>
</td>
</tr>
<tr>
<td align="center">
<strong>POWER</strong><br/>
전력 설비<br/>
<sub>변압기, 차단기, 단락전류</sub>
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
- 수식, 표, 그래프 추출
- 자동 분야 분류 및 에이전트 라우팅

### 3. NeMo Guardrails 안전장치

```
입력 → Pre-filter(규칙, ~5ms) → LLM Validation(~100ms) → AI Processing → Output Validation
       │                        │                                          │
       ├─ 길이/패턴 검사        ├─ Topic Checker (전기기사 도메인)          ├─ RAG 검증
       └─ 이미지 크기           └─ Jailbreak Detector (탈옥 시도)          └─ KEC 규정 검증
```

- **입력 검증**: 전기기사 도메인 관련성 검사, 탈옥 시도 탐지
- **출력 검증**: KEC 규정 검증, 공식 적합성, 계산 정확도
- **RAG 기반**: Supabase pgvector로 KEC 규정 및 공식 데이터베이스 검색

### 4. 개인화 학습 대시보드

- 총 풀이 수 / 오늘 학습량 / 연속 학습일
- 카테고리별 진도 차트
- AI 취약점 분석 및 학습 추천
- 풀이 이력 관리 (정답/오답 표시)

### 5. 단계별 풀이 제공

```
문제 분석 → 공식 선택 → 계산 과정 → 최종 답안
     ↓           ↓            ↓           ↓
  문제 해석   관련 공식    LaTeX 수식   답 + 단위
```

- KaTeX 기반 수학 수식 렌더링
- 관련 KEC 규정 자동 인용
- 사용된 공식 목록 제공

---

## 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1 | App Router, Server Components |
| React | 19 | UI Components |
| TypeScript | 5.0 | Type Safety |
| Tailwind CSS | 3.4 | Styling |
| KaTeX | 0.16 | 수식 렌더링 |
| Recharts | 2.15 | 차트 시각화 |

### Backend & AI
| 기술 | 용도 |
|------|------|
| **Gemini 3 Pro** | 문제 풀이 (Solver) |
| **Gemini 3 Flash** | 이미지 분석 (Vision), 검증 |
| **Gemini 2.0 Flash** | Guardrails (Topic/Jailbreak) |
| Supabase | PostgreSQL + Auth + Realtime |
| pgvector | RAG 임베딩 검색 |

### AI Safety & Validation
| 기술 | 용도 |
|------|------|
| NeMo Guardrails | 입출력 안전장치 (Colang 규칙) |
| RAG Validator | KEC 규정 검증 |
| Formula Whitelist | 공식 적합성 검증 |

### Infrastructure
| 기술 | 용도 |
|------|------|
| Vercel | 배포 & Edge Functions |
| Supabase | BaaS (Database, Auth) |

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Next.js 16)                   │
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
│                   Unified Guardrails                         │
├─────────────────────────────────────────────────────────────┤
│  Pre-filter  │  Topic Checker  │  Jailbreak Detector        │
│  (규칙 기반)  │  (LLM 기반)      │  (LLM 기반)                │
└───────┬──────┴───────┬──────────┴────────────┬──────────────┘
        │              │                       │
        ▼              ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Vision       │ Agent        │ Analytics    │ RAG            │
│ Service      │ Orchestrator │ Service      │ Validator      │
│ (이미지분석)  │ (에이전트)    │ (학습분석)   │ (KEC 검증)     │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
├─────────────────────┬───────────────────────────────────────┤
│   Google Gemini AI  │           Supabase                     │
│   - gemini-3-pro    │   - PostgreSQL (profiles, sessions)   │
│   - gemini-3-flash  │   - pgvector (KEC, formulas)          │
│   - gemini-2.0-flash│   - Auth (OAuth, Email)                │
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

# NeMo Guardrails (Optional)
NEMO_GUARDRAILS_URL=your_nemo_server_url
```

### 실행

```bash
# 개발 서버
pnpm dev

# 프로덕션 빌드
pnpm build
pnpm start

# 테스트
pnpm test
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
│   ├── solve/            # 풀이 컴포넌트 (SolutionDisplay, StepCard)
│   ├── dashboard/        # 대시보드 컴포넌트
│   └── common/           # 공통 컴포넌트
│
├── lib/                   # 유틸리티 & 서비스
│   ├── services/         # AI 서비스
│   │   ├── vision.service.ts      # Vision AI (이미지 분석)
│   │   ├── agent.service.ts       # Agent Orchestrator
│   │   └── analytics.service.ts   # Analytics AI
│   ├── guardrails/       # NeMo Guardrails
│   │   ├── unified-guardrails.ts  # 통합 안전장치
│   │   ├── llm/                   # LLM 기반 검증
│   │   │   ├── topic-checker.ts   # 주제 관련성 검사
│   │   │   └── jailbreak-detector.ts  # 탈옥 시도 탐지
│   │   └── config.ts              # 규칙 기반 검증
│   ├── rag/              # RAG 시스템
│   │   ├── validator/             # RAG 검증
│   │   └── context/               # 컨텍스트 서비스
│   ├── ai/agents/        # 에이전트 정의
│   └── utils/            # 유틸리티 함수
│       └── jsonParser.ts          # AI 응답 파싱
│
├── hooks/                 # Custom React Hooks
│
├── types/                 # TypeScript 타입 정의
│
├── guardrails/           # NeMo Colang 규칙 (Optional)
│   ├── config.yml        # NeMo 설정
│   ├── prompts.yml       # 프롬프트 템플릿
│   └── rails/            # Colang 규칙
│
└── nemo-server/          # Python NeMo 서버 (Optional)
    ├── main.py           # FastAPI 서버
    └── Dockerfile        # 컨테이너화
```

---

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/solve` | 문제 풀이 요청 |
| POST | `/api/chat` | 채팅 (후속 질문) |
| GET | `/api/stats` | 학습 통계 조회 |
| POST | `/api/analytics` | AI 학습 분석 |
| POST | `/api/feedback` | 풀이 피드백 |
| GET | `/api/formulas` | 공식 목록 |
| GET | `/api/kec` | KEC 규정 검색 |
| POST | `/api/rag/search` | RAG 검색 |

---

## 성능

| 지표 | 값 |
|------|-----|
| 문제 풀이 평균 시간 | ~15-30초 |
| 이미지 분석 시간 | ~3-5초 |
| Guardrails 검증 시간 | ~200-300ms |
| KEC 검증 정확도 | 95%+ |

---

## 향후 계획
- [ ] 모의고사 모드
- [ ] 다른 자격증 확장 (전기산업기사, 전기공사기사)

---

## 라이선스

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.

---

<p align="center">
  <strong>2026 Fast Builderthon by Fastcampus</strong>
  <br/>
  <sub>Made with AI + Passion</sub>
</p>
