/**
 * HeroSection - 홈페이지 히어로 섹션
 *
 * Frontend Patterns: Memoization for Pure Components
 */

'use client';

import React, { memo, useState, useRef, useCallback } from 'react';
import { Camera, Image as ImageIcon, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  onSubmit: (text: string, image: string | null) => void;
}

export const HeroSection = memo(function HeroSection({ onSubmit }: HeroSectionProps) {
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

  const handleSubmit = useCallback(() => {
    if (!text.trim() && !imagePreview) return;
    onSubmit(text, imagePreview);
  }, [text, imagePreview, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const clearImage = useCallback(() => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const isSubmitDisabled = !text.trim() && !imagePreview;

  return (
    <section className="relative w-full bg-gradient-to-b from-teal-50 to-white pt-12 pb-20 px-4">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        {/* Hero Text */}
        <div className="space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-semibold tracking-wide uppercase">
            <span>AI Powered</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
            전기기사 실기, <br className="hidden sm:block" />
            <span className="text-teal-600">AI가 해결해드립니다</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            문제를 사진으로 찍거나 입력하세요. AI가 즉시 분석하고 단계별 풀이를 제공합니다.
            단답형부터 복잡한 시퀀스 회로까지 모두 가능합니다.
          </p>
        </div>

        {/* Input Card - 드래그앤드롭 지원 */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'bg-white p-2 rounded-2xl shadow-xl border-2 transition-all hover:shadow-2xl relative',
            isDragging
              ? 'border-teal-500 bg-teal-50 scale-[1.02]'
              : 'border-slate-200 hover:border-teal-200'
          )}
        >
          {/* 드래그 오버레이 */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-teal-500/10 rounded-2xl z-10 pointer-events-none">
              <div className="bg-white px-6 py-4 rounded-xl shadow-lg border-2 border-teal-500 border-dashed">
                <p className="text-teal-700 font-semibold text-lg">여기에 이미지를 놓으세요</p>
              </div>
            </div>
          )}
          {/* Image Preview */}
          {imagePreview && (
            <div className="relative w-full p-4 bg-slate-50 rounded-xl mb-2 border border-dashed border-slate-300 flex justify-center">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-64 rounded-lg object-contain shadow-sm"
              />
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 bg-slate-800/70 text-white p-1 rounded-full hover:bg-slate-900 transition-colors"
                aria-label="이미지 제거"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Text Area */}
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="여기에 문제 내용을 입력하거나, 이미지를 드래그하여 놓으세요..."
              className="w-full min-h-[120px] p-4 pr-32 rounded-xl text-lg text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none bg-transparent"
              aria-label="문제 입력"
            />

            {/* Action Bar */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
              <div className="flex gap-2">
                <ActionButton
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Camera size={18} />}
                  label="사진 촬영"
                />
                <ActionButton
                  onClick={() => fileInputRef.current?.click()}
                  icon={<ImageIcon size={18} />}
                  label="이미지 업로드"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                  aria-hidden="true"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-md',
                  isSubmitDisabled
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700 hover:scale-105'
                )}
              >
                <span>AI에게 물어보기</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Feature Tags */}
        <div className="flex justify-center gap-8 text-sm text-slate-500">
          <FeatureTag color="green" label="손글씨 인식" />
          <FeatureTag color="blue" label="수식 분석" />
          <FeatureTag color="purple" label="회로도 해석" />
        </div>
      </div>
    </section>
  );
});

// Sub-components
const ActionButton = memo(function ActionButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
});

const FeatureTag = memo(function FeatureTag({
  color,
  label,
}: {
  color: 'green' | 'blue' | 'purple';
  label: string;
}) {
  const colors = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };

  return (
    <span className="flex items-center gap-1">
      <span className={cn('w-2 h-2 rounded-full', colors[color])} />
      {label}
    </span>
  );
});
