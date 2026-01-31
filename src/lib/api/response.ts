/**
 * 표준화된 API Response 헬퍼
 */

import { NextResponse } from 'next/server';

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    processingTime?: number;
    [key: string]: unknown;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: number;
  details?: unknown;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function successResponse<T>(
  data: T,
  meta?: SuccessResponse<T>['meta'],
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta,
    },
    { status }
  );
}

export function errorResponse(
  error: string,
  status = 500,
  details?: unknown
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error,
      code: status,
      details,
    },
    { status }
  );
}

export function createdResponse<T>(
  data: T,
  meta?: SuccessResponse<T>['meta']
): NextResponse<ApiResponse<T>> {
  return successResponse(data, meta, 201);
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
