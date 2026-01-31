/**
 * Footer - 푸터 컴포넌트
 */

import React, { memo } from 'react';

export const Footer = memo(function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
        <p>&copy; 2025 한방전기. All rights reserved.</p>
        <p className="mt-2">Powered by NVIDIA Nemotron &amp; Google Gemini 3.0 Flash</p>
      </div>
    </footer>
  );
});
