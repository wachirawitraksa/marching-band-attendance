import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Profile } from '@/types';

export function useAuth() {
  const { user, profile, isLoading, setUser, setProfile, setLoading, clear } = useAuthStore();

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, section:sections(*), instrument:instruments(*, section:sections(*))')
        .eq('id', userId)
        .single();
      if (error) return null;
      setProfile(data as Profile);
      return data as Profile;
    } catch {
      return null;
    }
  }, [setProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
        const profileData = await fetchProfile(data.user.id);
        if (profileData && !profileData.is_active) {
          await supabase.auth.signOut();
          clear();
          throw new Error('บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        }
        return { user: data.user, profile: profileData };
      }
    } catch (err) {
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading, fetchProfile, clear]);

  // signOut: clears state — navigation is handled by onAuthStateChange in App.tsx
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    } finally {
      clear();
    }
  }, [clear]);

  const forgotPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  return {
    user,
    profile,
    isLoading,
    isAdmin: profile?.role === 'admin',
    isTeacher: profile?.role === 'teacher' || profile?.role === 'admin',
    isStudent: profile?.role === 'student',
    signIn,
    signOut,
    forgotPassword,
    updatePassword,
    fetchProfile,
  };
}
