import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AcademicTerm } from '@/types';

export function useTerm() {
  const [currentTerm, setCurrentTerm] = useState<AcademicTerm | null>(null);
  const [allTerms, setAllTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    try {
      // Add timeout for terms fetch
      const queryPromise = supabase
        .from('academic_terms')
        .select('*')
        .order('academic_year', { ascending: false })
        .order('semester', { ascending: false });
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Academic terms fetch timeout')), 5000)
      );
      
      const { data } = await Promise.race([queryPromise, timeoutPromise]);
      setAllTerms(data || []);
      setCurrentTerm(data?.find(t => t.is_current) || null);
    } catch (error) {
      console.error('Error fetching terms:', error);
      setAllTerms([]);
      setCurrentTerm(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  const switchTerm = useCallback(async (termId: string) => {
    // Unset all current
    await supabase.from('academic_terms').update({ is_current: false }).neq('id', '');
    // Set new current
    const { data, error } = await supabase
      .from('academic_terms')
      .update({ is_current: true })
      .eq('id', termId)
      .select()
      .single();
    if (error) throw error;
    await fetchTerms();
    return data;
  }, [fetchTerms]);

  const createTerm = useCallback(async (
    academic_year: number,
    semester: 1 | 2,
    start_date: string,
    end_date: string | null,
    created_by: string
  ) => {
    const label = `ภาคเรียนที่ ${semester}/${academic_year}`;
    const { data, error } = await supabase
      .from('academic_terms')
      .insert({ academic_year, semester, start_date, end_date, label, created_by })
      .select()
      .single();
    if (error) throw error;
    await fetchTerms();
    return data;
  }, [fetchTerms]);

  return { currentTerm, allTerms, loading, switchTerm, createTerm, refetch: fetchTerms };
}
