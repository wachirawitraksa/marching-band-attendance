import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Edit2, GraduationCap, UserCheck,
  Loader2, Plus, X, Save, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { getAvatarFallback } from '@/lib/utils';
import { Profile, Section, Instrument } from '@/types';
import { useAuthStore } from '@/store/authStore';

// ---- form type ----
interface StudentForm {
  full_name: string;
  nickname: string;
  email: string;
  password: string;
  student_id: string;
  year_level: string;
  section_id: string;
  instrument_id: string;
  is_in_club: boolean;
  is_active: boolean;
}

const emptyForm: StudentForm = {
  full_name: '', nickname: '', email: '', password: '',
  student_id: '', year_level: '', section_id: '',
  instrument_id: '', is_in_club: true, is_active: true,
};

export default function StudentsPage() {
  const { profile: myProfile } = useAuthStore();
  const isAdmin = myProfile?.role === 'admin';

  const [students, setStudents]       = useState<Profile[]>([]);
  const [graduated, setGraduated]     = useState<Profile[]>([]);
  const [sections, setSections]       = useState<Section[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('active');

  // filters
  const [search, setSearch]           = useState('');
  const [filterSection, setFilterSection] = useState('all');
  const [filterYear, setFilterYear]   = useState('all');

  // dialogs
  const [editDialog, setEditDialog]   = useState<Profile | null>(null);   // แก้ไข
  const [addDialog, setAddDialog]     = useState(false);                   // เพิ่มใหม่
  const [promoteDialog, setPromoteDialog] = useState(false);

  // forms
  const [editForm, setEditForm]       = useState<Partial<StudentForm>>({});
  const [addForm, setAddForm]         = useState<StudentForm>(emptyForm);

  const [saving, setSaving]           = useState(false);
  const [addError, setAddError]       = useState('');
  const [promoting, setPromoting]     = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: active }, { data: grads }, { data: secs }, { data: insts }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, section:sections(*), instrument:instruments(*, section:sections(*))')
        .eq('role', 'student').eq('is_graduated', false).eq('is_active', true)
        .order('full_name'),
      supabase
        .from('profiles')
        .select('*, section:sections(*), instrument:instruments(*, section:sections(*))')
        .eq('role', 'student').eq('is_graduated', true)
        .order('full_name'),
      supabase.from('sections').select('*').order('name'),
      supabase.from('instruments').select('*, section:sections(*)').order('name'),
    ]);
    setStudents(active || []);
    setGraduated(grads || []);
    setSections(secs || []);
    setInstruments(insts || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---- filtered list ----
  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      s.full_name.toLowerCase().includes(q) ||
      (s.nickname || '').toLowerCase().includes(q) ||
      (s.student_id || '').includes(q) ||
      (s.email || '').toLowerCase().includes(q);
    const matchSection = filterSection === 'all' || s.section_id === filterSection;
    const matchYear    = filterYear === 'all' || String(s.year_level) === filterYear;
    return matchSearch && matchSection && matchYear;
  });

  // ---- open edit ----
  const openEdit = (s: Profile) => {
    setEditDialog(s);
    setEditForm({
      full_name:     s.full_name,
      nickname:      s.nickname || '',
      student_id:    s.student_id || '',
      year_level:    String(s.year_level || ''),
      section_id:    s.section_id || '',
      instrument_id: s.instrument_id || '',
      is_in_club:    s.is_in_club,
      is_active:     s.is_active,
    });
  };

  // ---- save edit ----
  const handleSaveEdit = async () => {
    if (!editDialog) return;
    if (!editForm.full_name?.trim()) {
      toast({ variant: 'destructive', title: 'กรุณากรอกชื่อ-นามสกุล' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name:     editForm.full_name?.trim(),
        nickname:      editForm.nickname?.trim() || null,
        student_id:    editForm.student_id?.trim() || null,
        year_level:    editForm.year_level ? Number(editForm.year_level) : null,
        section_id:    editForm.section_id || null,
        instrument_id: editForm.instrument_id || null,
        is_in_club:    editForm.is_in_club ?? true,
        is_active:     editForm.is_active ?? true,
      }).eq('id', editDialog.id);
      if (error) throw error;
      toast({ variant: 'success', title: `แก้ไขข้อมูล ${editForm.full_name} แล้ว` });
      setEditDialog(null);
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'บันทึกไม่สำเร็จ', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  };

  // ---- validate add form ----
  const validateAdd = (): string | null => {
    if (!addForm.full_name.trim()) return 'กรุณากรอกชื่อ-นามสกุล';
    if (!addForm.email.trim()) return 'กรุณากรอกอีเมล';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email)) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (!addForm.password || addForm.password.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    if (!addForm.year_level) return 'กรุณาเลือกระดับชั้น';
    return null;
  };

  // ---- add new student ----
  const handleAddStudent = async () => {
    setAddError('');
    const err = validateAdd();
    if (err) { setAddError(err); return; }
    setSaving(true);
    try {
      // สร้าง auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: addForm.email.trim().toLowerCase(),
        password: addForm.password,
        options: { data: { full_name: addForm.full_name.trim(), role: 'student' } },
      });
      if (authErr) {
        if (authErr.message.includes('already registered')) throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
        if (authErr.message.includes('Database error')) throw new Error('เกิดปัญหากับฐานข้อมูล กรุณารัน 002_hotfix_trigger.sql ก่อน');
        throw authErr;
      }
      if (!authData?.user) throw new Error('ไม่สามารถสร้างบัญชีได้');

      // รอ trigger สร้าง profile แล้ว upsert ข้อมูลเพิ่มเติม
      await new Promise(r => setTimeout(r, 600));
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id:            authData.user.id,
        email:         addForm.email.trim().toLowerCase(),
        full_name:     addForm.full_name.trim(),
        nickname:      addForm.nickname.trim() || null,
        role:          'student',
        student_id:    addForm.student_id.trim() || null,
        year_level:    Number(addForm.year_level),
        section_id:    addForm.section_id || null,
        instrument_id: addForm.instrument_id || null,
        is_in_club:    addForm.is_in_club,
        is_active:     true,
      }, { onConflict: 'id' });

      if (profileErr) {
        // upsert ล้มเหลว → ลอง update แทน
        await supabase.from('profiles').update({
          full_name:     addForm.full_name.trim(),
          nickname:      addForm.nickname.trim() || null,
          role:          'student',
          student_id:    addForm.student_id.trim() || null,
          year_level:    Number(addForm.year_level),
          section_id:    addForm.section_id || null,
          instrument_id: addForm.instrument_id || null,
          is_in_club:    addForm.is_in_club,
        }).eq('id', authData.user.id);
      }

      toast({ variant: 'success', title: `เพิ่มนักเรียน ${addForm.full_name} แล้ว` });
      setAddDialog(false);
      setAddForm(emptyForm);
      setAddError('');
      await loadAll();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  // ---- promote year ----
  const handlePromoteYear = async () => {
    setPromoting(true);
    try {
      // ม.6 → จบการศึกษา
      await supabase.from('profiles')
        .update({ is_graduated: true })
        .eq('role', 'student').eq('year_level', 6).eq('is_graduated', false);
      // ม.1-5 → เลื่อนขึ้น 1 ชั้น
      for (let y = 5; y >= 1; y--) {
        await supabase.from('profiles')
          .update({ year_level: y + 1 })
          .eq('role', 'student').eq('year_level', y).eq('is_graduated', false);
      }
      toast({ variant: 'success', title: 'เลื่อนชั้นปีการศึกษาเรียบร้อย', description: 'นักเรียน ม.6 ถูกย้ายไปส่วนจบการศึกษาแล้ว' });
      setPromoteDialog(false);
      await loadAll();
    } catch {
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด' });
    } finally {
      setPromoting(false);
    }
  };

  // ---- instruments filtered by section ----
  const filteredInstrumentsFor = (sectionId: string) =>
    sectionId ? instruments.filter(i => i.section_id === sectionId) : instruments;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users size={20} className="text-brand-400" /> ข้อมูลนักเรียน
          </h1>
          <p className="text-sm text-muted-foreground">{students.length} คน (กำลังเรียนอยู่)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadAll}>
            <RefreshCw size={13} /> รีเฟรช
          </Button>
          {isAdmin && (
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-xs border-brand-500/30 text-brand-400 hover:bg-brand-500/10"
              onClick={() => setPromoteDialog(true)}
            >
              <GraduationCap size={13} /> เลื่อนชั้นปีการศึกษา
            </Button>
          )}
          <Button variant="gold" size="sm" className="gap-1.5" onClick={() => { setAddForm(emptyForm); setAddError(''); setAddDialog(true); }}>
            <Plus size={14} /> เพิ่มนักเรียน
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active" className="gap-1.5">
            <UserCheck size={13} /> กำลังเรียน ({students.length})
          </TabsTrigger>
          <TabsTrigger value="graduated" className="gap-1.5">
            <GraduationCap size={13} /> จบการศึกษา ({graduated.length})
          </TabsTrigger>
        </TabsList>

        {/* ---- ACTIVE TAB ---- */}
        <TabsContent value="active" className="mt-4 space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-44">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ, ชื่อเล่น, รหัส, อีเมล..."
                className="pl-8 h-9 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterSection} onValueChange={setFilterSection}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="ทุก Section" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุก Section</SelectItem>
                {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-24 h-9 text-xs"><SelectValue placeholder="ทุกชั้น" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกชั้น</SelectItem>
                {[1,2,3,4,5,6].map(y => <SelectItem key={y} value={String(y)}>ม.{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium">นักเรียน</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Section / เครื่อง</th>
                      <th className="text-center p-3 font-medium">ชั้น</th>
                      <th className="text-center p-3 font-medium hidden lg:table-cell">ชุมนุม</th>
                      <th className="text-right p-3 font-medium">แก้ไข</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                          {search ? `ไม่พบนักเรียนที่ค้นหา "${search}"` : 'ยังไม่มีนักเรียน'}
                        </td>
                      </tr>
                    ) : filtered.map(s => (
                      <tr key={s.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarImage src={s.profile_picture_url || ''} />
                              <AvatarFallback className="text-xs bg-brand-500/20 text-brand-400">
                                {getAvatarFallback(s.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-xs truncate">{s.full_name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {s.nickname ? `"${s.nickname}"` : ''}{s.nickname && s.student_id ? ' • ' : ''}{s.student_id ? `#${s.student_id}` : ''}
                                {!s.nickname && !s.student_id ? s.email : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <div>
                            {s.section ? (
                              <span className="text-xs font-medium" style={{ color: s.section.color }}>
                                {s.section.name}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">ไม่ระบุ</span>}
                            {s.instrument && (
                              <p className="text-[10px] text-muted-foreground">{s.instrument.name}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-xs">
                            {s.year_level ? `ม.${s.year_level}` : '-'}
                          </Badge>
                        </td>
                        <td className="p-3 text-center hidden lg:table-cell">
                          <span className={`text-xs font-medium ${s.is_in_club ? 'text-green-400' : 'text-muted-foreground'}`}>
                            {s.is_in_club ? '✓ ใช่' : '✗ ไม่'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => openEdit(s)}>
                            <Edit2 size={12} /> แก้ไข
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- GRADUATED TAB ---- */}
        <TabsContent value="graduated" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {graduated.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-sm">ยังไม่มีนักเรียนที่จบการศึกษา</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                        <th className="text-left p-3 font-medium">นักเรียน</th>
                        <th className="text-left p-3 font-medium hidden md:table-cell">Section / เครื่อง</th>
                        <th className="text-right p-3 font-medium">แก้ไข</th>
                      </tr>
                    </thead>
                    <tbody>
                      {graduated.map(s => (
                        <tr key={s.id} className="border-b border-border/40 opacity-70 hover:opacity-100 transition-opacity">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-8 h-8 shrink-0">
                                <AvatarImage src={s.profile_picture_url || ''} />
                                <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                  {getAvatarFallback(s.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-xs">{s.full_name}</p>
                                {s.nickname && <p className="text-[10px] text-muted-foreground">"{s.nickname}"</p>}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <p className="text-xs text-muted-foreground">{s.section?.name || '-'}</p>
                            <p className="text-[10px] text-muted-foreground">{s.instrument?.name || ''}</p>
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => openEdit(s)}>
                              <Edit2 size={12} /> แก้ไข
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ======== EDIT DIALOG ======== */}
      <Dialog open={!!editDialog} onOpenChange={o => !o && setEditDialog(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={16} className="text-brand-400" />
              แก้ไขข้อมูลนักเรียน
            </DialogTitle>
            <DialogDescription>{editDialog?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">ชื่อ-นามสกุล *</Label>
                <Input
                  value={editForm.full_name || ''}
                  onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ชื่อเล่น</Label>
                <Input
                  placeholder="ไม่บังคับ"
                  value={editForm.nickname || ''}
                  onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">รหัสนักเรียน</Label>
                <Input
                  placeholder="ไม่บังคับ"
                  value={editForm.student_id || ''}
                  onChange={e => setEditForm(f => ({ ...f, student_id: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ระดับชั้น</Label>
                <Select
                  value={editForm.year_level || ''}
                  onValueChange={v => setEditForm(f => ({ ...f, year_level: v }))}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6].map(y => <SelectItem key={y} value={String(y)}>ม.{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section / กลุ่มเครื่อง</Label>
                <Select
                  value={editForm.section_id || '__none__'}
                  onValueChange={v => setEditForm(f => ({ ...f, section_id: v === '__none__' ? '' : v, instrument_id: '' }))}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                    {sections.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span style={{ color: s.color }}>■</span> {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">เครื่องดนตรี / ตำแหน่ง</Label>
              <Select
                value={editForm.instrument_id || '__none__'}
                onValueChange={v => setEditForm(f => ({ ...f, instrument_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                  {filteredInstrumentsFor(editForm.section_id || '').map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.section_id && filteredInstrumentsFor(editForm.section_id).length === 0 && (
                <p className="text-[11px] text-yellow-500">ไม่มีเครื่องดนตรีใน Section นี้</p>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm">อยู่ในคาบชุมนุม (พฤหัส 15:20)</p>
                  <p className="text-xs text-muted-foreground">ปิดถ้านักเรียนไปอยู่กิจกรรมอื่น เช่น รด.</p>
                </div>
                <Switch
                  checked={editForm.is_in_club ?? true}
                  onCheckedChange={v => setEditForm(f => ({ ...f, is_in_club: v }))}
                />
              </div>
              <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm">ใช้งานอยู่</p>
                  <p className="text-xs text-muted-foreground">ปิดเมื่อนักเรียนออกจากวง (ไม่ได้ลบข้อมูล)</p>
                </div>
                <Switch
                  checked={editForm.is_active ?? true}
                  onCheckedChange={v => setEditForm(f => ({ ...f, is_active: v }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>ยกเลิก</Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="bg-brand-500 hover:bg-brand-400 text-white gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== ADD STUDENT DIALOG ======== */}
      <Dialog open={addDialog} onOpenChange={o => { if (!o) { setAddDialog(false); setAddError(''); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={16} className="text-brand-400" /> เพิ่มนักเรียนใหม่
            </DialogTitle>
            <DialogDescription>กรอกข้อมูลนักเรียนที่ต้องการเพิ่มเข้าวง</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {addError && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{addError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">ชื่อ-นามสกุล *</Label>
                <Input
                  placeholder="ชื่อเต็ม"
                  value={addForm.full_name}
                  onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ชื่อเล่น</Label>
                <Input
                  placeholder="ไม่บังคับ"
                  value={addForm.nickname}
                  onChange={e => setAddForm(f => ({ ...f, nickname: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">รหัสนักเรียน</Label>
                <Input
                  placeholder="ไม่บังคับ"
                  value={addForm.student_id}
                  onChange={e => setAddForm(f => ({ ...f, student_id: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">อีเมล * (ใช้เข้าสู่ระบบ)</Label>
              <Input
                type="email"
                placeholder="student@email.com"
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">รหัสผ่าน * (อย่างน้อย 6 ตัว)</Label>
              <Input
                type="password"
                placeholder="••••••"
                value={addForm.password}
                onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ระดับชั้น *</Label>
                <Select
                  value={addForm.year_level}
                  onValueChange={v => setAddForm(f => ({ ...f, year_level: v }))}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6].map(y => <SelectItem key={y} value={String(y)}>ม.{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section / กลุ่มเครื่อง</Label>
                <Select
                  value={addForm.section_id || '__none__'}
                  onValueChange={v => setAddForm(f => ({ ...f, section_id: v === '__none__' ? '' : v, instrument_id: '' }))}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                    {sections.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span style={{ color: s.color }}>■</span> {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">เครื่องดนตรี / ตำแหน่ง</Label>
              <Select
                value={addForm.instrument_id || '__none__'}
                onValueChange={v => setAddForm(f => ({ ...f, instrument_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                  {filteredInstrumentsFor(addForm.section_id).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm">อยู่ในคาบชุมนุม (พฤหัส 15:20)</p>
                <p className="text-xs text-muted-foreground">ปิดถ้าไปอยู่กิจกรรมอื่น เช่น รด.</p>
              </div>
              <Switch
                checked={addForm.is_in_club}
                onCheckedChange={v => setAddForm(f => ({ ...f, is_in_club: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialog(false); setAddError(''); }}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleAddStudent}
              disabled={saving}
              className="bg-brand-500 hover:bg-brand-400 text-white gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              เพิ่มนักเรียน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== PROMOTE YEAR DIALOG ======== */}
      <Dialog open={promoteDialog} onOpenChange={o => !o && setPromoteDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-400" /> ยืนยันเลื่อนชั้น
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">ระบบจะทำการ:</p>
            <ul className="text-sm space-y-1.5 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">→</span>
                <span>นักเรียน ม.1–5 จะถูกเลื่อนขึ้น 1 ชั้น</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">→</span>
                <span>นักเรียน ม.6 จะถูกย้ายไปส่วน "จบการศึกษา"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>ข้อมูลการเช็คชื่อยังคงอยู่ครบถ้วน</span>
              </li>
            </ul>
            <Alert variant="warning">
              <AlertTriangle size={14} />
              <AlertDescription className="text-xs">
                การดำเนินการนี้ไม่สามารถยกเลิกได้ กรุณาตรวจสอบก่อนกด
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialog(false)}>ยกเลิก</Button>
            <Button
              onClick={handlePromoteYear}
              disabled={promoting}
              className="bg-brand-500 hover:bg-brand-400 text-white gap-1.5"
            >
              {promoting ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
              ยืนยันเลื่อนชั้น
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
