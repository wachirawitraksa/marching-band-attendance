import { getErrorMessage } from '@/lib/utils';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Save, Lock, Loader2, User, Mail, Music,
  Shield, Eye, EyeOff, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getAvatarFallback } from '@/lib/utils';
import { Profile, ROLE_LABELS } from '@/types';

export default function ProfilePage() {
  const { setProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const [profile, setLocalProfile] = useState<Profile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [nickname, setNickname]     = useState('');

  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [pwError, setPwError]       = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // ขั้น 1: ดึง session
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw new Error(`Session error: ${sessionErr.message}`);
      if (!sessionData.session?.user) {
        setFetchError('ไม่พบ session กรุณาออกจากระบบและเข้าสู่ระบบใหม่');
        setLoading(false);
        return;
      }

      const userId = sessionData.session.user.id;

      // ขั้น 2: ดึง profile (ใช้ maybeSingle แทน single เพื่อไม่ error เมื่อไม่พบ)
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          section:sections(*),
          instrument:instruments(*, section:sections(*))
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        // แสดง error จริงเพื่อ debug
        console.error('Profile fetch error:', error);
        if (error.code === '42P17') {
          // infinite recursion — ยังไม่ได้รัน 003_fix_rls_recursion.sql
          setFetchError(
            'RLS Recursion Error: กรุณารัน SQL ใน supabase/migrations/003_fix_rls_recursion.sql ใน Supabase SQL Editor แล้วลองใหม่'
          );
        } else {
          setFetchError(`DB Error (${error.code}): ${error.message}`);
        }
        setLoading(false);
        return;
      }

      if (!data) {
        // profile ไม่มีในฐานข้อมูล → สร้างใหม่อัตโนมัติ
        const email = sessionData.session.user.email || '';
        const { data: created, error: createErr } = await supabase
          .from('profiles')
          .insert({
            id:        userId,
            email,
            full_name: email.split('@')[0],
            role:      'student',
          })
          .select('*, section:sections(*), instrument:instruments(*, section:sections(*))')
          .maybeSingle();

        if (createErr) {
          setFetchError(`สร้าง profile ไม่สำเร็จ: ${createErr.message} — กรุณารัน SQL 003_fix_rls_recursion.sql`);
          setLoading(false);
          return;
        }
        if (created) {
          setLocalProfile(created as Profile);
          setNickname(created.nickname || '');
          setProfile(created as Profile);
        }
      } else {
        setLocalProfile(data as Profile);
        setNickname(data.nickname || '');
        setProfile(data as Profile);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('fetchProfile caught:', msg);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [setProfile]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSaveNickname = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nickname: nickname.trim() || null })
        .eq('id', profile.id);
      if (error) throw error;
      await fetchProfile();
      // ให้ StudentsPage/AdminPage/หน้าเช็คชื่อ (ครู) เห็นชื่อเล่นใหม่ทันที
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({ variant: 'success', title: 'บันทึกชื่อเล่นแล้ว' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'บันทึกไม่สำเร็จ', description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'ไฟล์ต้องมีขนาดไม่เกิน 5MB' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('profile-pictures')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('profile-pictures').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ profile_picture_url: url }).eq('id', profile.id);
      await fetchProfile();
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({ variant: 'success', title: 'อัปโหลดรูปสำเร็จ' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'อัปโหลดไม่สำเร็จ', description: getErrorMessage(err) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (!newPw || !confirmPw) { setPwError('กรุณากรอกรหัสผ่านให้ครบ'); return; }
    if (newPw.length < 6)     { setPwError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (newPw !== confirmPw)  { setPwError('รหัสผ่านไม่ตรงกัน'); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPw(''); setConfirmPw('');
      toast({ variant: 'success', title: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (err) {
      setPwError(getErrorMessage(err, 'เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setChangingPw(false);
    }
  };

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
        <div className="h-7 w-28 bg-muted animate-pulse rounded" />
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="w-24 h-24 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2 w-full">
                <div className="h-6 w-40 bg-muted animate-pulse rounded" />
                <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-52 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-9 w-24 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state ----
  if (fetchError) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4">โปรไฟล์</h1>
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle size={16} />
          <AlertDescription className="space-y-2">
            <p className="font-medium">โหลดข้อมูลไม่สำเร็จ</p>
            <p className="text-xs font-mono bg-black/20 p-2 rounded whitespace-pre-wrap break-all">
              {fetchError}
            </p>
            {fetchError.includes('RLS') || fetchError.includes('42P17') || fetchError.includes('recursion') ? (
              <div className="text-xs mt-2 space-y-1">
                <p className="font-semibold">วิธีแก้ไข:</p>
                <p>1. เปิด Supabase Dashboard → SQL Editor</p>
                <p>2. เปิดไฟล์ <code className="bg-black/20 px-1 rounded">supabase/migrations/003_fix_rls_recursion.sql</code></p>
                <p>3. คัดลอก SQL ทั้งหมดแล้วรัน</p>
                <p>4. กลับมากด "ลองใหม่"</p>
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
        <Button onClick={fetchProfile} className="gap-2 bg-brand-500 hover:bg-brand-400 text-white">
          <RefreshCw size={14} /> ลองใหม่
        </Button>
      </div>
    );
  }

  // ---- No profile (shouldn't happen after auto-create) ----
  if (!profile) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto text-center py-20">
        <p className="text-muted-foreground mb-3">ไม่พบข้อมูลโปรไฟล์</p>
        <Button onClick={fetchProfile} variant="outline">ลองใหม่</Button>
      </div>
    );
  }

  // ---- Main content ----
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">โปรไฟล์</h1>
          <p className="text-sm text-muted-foreground">จัดการข้อมูลส่วนตัว</p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={fetchProfile}>
          <RefreshCw size={13} /> รีเฟรช
        </Button>
      </div>

      {/* Avatar + Info */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative shrink-0">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile.profile_picture_url || ''} />
                <AvatarFallback className="text-2xl bg-brand-500/20 text-brand-text font-bold">
                  {getAvatarFallback(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                title="เปลี่ยนรูปโปรไฟล์"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-500 hover:bg-brand-400 text-white flex items-center justify-center transition-colors shadow-lg"
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              </button>
              <input
                ref={fileRef} type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleUploadPhoto}
              />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                <h2 className="text-xl font-bold leading-tight">{profile.full_name}</h2>
                {profile.nickname && (
                  <p className="text-sm text-muted-foreground">"{profile.nickname}"</p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Badge variant="gold">{ROLE_LABELS[profile.role]}</Badge>
                {profile.year_level && <Badge variant="outline">ม.{profile.year_level}</Badge>}
                {profile.section && (
                  <Badge variant="outline" style={{ borderColor: profile.section.color, color: profile.section.color }}>
                    {profile.section.name}
                  </Badge>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <Mail size={11} className="text-brand-text/70" /> {profile.email}
                </p>
                {profile.instrument && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                    <Music size={11} className="text-brand-text/70" /> {profile.instrument.name}
                  </p>
                )}
                {profile.student_id && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                    <Shield size={11} className="text-brand-text/70" /> รหัส {profile.student_id}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit nickname */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User size={15} className="text-brand-text" /> แก้ไขโปรไฟล์
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-page-1">ชื่อเล่น</Label>
            <div className="flex gap-2">
              <Input id="profile-page-1"
                placeholder="ชื่อเล่น (ไม่บังคับ)"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                maxLength={30}
                className="flex-1"
              />
              <Button
                onClick={handleSaveNickname}
                disabled={saving || nickname === (profile.nickname || '')}
                className="bg-brand-500 hover:bg-brand-400 text-white gap-1.5 shrink-0"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                บันทึก
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">กด Enter หรือปุ่มบันทึก</p>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock size={15} className="text-brand-text" /> เปลี่ยนรหัสผ่าน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pwError && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{pwError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-page-2">รหัสผ่านใหม่</Label>
              <div className="relative">
                <Input id="profile-page-2"
                  type={showPw ? 'text' : 'password'}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPw}
                  className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-page-3">ยืนยันรหัสผ่านใหม่</Label>
              <Input id="profile-page-3"
                type={showPw ? 'text' : 'password'}
                placeholder="กรอกอีกครั้ง"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
              />
            </div>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPw || !newPw || !confirmPw}
            variant="outline"
            className="gap-2"
          >
            {changingPw ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            เปลี่ยนรหัสผ่าน
          </Button>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-2.5">
            <Shield size={14} className="text-brand-text/70 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-0.5 flex-1">
              <p className="font-semibold text-foreground text-sm mb-2">ข้อมูลบัญชี</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <p>อีเมล: <span className="text-foreground">{profile.email}</span></p>
                {profile.student_id && (
                  <p>รหัสนักเรียน: <span className="text-foreground">{profile.student_id}</span></p>
                )}
                <p>สิทธิ์: <span className="text-brand-text">{ROLE_LABELS[profile.role]}</span></p>
                <p>
                  สมัครเมื่อ:{' '}
                  <span className="text-foreground">
                    {(() => {
                    const d = new Date(profile.created_at);
                    const day = String(d.getDate()).padStart(2,'0');
                    const month = String(d.getMonth()+1).padStart(2,'0');
                    const year = d.getFullYear() + 543;
                    return `${day}/${month}/${year}`;
                  })()}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
