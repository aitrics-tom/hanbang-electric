/**
 * ProblemInput - 문제 입력 컴포넌트
 *
 * Frontend Patterns: Controlled Form with Composition
 */

'use client';

import React, { memo, useState, useRef, useCallback } from 'react';
import { Camera, Image as ImageIcon, X, Zap, Loader2, Lightbulb } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/common';
import { cn } from '@/lib/utils';

interface ProblemInputProps {
  onSubmit: (input: { text?: string; imageBase64?: string }) => void;
  isLoading: boolean;
}

export const ProblemInput = memo(function ProblemInput({ onSubmit, isLoading }: ProblemInputProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // 파일 처리 공통 함수
  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하만 가능합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  // 드래그앤드롭 핸들러
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleImageSubmit = useCallback(() => {
    if (!imagePreview) return;
    onSubmit({ imageBase64: imagePreview });
  }, [imagePreview, onSubmit]);

  const handleTextSubmit = useCallback(() => {
    if (!text.trim()) return;
    onSubmit({ text: text.trim() });
  }, [text, onSubmit]);

  const clearImage = useCallback(() => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">문제 풀이</h1>
        <p className="text-slate-500">사진을 업로드하거나 문제를 입력하세요</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        <TabButton
          active={activeTab === 'image'}
          onClick={() => setActiveTab('image')}
          icon={<Camera size={18} />}
          label="사진 업로드"
        />
        <TabButton
          active={activeTab === 'text'}
          onClick={() => setActiveTab('text')}
          icon={<Lightbulb size={18} />}
          label="텍스트 입력"
        />
      </div>

      {/* Image Upload Tab */}
      {activeTab === 'image' && (
        <Card>
          <CardBody>
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="업로드된 문제"
                  className="w-full max-h-96 object-contain rounded-lg border border-slate-200"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 bg-slate-800/70 text-white p-1.5 rounded-full hover:bg-slate-900 transition-colors"
                  aria-label="이미지 제거"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all relative',
                  isDragging
                    ? 'border-teal-500 bg-teal-50 scale-[1.02]'
                    : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50/50'
                )}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                {/* 드래그 오버레이 */}
                {isDragging && (
                  <div className="absolute inset-0 flex items-center justify-center bg-teal-500/10 rounded-xl z-10 pointer-events-none">
                    <div className="bg-white px-6 py-4 rounded-xl shadow-lg border-2 border-teal-500 border-dashed">
                      <p className="text-teal-700 font-semibold text-lg">여기에 이미지를 놓으세요</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center gap-4">
                  <div className={cn(
                    'p-4 rounded-full transition-colors',
                    isDragging ? 'bg-teal-100' : 'bg-slate-100'
                  )}>
                    <ImageIcon size={32} className={isDragging ? 'text-teal-500' : 'text-slate-400'} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">
                      {isDragging ? '이미지를 놓으세요' : '클릭 또는 드래그하여 이미지 업로드'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      PNG, JPG, WEBP (최대 10MB)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
              aria-hidden="true"
            />

            {imagePreview && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-4 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  다른 이미지 선택
                </button>
                <button
                  onClick={handleImageSubmit}
                  disabled={isLoading}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                    isLoading
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-teal-600 text-white hover:bg-teal-700'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Zap size={18} />
                      AI에게 물어보기
                    </>
                  )}
                </button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Text Input Tab */}
      {activeTab === 'text' && (
        <Card>
          <CardBody>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`문제를 입력하세요...\n\n예: 바닥 면적이 200m²인 사무실에 평균 조도 500lx를 얻고자 한다. 광원의 광속이 3000lm이고, 조명률 0.6, 감광보상률 1.3일 때 필요한 등 수는?`}
              className="w-full min-h-[200px] p-4 rounded-lg border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <button
              onClick={handleTextSubmit}
              disabled={isLoading || !text.trim()}
              className={cn(
                'w-full mt-4 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                isLoading || !text.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  AI에게 물어보기
                </>
              )}
            </button>
          </CardBody>
        </Card>
      )}

      {/* Guide */}
      <Card className="bg-slate-50">
        <CardHeader icon={<Lightbulb size={18} className="text-teal-600" />}>
          질문 가이드
        </CardHeader>
        <CardBody className="text-sm text-slate-600 space-y-2">
          <p>• 문제 전체가 보이게 촬영해주세요</p>
          <p>• 손글씨, 수식, 회로도 모두 인식 가능합니다</p>
          <p>• 주어진 조건과 구하고자 하는 값을 명확히 해주세요</p>
          <p>• 단위를 포함하면 더 정확한 답변을 받을 수 있습니다</p>
        </CardBody>
      </Card>
    </div>
  );
});

// Sub-component
const TabButton = memo(function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all',
        active
          ? 'bg-white text-teal-600 shadow-sm'
          : 'text-slate-600 hover:text-slate-900'
      )}
    >
      {icon}
      {label}
    </button>
  );
});
