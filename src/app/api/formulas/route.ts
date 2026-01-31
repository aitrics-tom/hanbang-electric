import { NextRequest, NextResponse } from 'next/server';
import { formulaWhitelist } from '@/lib/guardrails/config';

/**
 * 공식 라이브러리 API
 * GET /api/formulas - 전체 공식 목록
 * GET /api/formulas?category=조명설계 - 카테고리별 공식
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  try {
    const formulas = formulaWhitelist.categories;

    // 카테고리 필터
    if (category) {
      const categoryData = formulas[category as keyof typeof formulas];
      if (!categoryData) {
        return NextResponse.json(
          { success: false, error: '해당 카테고리가 없습니다.' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: {
          category,
          formulas: categoryData.formulas,
        },
      });
    }

    // 검색 필터
    if (search) {
      const results: Array<{
        category: string;
        formula: (typeof formulaWhitelist.categories)[keyof typeof formulaWhitelist.categories]['formulas'][0];
      }> = [];

      for (const [cat, data] of Object.entries(formulas)) {
        for (const formula of data.formulas) {
          if (
            formula.name.includes(search) ||
            formula.formula.includes(search) ||
            Object.values(formula.variables).some((v) =>
              v.name.includes(search)
            )
          ) {
            results.push({ category: cat, formula });
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
        count: results.length,
      });
    }

    // 전체 목록 반환
    const allFormulas = Object.entries(formulas).map(([category, data]) => ({
      category,
      count: data.formulas.length,
      formulas: data.formulas.map((f) => ({
        name: f.name,
        formula: f.formula,
        latex: f.latex,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: allFormulas,
      constants: formulaWhitelist.constants,
    });
  } catch (error) {
    console.error('Error in formulas API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
