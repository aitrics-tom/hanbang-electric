'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">전실 AI</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/solve">
            <Button variant="ghost" size="sm">
              문제 풀이
            </Button>
          </Link>
          <Link href="/formulas">
            <Button variant="ghost" size="sm">
              공식
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              대시보드
            </Button>
          </Link>
          <Link href="/solve">
            <Button size="sm">시작하기</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
