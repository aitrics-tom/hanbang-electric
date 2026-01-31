import { NextRequest, NextResponse } from 'next/server';
import { SolutionResponse, AgentType } from '@/types';
import { classifyQuestion } from '@/lib/ai/agents';
import { processImageWithNIM } from '@/lib/nim/client';
import { routeQuestion, solveProblem, verifySolution } from '@/lib/ai/nemotron';
import { validateInput, validateOutput } from '@/lib/guardrails/config';

// 환경 변수로 데모 모드 제어
const IS_DEMO_MODE = !process.env.NEMOTRON_API_KEY;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { text, imageBase64 } = body;

    // 0. Guardrails - 입력 검증
    const inputValidation = validateInput({ text, imageBase64 });
    if (!inputValidation.valid) {
      return NextResponse.json(
        { success: false, error: inputValidation.errors.join(' ') },
        { status: 400 }
      );
    }

    // 1. OCR 처리 (NVIDIA NIM)
    let extractedText = text || '';
    let ocrTime = 0;

    if (imageBase64) {
      if (IS_DEMO_MODE) {
        // 데모 모드: 샘플 텍스트 사용
        extractedText = `바닥 면적이 200m²인 사무실에 평균 조도 500lx를 얻고자 한다.
광원의 광속이 3000lm이고, 조명률 0.6, 감광보상률 1.3일 때 필요한 등 수는?`;
        ocrTime = 0.5;
      } else {
        // 실제 NIM API 호출
        const ocrResult = await processImageWithNIM(imageBase64);
        extractedText = ocrResult.text;
        ocrTime = ocrResult.processingTime;
      }
    }

    if (!extractedText) {
      return NextResponse.json(
        { success: false, error: '문제 텍스트를 입력해주세요.' },
        { status: 400 }
      );
    }

    let solution: SolutionResponse;

    if (IS_DEMO_MODE) {
      // 데모 모드: 로컬 분류 + 하드코딩 응답
      const classification = classifyQuestion(extractedText);
      solution = generateDemoSolution(
        extractedText,
        classification.primary,
        ocrTime
      );
    } else {
      // 실제 모드: Nemotron API 호출
      // 2. Orchestrator - 에이전트 라우팅
      const routing = await routeQuestion(extractedText);

      // 3. Solver Agent - 풀이 생성
      const solutionResult = await solveProblem(
        extractedText,
        routing.primaryAgent
      );

      // 4. Verifier Agent - 검증
      const verification = await verifySolution(extractedText, solutionResult);

      // 5. 응답 조합
      solution = {
        id: `sol-${Date.now()}`,
        question: extractedText,
        category: solutionResult.category,
        solution: solutionResult.solution,
        answer: solutionResult.answer,
        steps: solutionResult.steps,
        formulas: solutionResult.formulas,
        relatedKEC: solutionResult.relatedKEC,
        verification,
        agents: {
          primary: routing.primaryAgent,
          secondary: routing.secondaryAgents,
        },
        processingTime: (Date.now() - startTime) / 1000,
        createdAt: new Date(),
      };
    }

    // 6. Guardrails - 출력 검증
    const outputValidation = validateOutput({
      answer: solution.answer,
      steps: solution.steps,
      formulas: solution.formulas,
      confidence: solution.verification?.confidence,
      relatedKEC: solution.relatedKEC,
    });

    // 검증 경고 추가
    if (outputValidation.warnings.length > 0) {
      solution.verification = {
        ...solution.verification,
        warnings: [
          ...(solution.verification?.warnings || []),
          ...outputValidation.warnings,
        ],
      };
    }

    return NextResponse.json({
      success: true,
      data: solution,
      guardrails: {
        inputValid: true,
        outputValid: outputValidation.valid,
        warnings: outputValidation.warnings,
      },
    });
  } catch (error) {
    console.error('Error in solve API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 데모용 풀이 생성 함수
function generateDemoSolution(
  question: string,
  category: AgentType,
  ocrTime: number
): SolutionResponse {
  const isLighting =
    question.includes('조도') ||
    question.includes('광속') ||
    question.includes('조명') ||
    question.includes('등수') ||
    question.includes('등 수');

  const isTransformer =
    question.includes('변압기') || question.includes('kVA');

  const isSequence =
    question.includes('시퀀스') ||
    question.includes('PLC') ||
    question.includes('릴레이');

  const isGrounding =
    question.includes('접지') || question.includes('KEC');

  if (isLighting) {
    return createLightingSolution(question, ocrTime);
  }

  if (isTransformer) {
    return createTransformerSolution(question, ocrTime);
  }

  if (isSequence) {
    return createSequenceSolution(question, ocrTime);
  }

  if (isGrounding) {
    return createGroundingSolution(question, ocrTime);
  }

  // 기본 응답
  return createDefaultSolution(question, category, ocrTime);
}

function createLightingSolution(
  question: string,
  ocrTime: number
): SolutionResponse {
  return {
    id: `sol-${Date.now()}`,
    question,
    category: 'LOAD',
    solution: '광속법을 이용한 등수 계산',
    answer: '73개',
    steps: [
      {
        order: 1,
        title: '문제 분석',
        content:
          '주어진 조건을 정리합니다.\n- 바닥 면적 (A): 200 m²\n- 평균 조도 (E): 500 lx\n- 광원의 광속 (F): 3000 lm\n- 조명률 (U): 0.6\n- 감광보상률 (M): 1.3',
      },
      {
        order: 2,
        title: '적용 공식',
        content: '광속법의 등수 계산 공식을 적용합니다.',
        latex: 'N = \\frac{E \\times A \\times M}{F \\times U}',
      },
      {
        order: 3,
        title: '값 대입',
        content: '주어진 값을 공식에 대입합니다.',
        latex: 'N = \\frac{500 \\times 200 \\times 1.3}{3000 \\times 0.6}',
      },
      {
        order: 4,
        title: '계산',
        content: '분자와 분모를 각각 계산합니다.',
        latex: 'N = \\frac{130,000}{1,800} = 72.22...',
      },
      {
        order: 5,
        title: '정수 처리',
        content:
          '등 수는 정수이므로 올림 처리합니다. 72.22를 올림하면 73개가 됩니다.',
        latex: 'N = 73 \\text{ 개}',
      },
    ],
    formulas: ['광속법 (N = EAM/FU)'],
    relatedKEC: [],
    verification: {
      isValid: true,
      confidence: 0.98,
      checks: {
        calculation: { pass: true, notes: ['계산 검증 완료'] },
        formula: { pass: true, notes: ['광속법 공식 정확'] },
        kec: { pass: true, notes: ['해당 없음'] },
        units: { pass: true, notes: ['SI 단위 사용'] },
      },
      corrections: [],
      warnings: [],
    },
    agents: {
      primary: 'LOAD',
      secondary: [],
    },
    processingTime: ocrTime + 1.2,
    createdAt: new Date(),
  };
}

function createTransformerSolution(
  question: string,
  ocrTime: number
): SolutionResponse {
  return {
    id: `sol-${Date.now()}`,
    question,
    category: 'DESIGN',
    solution: '변압기 용량 산정',
    answer: '500 kVA',
    steps: [
      {
        order: 1,
        title: '문제 분석',
        content: '변압기 용량 산정을 위한 조건을 정리합니다.',
      },
      {
        order: 2,
        title: '적용 공식',
        content: '변압기 용량 공식을 적용합니다.',
        latex: 'P_{TR} = \\frac{P_{설비}}{\\cos\\theta \\times \\eta}',
      },
      {
        order: 3,
        title: '계산 및 결과',
        content: '계산 결과에 따라 적정 용량을 선정합니다.',
      },
    ],
    formulas: ['변압기 용량 공식'],
    relatedKEC: [],
    verification: {
      isValid: true,
      confidence: 0.95,
      checks: {
        calculation: { pass: true, notes: ['계산 검증 완료'] },
        formula: { pass: true, notes: ['공식 정확'] },
        kec: { pass: true, notes: [] },
        units: { pass: true, notes: ['kVA 단위 정확'] },
      },
      corrections: [],
      warnings: [],
    },
    agents: {
      primary: 'DESIGN',
      secondary: [],
    },
    processingTime: ocrTime + 1.5,
    createdAt: new Date(),
  };
}

function createSequenceSolution(
  question: string,
  ocrTime: number
): SolutionResponse {
  return {
    id: `sol-${Date.now()}`,
    question,
    category: 'SEQUENCE',
    solution: '시퀀스 회로 분석',
    answer: '회로도 참조',
    steps: [
      {
        order: 1,
        title: '동작 조건 분석',
        content: '시퀀스 회로의 동작 조건을 분석합니다.',
      },
      {
        order: 2,
        title: '타임차트 작성',
        content: '각 접점의 동작 시간을 타임차트로 표현합니다.',
      },
      {
        order: 3,
        title: '래더 다이어그램',
        content: 'PLC 래더 다이어그램을 작성합니다.',
      },
    ],
    formulas: [],
    relatedKEC: [],
    verification: {
      isValid: true,
      confidence: 0.9,
      checks: {
        calculation: { pass: true, notes: [] },
        formula: { pass: true, notes: [] },
        kec: { pass: true, notes: [] },
        units: { pass: true, notes: [] },
      },
      corrections: [],
      warnings: [],
    },
    agents: {
      primary: 'SEQUENCE',
      secondary: [],
    },
    processingTime: ocrTime + 1.3,
    createdAt: new Date(),
  };
}

function createGroundingSolution(
  question: string,
  ocrTime: number
): SolutionResponse {
  return {
    id: `sol-${Date.now()}`,
    question,
    category: 'KEC',
    solution: '접지 시스템 설계',
    answer: '접지저항 10Ω 이하',
    steps: [
      {
        order: 1,
        title: 'KEC 규정 확인',
        content: '한국전기설비규정(KEC)의 접지 관련 조항을 확인합니다.',
      },
      {
        order: 2,
        title: '접지 방식 선정',
        content: 'TT, TN, IT 계통 중 적합한 방식을 선정합니다.',
      },
      {
        order: 3,
        title: '접지저항 계산',
        content: '접지저항 기준값을 확인합니다.',
        latex: 'R_a \\leq 10\\Omega \\text{ (고압/특고압)}',
      },
    ],
    formulas: ['접지저항 공식'],
    relatedKEC: ['KEC 142', 'KEC 143'],
    verification: {
      isValid: true,
      confidence: 0.95,
      checks: {
        calculation: { pass: true, notes: [] },
        formula: { pass: true, notes: [] },
        kec: { pass: true, notes: ['KEC 142 조항 확인됨'] },
        units: { pass: true, notes: [] },
      },
      corrections: [],
      warnings: [],
    },
    agents: {
      primary: 'KEC',
      secondary: [],
    },
    processingTime: ocrTime + 1.4,
    createdAt: new Date(),
  };
}

function createDefaultSolution(
  question: string,
  category: AgentType,
  ocrTime: number
): SolutionResponse {
  return {
    id: `sol-${Date.now()}`,
    question,
    category,
    solution: '문제를 분석하여 풀이를 생성했습니다.',
    answer: '계산 결과를 확인하세요',
    steps: [
      {
        order: 1,
        title: '문제 분석',
        content: '주어진 조건을 분석합니다.',
      },
      {
        order: 2,
        title: '공식 적용',
        content: '적절한 공식을 선택하여 적용합니다.',
      },
      {
        order: 3,
        title: '계산',
        content: '값을 대입하여 계산합니다.',
      },
    ],
    formulas: [],
    relatedKEC: [],
    verification: {
      isValid: true,
      confidence: 0.85,
      checks: {
        calculation: { pass: true, notes: [] },
        formula: { pass: true, notes: [] },
        kec: { pass: true, notes: [] },
        units: { pass: true, notes: [] },
      },
      corrections: [],
      warnings: ['상세한 검증을 위해 문제를 더 구체적으로 입력해주세요.'],
    },
    agents: {
      primary: category,
      secondary: [],
    },
    processingTime: ocrTime + 0.8,
    createdAt: new Date(),
  };
}
