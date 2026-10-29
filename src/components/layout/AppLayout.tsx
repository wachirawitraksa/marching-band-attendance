import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardCheck, Calendar, BarChart3,
  Users, Settings, LogOut, Menu, X, Music2, Sun, Moon, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { cn, getAvatarFallback } from '@/lib/utils';
import { ROLE_LABELS } from '@/types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'แดชบอร์ด', icon: <LayoutDashboard size={18} /> },
  { path: '/attendance', label: 'เช็คชื่อ', icon: <ClipboardCheck size={18} /> },
  { path: '/schedule', label: 'ตารางซ้อม', icon: <Calendar size={18} /> },
  { path: '/reports', label: 'รายงาน', icon: <BarChart3 size={18} />, roles: ['admin', 'teacher'] },
  { path: '/students', label: 'ข้อมูลนักเรียน', icon: <Users size={18} />, roles: ['admin', 'teacher'] },
  { path: '/admin', label: 'จัดการระบบ', icon: <Settings size={18} />, roles: ['admin', 'teacher'] },
  { path: '/profile', label: 'โปรไฟล์', icon: <User size={18} /> },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useAuthStore();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut(); // signOut already navigates to /login via onAuthStateChange
  };

  // drawer มือถือเปิดค้างตอนขยายจอเป็น desktop → ปิดเอง ไม่ให้ focus trap / scroll lock ค้างอยู่หลังจอที่มองไม่เห็น
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const visibleNav = navItems.filter(item =>
    !item.roles || (profile && item.roles.includes(profile.role))
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center gold-glow-sm">
          <Music2 size={18} className="text-brand-text" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm leading-tight text-foreground">Strisrinan</span>
          <span className="text-[10px] text-muted-foreground leading-tight">Marching Band</span>
        </div>
      </div>

      {/* User info */}
      {profile && (
        <div className="px-3 py-3 mx-3 my-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2.5">
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile.profile_picture_url || ''} />
              <AvatarFallback className="bg-brand-500/20 text-brand-text text-xs">
                {getAvatarFallback(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-foreground">
                {profile.nickname ? `${profile.nickname}` : profile.full_name.split(' ')[0]}
              </p>
              <Badge variant="gold" className="text-[9px] px-1.5 py-0 h-4">
                {ROLE_LABELS[profile.role]}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="เมนูหลัก" className="flex-1 px-2 space-y-0.5 overflow-y-auto py-1">
        {visibleNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-brand-500/15 text-brand-text font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                {item.badge}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 pb-4 space-y-0.5 border-t border-border pt-2 mt-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-danger/10 w-full transition-colors"
        >
          <LogOut size={18} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile drawer — Radix Dialog: focus trap, Esc ปิดได้, คืน focus ให้ปุ่มเมนู */}
      <DialogPrimitive.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border md:hidden duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left focus:outline-none"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <DialogPrimitive.Title className="sr-only">เมนูนำทาง</DialogPrimitive.Title>
            <SidebarContent />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header - mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="เปิดเมนู"
            aria-haspopup="dialog"
            aria-expanded={sidebarOpen}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 flex items-center justify-center">
              <Music2 size={14} className="text-brand-text" />
            </div>
            <span className="font-bold text-sm">Srinan Marching Band</span>
          </div>

          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav aria-label="เมนูลัด" className="md:hidden border-t border-border bg-card shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-around py-1.5">
            {visibleNav.slice(0, 5).map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-[48px]",
                    isActive ? "text-brand-text" : "text-muted-foreground"
                  )}
                >
                  {item.icon}
                  <span className="text-[9px] leading-tight">{item.label.split(' ')[0]}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}