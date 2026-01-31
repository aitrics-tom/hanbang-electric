/**
 * API Error 클래스 및 에러 핸들링
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  static unauthorized(message = '인증이 필요합니다') {
    return new ApiError(401, message);
  }

  static forbidden(message = '접근 권한이 없습니다') {
    return new ApiError(403, message);
  }

  static notFound(message = '리소스를 찾을 수 없습니다') {
    return new ApiError(404, message);
  }

  static tooManyRequests(message = '요청이 너무 많습니다') {
    return new ApiError(429, message);
  }

  static internal(message = '서버 오류가 발생했습니다') {
    return new ApiError(500, message, false);
  }
}

export function errorHandler(error: unknown): NextResponse {
  // API Error
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.statusCode,
      },
      { status: error.statusCode }
    );
  }

  // Zod Validation Error
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: '입력값이 올바르지 않습니다',
        details: error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  // Unknown Error
  console.error('Unexpected error:', error);

  return NextResponse.json(
    {
      success: false,
      error: '서버 오류가 발생했습니다',
    },
    { status: 500 }
  );
}
