# NeMo Guardrails 아키텍처

## 개요

전기기사 AI 풀이 서비스(JeonsilAI)에 NVIDIA NeMo Guardrails 스타일의 안전장치를 통합하는 아키텍처입니다.

## 아키텍처 결정

### 옵션 분석

| 옵션 | 장점 | 단점 | 추천도 |
|------|------|------|--------|
| **1. Vercel Python Runtime** | 단일 배포 유지 | NeMo 의존성(PyTorch) 크기 초과, Cold start | ❌ |
| **2. 별도 Python 서비스** | 전체 NeMo 기능 | 인프라 복잡성, 추가 비용, 네트워크 지연 | ⚠️ |
| **3. TypeScript LLM Guardrails** | 단일 배포, 비용 효율 | 직접 구현 필요 | ✅ **추천** |

### 선택: 하이브리드 아키텍처

**TypeScript LLM Guardrails (메인)** + **NeMo Python 서버 (옵션)**

- 메인: TypeScript로 LLM 기반 검증 구현 (Gemini Flash 사용)
- 옵션: Railway/Render에 NeMo Python 서버 배포 가능
- 폴백: 서버 불가 시 로컬 규칙 기반 검증

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 입력                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  1단계: Pre-filter (규칙 기반)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 길이 검사   │  │ 패턴 차단   │  │ 이미지 검증 │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                        ~5ms                                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               2단계: LLM Validation (시맨틱)                     │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │  Topic Checker      │  │  Jailbreak Detector │               │
│  │  (전기기사 도메인)   │  │  (탈옥 시도 탐지)   │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                      ~100-200ms                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Processing                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Vision      │→ │ Agent       │→ │ Solver      │              │
│  │ Service     │  │ Orchestrator│  │ (Gemini 3)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               3단계: Output Validation                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ RAG 검증    │  │ KEC 검증    │  │ Fact Check  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                      ~200-300ms                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 응답                               │
└─────────────────────────────────────────────────────────────────┘
```

## 파일 구조

```
src/lib/guardrails/
├── config.ts                    # 기존 규칙 기반 검증 (유지)
├── types.ts                     # 타입 정의 (신규)
├── nemo-client.ts               # NeMo 서버 클라이언트 (신규)
├── unified-guardrails.ts        # 통합 인터페이스 (신규)
├── llm/                         # LLM 기반 검증 (신규)
│   ├── topic-checker.ts         # 주제 관련성 검증
│   ├── jailbreak-detector.ts    # 탈옥 시도 탐지
│   └── fact-checker.ts          # 사실 검증
├── kec-database.json            # KEC 규정 DB (기존)
└── formula-whitelist.json       # 공식 화이트리스트 (기존)

guardrails/                      # NeMo Colang 규칙 (신규)
├── config.yml                   # NeMo 설정
├── prompts.yml                  # 프롬프트 템플릿
└── rails/
    ├── input.co                 # 입력 검증 규칙
    └── output.co                # 출력 검증 규칙

nemo-server/                     # Python NeMo 서버 (옵션)
├── main.py                      # FastAPI 서버
├── requirements.txt             # 의존성
├── Dockerfile                   # 컨테이너화
├── railway.json                 # Railway 배포
└── render.yaml                  # Render 배포
```

## 검증 흐름

### 입력 검증

1. **규칙 기반 (Pre-filter)**
   - 입력 길이 (3-2000자)
   - 차단 패턴 (욕설, 개인정보, 불법)
   - 이미지 크기 (10MB 이하)

2. **LLM 기반 (Semantic)**
   - 주제 관련성: 전기기사 도메인 여부
   - 탈옥 탐지: 프롬프트 인젝션 시도

### 출력 검증

1. **RAG 기반**
   - KEC 규정 검증 (Supabase pgvector)
   - 공식 적합성 검증
   - 용어 정확성 검증

2. **LLM 기반**
   - 사실 검증 (Fact Check)
   - 안전성 검증 (위험 작업 경고)

## API 사용

### TypeScript (메인)

```typescript
import { unifiedGuardrails } from '@/lib/guardrails/unified-guardrails';

// 입력 검증
const inputResult = await unifiedGuardrails.validateInput({
  text: "역률 개선 콘덴서 용량 계산",
  imageBase64: "..."
});

if (!inputResult.valid) {
  return { error: inputResult.errors };
}

// 출력 검증
const outputResult = await unifiedGuardrails.validateOutput({
  answer: "50 kVar",
  steps: [...],
  formulas: ["Qc = P(tanθ1 - tanθ2)"],
  relatedKEC: ["KEC 232.8"]
});
```

### NeMo Python 서버 (옵션)

```bash
# Railway 배포
cd nemo-server
railway up

# 또는 Render 배포
# render.yaml 설정 후 Git push
```

```typescript
// TypeScript에서 NeMo 서버 사용
import { getNemoClient } from '@/lib/guardrails/nemo-client';

const client = getNemoClient({
  baseUrl: process.env.NEMO_GUARDRAILS_URL
});

const result = await client.validateInput({ text: "..." });
```

## 환경변수

```env
# .env.local
NEMO_GUARDRAILS_URL=https://your-nemo-server.railway.app  # 옵션

# nemo-server/.env
OPENAI_API_KEY=sk-...  # NeMo 서버용 (옵션)
```

## 비용 추정

| 항목 | 월간 비용 |
|------|----------|
| Gemini Flash (LLM 검증) | ~$5-10 |
| Railway/Render (NeMo 서버) | ~$5-20 (옵션) |
| **총합** | **$5-30** |

## 성능 목표

| 단계 | 목표 지연시간 |
|------|--------------|
| Pre-filter | <10ms |
| LLM Validation | <200ms |
| Output Validation | <300ms |
| **총합** | **<500ms** |

## 마이그레이션 전략

1. **Phase 1**: TypeScript LLM Guardrails 구현 (현재)
2. **Phase 2**: 기존 config.ts와 통합 테스트
3. **Phase 3**: (옵션) NeMo Python 서버 배포
4. **Phase 4**: 모니터링 및 최적화
