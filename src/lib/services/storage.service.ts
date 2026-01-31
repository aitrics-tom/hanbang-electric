/**
 * Storage Service - 이미지 업로드 및 관리 (Supabase Storage)
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/api/logger';

const BUCKET_NAME = 'problem-images';

export interface UploadResult {
  url: string;
  path: string;
}

export class StorageService {
  /**
   * Base64 이미지를 Supabase Storage에 업로드
   */
  async uploadImage(
    userId: string,
    imageBase64: string,
    fileName?: string
  ): Promise<UploadResult | null> {
    const supabase = await createServerSupabaseClient();

    try {
      // Base64 데이터 파싱
      const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        logger.error('Invalid base64 image format');
        return null;
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      // 파일 확장자 결정
      const extension = mimeType.split('/')[1] || 'png';
      const timestamp = Date.now();
      const finalFileName = fileName || `problem_${timestamp}.${extension}`;
      const filePath = `${userId}/${finalFileName}`;

      // 업로드
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        logger.error('Failed to upload image', uploadError);
        return null;
      }

      // 공개 URL 생성
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        path: filePath,
      };
    } catch (error) {
      logger.error('Storage upload error', error as Error);
      return null;
    }
  }

  /**
   * 이미지 삭제
   */
  async deleteImage(filePath: string): Promise<boolean> {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      logger.error('Failed to delete image', error);
      return false;
    }

    return true;
  }

  /**
   * 사용자의 모든 이미지 목록 조회
   */
  async listUserImages(userId: string): Promise<string[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId);

    if (error) {
      logger.error('Failed to list images', error);
      return [];
    }

    return data.map((file) => `${userId}/${file.name}`);
  }

  /**
   * Signed URL 생성 (비공개 버킷용)
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      logger.error('Failed to create signed URL', error);
      return null;
    }

    return data.signedUrl;
  }
}

export const storageService = new StorageService();
