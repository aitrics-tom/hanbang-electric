import { NextResponse } from 'next/server';

/**
 * API 상태 확인 엔드포인트
 * GET /api/status
 */
export async function GET() {
  const status = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    apis: {
      nemotron: {
        configured: !!process.env.NEMOTRON_API_KEY,
        url: process.env.NEMOTRON_API_URL || 'https://integrate.api.nvidia.com/v1',
      },
      nim: {
        configured: !!process.env.NIM_API_KEY,
        url: process.env.NIM_API_URL || 'https://integrate.api.nvidia.com/v1',
      },
    },
    mode: process.env.NEMOTRON_API_KEY ? 'production' : 'demo',
  };

  // API 연결 테스트
  if (process.env.NEMOTRON_API_KEY) {
    try {
      const testResponse = await fetch(
        `${status.apis.nemotron.url}/models`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEMOTRON_API_KEY}`,
          },
        }
      );

      if (testResponse.ok) {
        const models = await testResponse.json();
        return NextResponse.json({
          ...status,
          nemotronConnection: 'OK',
          availableModels: models.data?.slice(0, 10).map((m: { id: string }) => m.id) || [],
        });
      } else {
        const errorData = await testResponse.json().catch(() => ({}));
        return NextResponse.json({
          ...status,
          nemotronConnection: 'FAILED',
          error: errorData.error || testResponse.statusText,
        });
      }
    } catch (error) {
      return NextResponse.json({
        ...status,
        nemotronConnection: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json(status);
}
