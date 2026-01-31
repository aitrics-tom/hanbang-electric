import { NextRequest, NextResponse } from 'next/server';
import { kecDatabase } from '@/lib/guardrails/config';

/**
 * KEC 규정 API
 * GET /api/kec - 전체 KEC 규정 목록
 * GET /api/kec?code=142 - 특정 규정 조회
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const search = searchParams.get('search');

  try {
    const regulations = kecDatabase.regulations;

    // 특정 코드 조회
    if (code) {
      const kecKey = `KEC_${code}` as keyof typeof regulations;
      const regulation = regulations[kecKey];

      if (!regulation) {
        return NextResponse.json(
          { success: false, error: `KEC ${code} 규정을 찾을 수 없습니다.` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          code: `KEC ${code}`,
          ...regulation,
        },
      });
    }

    // 검색
    if (search) {
      const results: Array<{
        code: string;
        title: string;
        description: string;
      }> = [];

      for (const [key, data] of Object.entries(regulations)) {
        const reg = data as { title: string; description: string };
        if (
          reg.title.includes(search) ||
          reg.description.includes(search) ||
          key.includes(search.toUpperCase())
        ) {
          results.push({
            code: key.replace('_', ' '),
            title: reg.title,
            description: reg.description,
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
        count: results.length,
      });
    }

    // 전체 목록
    const allRegulations = Object.entries(regulations).map(([key, data]) => {
      const reg = data as { title: string; description: string };
      return {
        code: key.replace('_', ' '),
        title: reg.title,
        description: reg.description,
      };
    });

    return NextResponse.json({
      success: true,
      data: allRegulations,
      formulas: kecDatabase.formulas,
    });
  } catch (error) {
    console.error('Error in KEC API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
