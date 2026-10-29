import { useState } from 'react';
import {
  Settings, UserPlus, Users, Loader2, Eye, EyeOff,
  RefreshCw, Shield, Music, BookOpen, MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useAllProfiles, useSections, useInstruments } from '@/hooks/useSupabaseQueries';
import { toast } from '@/components/ui/use-toast';
import { getAvatarFallback } from '@/lib/utils';
import { Profile, Role, ROLE_LABELS } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { SemesterManager } from '@/components/admin/SemesterManager';
import { GPSSettingsManager } from '@/components/admin/GPSSettingsManager';

const CLASSROOM_OPTIONS: string[] = [
  '1/1','1/2','1/3','1/4','1/5','1/6','1/7','1/8','1/9','1.1','1.2','1.3',
  '2/1','2/2','2/3','2/4','2/5','2/6','2/7','2/8','2/9','2.1','2.2','2.3',
  '3/1','3/2','3/3','3/4','3/5','3/6','3/7','3/8','3/9','3.1','3.2','3.3',
  '4/1','4/2','4/3','4/4','4/5','4/6','4/7','4/8','4/9','4.1','4.2','4.3',
  '5/1','5/2','5/3','5/4','5/5','5/6','5/7','5/8','5/9','5.1','5.2','5.3',
  '6/1','6/2','6/3','6/4','6/5','6/6','6/7','6/8','6/9','6.1','6.2','6.3',
];

interface CreateUserForm {
  email: string; password: string; full_name: string; nickname: string;
  role: Role; student_id: string; year_level: string; classroom: string;
  section_id: string; instrument_id: string; is_in_club: boolean;
}
const defaultForm: CreateUserForm = {
  email: '', password: '', full_name: '', nickname: '',
  role: 'student', student_id: '', year_level: '', classroom: '',
  section_id: '', instrument_id: '', is_in_club: true,
};

export default function AdminPage() {
  const { profile: myProfile } = useAuthStore();
  const isAdmin = myProfile?.role === 'admin';
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: usersLoading } = useAllProfiles();
  const { data: sections = [] } = useSections();
  const { data: instruments = [] } = useInstruments();
  const loading = usersLoading;

  // เรียกหลังสร้าง/แก้ไขผู้ใช้ เพื่อให้ profiles cache ทุกหน้าอัปเดตพร้อมกัน
  const refreshUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(defaultForm);
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [tab, setTab] = useState('users');

  // Validate create user form
  const validateCreate = (): string | null => {
    if (!form.email.trim()) return 'กรุณากรอกอีเมล';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (!form.password) return 'กรุณากรอกรหัสผ่าน';
    if (form.password.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    if (!form.full_name.trim()) return 'กรุณากรอกชื่อ-นามสกุล';
    if (form.role === 'student' && !form.year_level) return 'กรุณาเลือกระดับชั้น';
    return null;
  };

  const handleCreate = async () => {
    setCreateError('');
    const err = validateCreate();
    if (err) { setCreateError(err); return; }
    setCreating(true);

    const email = form.email.trim().toLowerCase();
    const profilePayload = {
      full_name: form.full_name.trim(),
      nickname: form.nickname.trim() || null,
      role: form.role,
      student_id: form.student_id.trim() || null,
      year_level: form.year_level ? Number(form.year_level) : null,
      classroom: form.classroom.trim() || null,
      section_id: form.section_id || null,
      instrument_id: form.instrument_id || null,
      is_in_club: form.is_in_club,
      email,
    };

    try {
      // Step 1: สร้าง auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: { full_name: form.full_name.trim(), role: form.role },
          // ไม่ redirect email เพื่อให้ admin สร้างบัญชีได้ทันที
          emailRedirectTo: undefined,
        },
      });

      if (authErr) {
        // แปล error message เป็นภาษาไทย
        const msg = authErr.message;
        if (msg.includes('already registered') || msg.includes('User already registered')) {
          throw new Error('อีเมลนี้ถูกใช้งานแล้วในระบบ');
        }
        if (msg.includes('Database error')) {
          throw new Error('เกิดปัญหากับฐานข้อมูล กรุณารัน SQL Hotfix ก่อน (ดู README)');
        }
        if (msg.includes('invalid email')) {
          throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
        }
        throw authErr;
      }

      if (!authData?.user) {
        throw new Error('ไม่สามารถสร้างบัญชีได้ กรุณาตรวจสอบการตั้งค่า Supabase');
      }

      const userId = authData.user.id;

      // Step 2: รอสักครู่แล้ว upsert profile
      // (trigger อาจสร้าง profile ไปแล้ว ใช้ upsert เพื่อความปลอดภัย)
      await new Promise(r => setTimeout(r, 500));

      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...profilePayload }, { onConflict: 'id' });

      if (upsertErr) {
        // profile อาจสร้างสำเร็จแต่ upsert ล้มเหลว ลอง update แทน
        const { error: updateErr } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', userId);

        if (updateErr) {
          // auth user สร้างแล้วแต่ profile ไม่สมบูรณ์ — แจ้งให้รู้
          console.error('Profile upsert failed:', upsertErr, updateErr);
          toast({
            variant: 'default',
            title: '⚠ บัญชีถูกสร้าง แต่ข้อมูลบางส่วนไม่สมบูรณ์',
            description: 'กรุณาแก้ไขข้อมูลในหน้านักเรียนอีกครั้ง',
          });
        }
      }

      toast({ variant: 'success', title: `✓ สร้างบัญชี "${form.full_name}" สำเร็จ` });
      setCreateDialog(false);
      setForm(defaultForm);
      setShowPw(false);
      refreshUsers();

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (userId: string, current: boolean) => {
    if (userId === myProfile?.id) { toast({ variant: 'destructive', title: 'ไม่สามารถปิดบัญชีตัวเองได้' }); return; }
    const { error } = await supabase.from('profiles').update({ is_active: !current }).eq('id', userId);
    if (error) { toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด' }); return; }
    toast({ variant: 'success', title: !current ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว' });
    refreshUsers();
  };

  const handleChangeRole = async (userId: string, role: Role) => {
    if (userId === myProfile?.id) { toast({ variant: 'destructive', title: 'ไม่สามารถเปลี่ยน Role ตัวเองได้' }); return; }
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) { toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด' }); return; }
    toast({ variant: 'success', title: 'เปลี่ยน Role แล้ว' });
    refreshUsers();
  };

  const filteredInstruments = instruments.filter(i => !form.section_id || i.section_id === form.section_id);
  const roleGroups = {
    admin: users.filter(u => u.role === 'admin'),
    teacher: users.filter(u => u.role === 'teacher'),
    student: users.filter(u => u.role === 'student'),
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={32} className="animate-spin text-brand-text" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Settings size={20} className="text-brand-text" /> จัดการระบบ</h1>
          <p className="text-sm text-muted-foreground">บัญชีผู้ใช้, ภาคเรียน และการตั้งค่า</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refreshUsers}><RefreshCw size={13} /> รีเฟรช</Button>
          <Button variant="gold" size="sm" className="gap-1.5" onClick={() => setCreateDialog(true)}><UserPlus size={14} /> สร้างบัญชี</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto grid grid-cols-4 md:flex">
          <TabsTrigger value="users" className="gap-1.5 text-xs"><Users size={13} /> บัญชี ({users.length})</TabsTrigger>
          <TabsTrigger value="semester" className="gap-1.5 text-xs"><BookOpen size={13} /> ภาคเรียน</TabsTrigger>
          <TabsTrigger value="sections" className="gap-1.5 text-xs"><Music size={13} /> Section</TabsTrigger>
          <TabsTrigger value="gps" className="gap-1.5 text-xs"><MapPin size={13} /> GPS</TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="mt-4 space-y-4">
          {(['admin', 'teacher', 'student'] as Role[]).map(role => (
            <Card key={role}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield size={14} className="text-brand-text" />
                  {ROLE_LABELS[role]} ({roleGroups[role].length} คน)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {roleGroups[role].length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 pb-4">ไม่มีผู้ใช้</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {roleGroups[role].map(user => (
                      <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={user.profile_picture_url || ''} />
                            <AvatarFallback className="text-xs bg-brand-500/20 text-brand-text">{getAvatarFallback(user.full_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{user.full_name}{user.nickname && <span className="text-muted-foreground text-xs ml-1">({user.nickname})</span>}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && user.id !== myProfile?.id && (
                            <Select value={user.role} onValueChange={v => handleChangeRole(user.id, v as Role)}>
                              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="teacher">ครู</SelectItem>
                                <SelectItem value="student">นักเรียน</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Switch
                            checked={user.is_active}
                            onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                            disabled={user.id === myProfile?.id}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* SEMESTER TAB */}
        <TabsContent value="semester" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen size={15} className="text-brand-text" /> จัดการภาคเรียน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SemesterManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTIONS TAB */}
        <TabsContent value="sections" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Sections</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {sections.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.name_en}</p>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{instruments.filter(i => i.section_id === s.id).length} เครื่อง</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">เครื่องดนตรี</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 max-h-96 overflow-y-auto">
                {instruments.map(i => (
                  <div key={i.id} className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-2"><Music size={13} className="text-muted-foreground" /><span className="text-sm">{i.name}</span></div>
                    <span className="text-xs text-muted-foreground">{i.section?.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GPS SETTINGS TAB */}
        <TabsContent value="gps" className="mt-4">
          <GPSSettingsManager />
        </TabsContent>
      </Tabs>

      {/* Create user dialog */}
      <Dialog open={createDialog} onOpenChange={o => { if (!o) { setCreateDialog(false); setCreateError(''); setForm(defaultForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus size={18} className="text-brand-text" /> สร้างบัญชีใหม่</DialogTitle>
            <DialogDescription>กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้ใหม่</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[65vh] overflow-y-auto pr-1">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm space-y-1">
                  <p>{createError}</p>
                  {createError.includes('ฐานข้อมูล') && (
                    <p className="text-xs opacity-80">
                      → รัน SQL ใน <code>supabase/migrations/002_hotfix_trigger.sql</code> แล้วลองใหม่
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-1">
              <Label htmlFor="admin-page-1" className="text-xs">ประเภทบัญชี</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
                <SelectTrigger id="admin-page-1" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">นักเรียน</SelectItem>
                  <SelectItem value="teacher">ครู</SelectItem>
                  {isAdmin && <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="admin-page-2" className="text-xs">ชื่อ-นามสกุล *</Label>
                <Input id="admin-page-2" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="h-9 text-sm" placeholder="ชื่อเต็ม" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-page-3" className="text-xs">ชื่อเล่น</Label>
                <Input id="admin-page-3" value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} className="h-9 text-sm" placeholder="ไม่บังคับ" />
              </div>
              {form.role === 'student' && (
                <div className="space-y-1">
                  <Label htmlFor="admin-page-4" className="text-xs">รหัสนักเรียน</Label>
                  <Input id="admin-page-4" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} className="h-9 text-sm" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-page-5" className="text-xs">อีเมล *</Label>
              <Input id="admin-page-5" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-9 text-sm" placeholder="user@email.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-page-6" className="text-xs">รหัสผ่าน * (อย่างน้อย 6 ตัว)</Label>
              <div className="relative">
                <Input id="admin-page-6" type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="h-9 text-sm pr-9" placeholder="••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={showPw} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {form.role === 'student' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="admin-page-7" className="text-xs">ชั้น *</Label>
                    <Select value={form.year_level} onValueChange={v => setForm(f => ({ ...f, year_level: v }))}>
                      <SelectTrigger id="admin-page-7" className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6].map(y => <SelectItem key={y} value={String(y)}>ม.{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-page-8" className="text-xs">ห้องเรียน</Label>
                    <Select value={form.classroom || '__none__'} onValueChange={v => setForm(f => ({ ...f, classroom: v === '__none__' ? '' : v }))}>
                      <SelectTrigger id="admin-page-8" className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                        {CLASSROOM_OPTIONS.map(c => <SelectItem key={c} value={c}>ม.{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-page-9" className="text-xs">Section</Label>
                    <Select value={form.section_id} onValueChange={v => setForm(f => ({ ...f, section_id: v, instrument_id: '' }))}>
                      <SelectTrigger id="admin-page-9" className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="admin-page-10" className="text-xs">เครื่องดนตรี</Label>
                  <Select value={form.instrument_id} onValueChange={v => setForm(f => ({ ...f, instrument_id: v }))}>
                    <SelectTrigger id="admin-page-10" className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>{filteredInstruments.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                  <Label htmlFor="admin-page-11" className="text-sm cursor-pointer">อยู่ในคาบชุมนุม</Label>
                  <Switch id="admin-page-11" checked={form.is_in_club} onCheckedChange={v => setForm(f => ({ ...f, is_in_club: v }))} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialog(false); setCreateError(''); setForm(defaultForm); }}>ยกเลิก</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-brand-500 hover:bg-brand-400 text-white">
              {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : <UserPlus size={14} className="mr-1" />}สร้างบัญชี
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
