/**
 * Navbar - 네비게이션 바
 *
 * Frontend Patterns: Memoization for Pure Components
 */

'use client';

import React, { memo, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, Home, FileText, LayoutDashboard, BookOpen, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

export const Navbar = memo(function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, signOut } = useAuth();

  const handleLogout = useCallback(async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await signOut();
      window.location.href = '/login';
    }
  }, [signOut]);

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'home', label: '홈', href: '/', icon: <Home size={20} /> },
      { id: 'solve', label: '문제 풀이', href: '/solve', icon: <FileText size={20} /> },
      { id: 'dashboard', label: '대시보드', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
      { id: 'formulas', label: '공식', href: '/formulas', icon: <BookOpen size={20} /> },
    ],
    []
  );

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/';
      return pathname.startsWith(href);
    },
    [pathname]
  );

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <div className="bg-teal-600 p-1.5 rounded-lg">
              <Zap className="text-white" size={24} fill="currentColor" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">한방전기</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1 sm:space-x-4">
            {navItems.map((item) => (
              <NavLink key={item.id} item={item} active={isActive(item.href)} />
            ))}

            {/* Logout Button */}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-2"
                title="로그아웃"
              >
                <LogOut size={20} />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
});

// Sub-component
const NavLink = memo(function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        active ? 'text-teal-600 bg-teal-50' : 'text-slate-600 hover:text-teal-600 hover:bg-slate-50'
      )}
    >
      {item.icon}
      <span className="hidden sm:inline">{item.label}</span>
    </Link>
  );
});
