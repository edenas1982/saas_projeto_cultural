import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, Tarefa } from '../types';

export function useData() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!supabase) return;
    try {
      const [leadsResponse, tarefasResponse] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('tarefas').select('*').order('created_at', { ascending: false })
      ]);

      if (leadsResponse.data) setLeads(leadsResponse.data as Lead[]);
      if (tarefasResponse.data) setTarefas(tarefasResponse.data as Tarefa[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addLead = async (lead: Omit<Lead, 'id' | 'created_at'>) => {
    if (!supabase) return;
    const { data } = await supabase.from('leads').insert([lead]).select();
    if (data && data.length > 0) {
      setLeads(prev => [data[0] as Lead, ...prev]);
    }
  };

  const updateLeadStatus = async (id: string, status: Lead['status']) => {
    if (!supabase) return;
    await supabase.from('leads').update({ status }).eq('id', id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const logContato = async (id: string) => {
    if (!supabase) return;
    const now = new Date().toISOString();
    await supabase.from('leads').update({ ultimo_contato: now }).eq('id', id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ultimo_contato: now } : l));
  };

  const addTarefa = async (tarefa: Omit<Tarefa, 'id' | 'created_at' | 'concluida'>) => {
    if (!supabase) return;
    const { data } = await supabase.from('tarefas').insert([{ ...tarefa, concluida: false }]).select();
    if (data && data.length > 0) {
      setTarefas(prev => [data[0] as Tarefa, ...prev]);
    }
  };

  const toggleTarefa = async (id: string, concluida: boolean) => {
    if (!supabase) return;
    await supabase.from('tarefas').update({ concluida }).eq('id', id);
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, concluida } : t));
  };

  return {
    leads,
    tarefas,
    loading,
    refresh: fetchData,
    addLead,
    updateLeadStatus,
    logContato,
    addTarefa,
    toggleTarefa
  };
}
