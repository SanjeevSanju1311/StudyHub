import { SimpleSubject, ChecklistTopic, TopicContent, ContentLink, CommunityMember, ActivityLog, LogActionType } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_SUBJECTS_KEY = 'peerdesk_clean_subjects_v4';
const STORAGE_MEMBERS_KEY = 'peerdesk_clean_members_v4';
const STORAGE_LOGS_KEY = 'peerdesk_clean_logs_v4';

function createDefaultUnits() {
  return {
    1: { checklist: [], contents: [] },
    2: { checklist: [], contents: [] },
    3: { checklist: [], contents: [] },
    4: { checklist: [], contents: [] },
    5: { checklist: [], contents: [] },
  };
}

function getLocalSubjects(): SimpleSubject[] {
  try {
    const raw = localStorage.getItem(STORAGE_SUBJECTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading localStorage subjects:', err);
  }
  return [];
}

function saveLocalSubjects(subjects: SimpleSubject[]) {
  try {
    localStorage.setItem(STORAGE_SUBJECTS_KEY, JSON.stringify(subjects));
  } catch (err) {
    console.error('Failed saving localStorage subjects:', err);
  }
}

function getLocalMembers(): CommunityMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_MEMBERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalMembers(members: CommunityMember[]) {
  try {
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
  } catch {
    // ignore
  }
}

function getLocalLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalLogs(logs: ActivityLog[]) {
  try {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs.slice(0, 200)));
  } catch {
    // ignore
  }
}

export const api = {
  async getSubjects(): Promise<SimpleSubject[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data) {
          const formatted: SimpleSubject[] = data.map((row: any) => ({
            id: row.id,
            name: row.name,
            semester: row.semester || undefined,
            createdBy: row.created_by || { name: 'Anonymous', timestamp: Date.now() },
            units: row.units || createDefaultUnits(),
          }));
          saveLocalSubjects(formatted);
          return formatted;
        }
      } catch (err) {
        console.warn('Supabase getSubjects failed, falling back:', err);
      }
    }

    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        saveLocalSubjects(data);
        return data;
      }
    } catch {
      // fallback
    }
    return getLocalSubjects();
  },

  async addSubject(name: string, semester?: string, userName?: string): Promise<SimpleSubject> {
    const cleanUser = userName?.trim() || 'Anonymous';
    const newSub: SimpleSubject = {
      id: 'sub-' + Date.now(),
      name: name.trim(),
      semester: semester?.trim() || undefined,
      createdBy: { name: cleanUser, timestamp: Date.now() },
      units: createDefaultUnits(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('subjects').insert({
          id: newSub.id,
          name: newSub.name,
          semester: newSub.semester || null,
          created_by: newSub.createdBy,
          units: newSub.units,
        });
        if (!error) {
          const list = getLocalSubjects();
          list.push(newSub);
          saveLocalSubjects(list);
          return newSub;
        }
      } catch (err) {
        console.warn('Supabase addSubject failed, falling back:', err);
      }
    }

    const payload = { name, semester, userName };
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    localList.push(newSub);
    saveLocalSubjects(localList);
    return newSub;
  },

  async updateSubject(id: string, name: string, semester?: string): Promise<SimpleSubject> {
    const cleanName = name.trim();
    const cleanSem = semester?.trim() || undefined;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('subjects')
          .update({ name: cleanName, semester: cleanSem || null })
          .eq('id', id);

        if (!error) {
          const list = getLocalSubjects();
          const sub = list.find((s) => s.id === id);
          if (sub) {
            sub.name = cleanName;
            sub.semester = cleanSem;
            saveLocalSubjects(list);
            return sub;
          }
        }
      } catch (err) {
        console.warn('Supabase updateSubject failed, falling back:', err);
      }
    }

    try {
      const res = await fetch(`/api/subjects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, semester: cleanSem }),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    const sub = localList.find((s) => s.id === id);
    if (!sub) throw new Error('Subject not found');
    sub.name = cleanName;
    sub.semester = cleanSem;
    saveLocalSubjects(localList);
    return sub;
  },

  async deleteSubject(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (!error) {
          const filtered = getLocalSubjects().filter((s) => s.id !== id);
          saveLocalSubjects(filtered);
          return;
        }
      } catch (err) {
        console.warn('Supabase deleteSubject failed, falling back:', err);
      }
    }

    try {
      const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
      if (res.ok) return;
    } catch {
      // fallback
    }
    const filtered = getLocalSubjects().filter((s) => s.id !== id);
    saveLocalSubjects(filtered);
  },

  async addChecklistTopic(subjectId: string, unit: number, title: string, userName?: string): Promise<ChecklistTopic> {
    const newItem: ChecklistTopic = {
      id: 'chk-' + Date.now(),
      title: title.trim(),
      completedBy: [],
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: subRow } = await supabase.from('subjects').select('units').eq('id', subjectId).single();
        if (subRow) {
          const units = subRow.units || createDefaultUnits();
          if (!units[unit]) units[unit] = { checklist: [], contents: [] };
          units[unit].checklist.push(newItem);

          const { error } = await supabase.from('subjects').update({ units }).eq('id', subjectId);
          if (!error) {
            const localList = getLocalSubjects();
            const sub = localList.find((s) => s.id === subjectId);
            if (sub) {
              if (!sub.units[unit]) sub.units[unit] = { checklist: [], contents: [] };
              sub.units[unit].checklist.push(newItem);
              saveLocalSubjects(localList);
            }
            return newItem;
          }
        }
      } catch (err) {
        console.warn('Supabase addChecklistTopic failed, falling back:', err);
      }
    }

    const payload = { title, userName };
    try {
      const res = await fetch(`/api/subjects/${subjectId}/units/${unit}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    const sub = localList.find((s) => s.id === subjectId);
    if (!sub) throw new Error('Subject not found');
    if (!sub.units[unit]) sub.units[unit] = { checklist: [], contents: [] };

    sub.units[unit].checklist.push(newItem);
    saveLocalSubjects(localList);
    return newItem;
  },

  async toggleChecklistTopic(
    subjectId: string,
    unit: number,
    checkId: string,
    userName: string
  ): Promise<{ checkId: string; completedBy: string[]; isCompleted: boolean }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: subRow } = await supabase.from('subjects').select('units').eq('id', subjectId).single();
        if (subRow) {
          const units = subRow.units || createDefaultUnits();
          const item = units[unit]?.checklist.find((c: any) => c.id === checkId);
          if (item) {
            if (!Array.isArray(item.completedBy)) item.completedBy = [];
            const idx = item.completedBy.indexOf(userName);
            if (idx > -1) {
              item.completedBy.splice(idx, 1);
            } else {
              item.completedBy.push(userName);
            }
            const { error } = await supabase.from('subjects').update({ units }).eq('id', subjectId);
            if (!error) {
              const localList = getLocalSubjects();
              const sub = localList.find((s) => s.id === subjectId);
              if (sub && sub.units[unit]) {
                const localItem = sub.units[unit].checklist.find((c) => c.id === checkId);
                if (localItem) localItem.completedBy = item.completedBy;
                saveLocalSubjects(localList);
              }
              return {
                checkId,
                completedBy: item.completedBy,
                isCompleted: item.completedBy.includes(userName),
              };
            }
          }
        }
      } catch (err) {
        console.warn('Supabase toggleChecklistTopic failed, falling back:', err);
      }
    }

    try {
      const res = await fetch(`/api/subjects/${subjectId}/units/${unit}/checklist/${checkId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName }),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    const sub = localList.find((s) => s.id === subjectId);
    if (!sub) throw new Error('Subject not found');
    const item = sub.units[unit]?.checklist.find((c) => c.id === checkId);
    if (!item) throw new Error('Checklist item not found');

    if (!Array.isArray(item.completedBy)) item.completedBy = [];
    const idx = item.completedBy.indexOf(userName);
    if (idx > -1) {
      item.completedBy.splice(idx, 1);
    } else {
      item.completedBy.push(userName);
    }

    saveLocalSubjects(localList);
    return {
      checkId,
      completedBy: item.completedBy,
      isCompleted: item.completedBy.includes(userName),
    };
  },

  async updateChecklistTopic(
    subjectId: string,
    unit: number,
    checkId: string,
    title: string
  ): Promise<ChecklistTopic> {
    const cleanTitle = title.trim();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: subRow } = await supabase.from('subjects').select('units').eq('id', subjectId).single();
        if (subRow) {
          const units = subRow.units || createDefaultUnits();
          const item = units[unit]?.checklist.find((c: any) => c.id === checkId);
          if (item) {
            item.title = cleanTitle;
            const { error } = await supabase.from('subjects').update({ units }).eq('id', subjectId);
            if (!error) {
              const localList = getLocalSubjects();
              const sub = localList.find((s) => s.id === subjectId);
              if (sub && sub.units[unit]) {
                const lItem = sub.units[unit].checklist.find((c) => c.id === checkId);
                if (lItem) lItem.title = cleanTitle;
                saveLocalSubjects(localList);
              }
              return item;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase updateChecklistTopic failed, falling back:', err);
      }
    }

    try {
      const res = await fetch(`/api/subjects/${subjectId}/units/${unit}/checklist/${checkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle }),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    const sub = localList.find((s) => s.id === subjectId);
    if (!sub) throw new Error('Subject not found');
    const item = sub.units[unit]?.checklist.find((c) => c.id === checkId);
    if (!item) throw new Error('Checklist item not found');
    item.title = cleanTitle;
    saveLocalSubjects(localList);
    return item;
  },

  async deleteChecklistTopic(subjectId: string, unit: number, checkId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: subRow } = await supabase.from('subjects').select('units').eq('id', subjectId).single();
        if (subRow) {
          const units = subRow.units || createDefaultUnits();
          if (units[unit]) {
            units[unit].checklist = units[unit].checklist.filter((c: any) => c.id !== checkId);
            const { error } = await supabase.from('subjects').update({ units }).eq('id', subjectId);
            if (!error) {
              const localList = getLocalSubjects();
              const sub = localList.find((s) => s.id === subjectId);
              if (sub && sub.units[unit]) {
                sub.units[unit].checklist = sub.units[unit].checklist.filter((c) => c.id !== checkId);
                saveLocalSubjects(localList);
              }
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase deleteChecklistTopic failed, falling back:', err);
      }
    }

    try {
      const res = await fetch(`/api/subjects/${subjectId}/units/${unit}/checklist/${checkId}`, {
        method: 'DELETE',
      });
      if (res.ok) return;
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    const sub = localList.find((s) => s.id === subjectId);
    if (sub && sub.units[unit]) {
      sub.units[unit].checklist = sub.units[unit].checklist.filter((c) => c.id !== checkId);
      saveLocalSubjects(localList);
    }
  },

  async addTopicContent(
    subjectId: string,
    unit: number,
    topic: string,
    links: ContentLink[],
    notes?: string,
    userName?: string
  ): Promise<TopicContent> {
    const cleanUser = userName?.trim() || 'Anonymous';
    const newContent: TopicContent = {
      id: 'cnt-' + Date.now(),
      unit,
      topic: topic.trim(),
      links,
      notes: notes?.trim() || undefined,
      createdBy: { name: cleanUser, timestamp: Date.now() },
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: subRow } = await supabase.from('subjects').select('units').eq('id', subjectId).single();
        if (subRow) {
          const units = subRow.units || createDefaultUnits();
          if (!units[unit]) units[unit] = { checklist: [], contents: [] };
          units[unit].contents.push(newContent);

          const { error } = await supabase.from('subjects').update({ units }).eq('id', subjectId);
          if (!error) {
            const localList = getLocalSubjects();
            const sub = localList.find((s) => s.id === subjectId);
            if (sub) {
              if (!sub.units[unit]) sub.units[unit] = { checklist: [], contents: [] };
              sub.units[unit].contents.push(newContent);
              saveLocalSubjects(localList);
            }
            return newContent;
          }
        }
      } catch (err) {
        console.warn('Supabase addTopicContent failed, falling back:', err);
      }
    }

    const payload = { topic, links, notes, userName };
    try {
      const res = await fetch(`/api/subjects/${subjectId}/units/${unit}/contents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    const sub = localList.find((s) => s.id === subjectId);
    if (!sub) throw new Error('Subject not found');
    if (!sub.units[unit]) sub.units[unit] = { checklist: [], contents: [] };

    sub.units[unit].contents.push(newContent);
    saveLocalSubjects(localList);
    return newContent;
  },

  async updateTopicContent(
    subjectId: string,
    unit: number,
    contentId: string,
    topic: string,
    links: ContentLink[],
    notes?: string,
    userName?: string
  ): Promise<TopicContent> {
    const cleanUser = userName?.trim() || 'Anonymous';

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: subRow } = await supabase.from('subjects').select('units').eq('id', subjectId).single();
        if (subRow) {
          const units = subRow.units || createDefaultUnits();
          const cntIndex = units[unit]?.contents.findIndex((c: any) => c.id === contentId);
          if (cntIndex !== undefined && cntIndex !== -1) {
            const prev = units[unit].contents[cntIndex];
            const updated: TopicContent = {
              ...prev,
              topic: topic.trim(),
              links,
              notes: notes !== undefined ? notes.trim() || undefined : prev.notes,
              updatedBy: { name: cleanUser, timestamp: Date.now() },
            };
            units[unit].contents[cntIndex] = updated;
            const { error } = await supabase.from('subjects').update({ units }).eq('id', subjectId);
            if (!error) {
              const localList = getLocalSubjects();
              const sub = localList.find((s) => s.id === subjectId);
              if (sub && sub.units[unit]) {
                const lIdx = sub.units[unit].contents.findIndex((c) => c.id === contentId);
                if (lIdx !== -1) sub.units[unit].contents[lIdx] = updated;
                saveLocalSubjects(localList);
              }
              return updated;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase updateTopicContent failed, falling back:', err);
      }
    }

    const payload = { topic, links, notes, userName };
    try {
      const res = await fetch(`/api/subjects/${subjectId}/units/${unit}/contents/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    const sub = localList.find((s) => s.id === subjectId);
    if (!sub) throw new Error('Subject not found');
    const cnt = sub.units[unit]?.contents.find((c) => c.id === contentId);
    if (!cnt) throw new Error('Content not found');

    cnt.topic = topic.trim();
    cnt.links = links;
    cnt.notes = notes?.trim() || undefined;
    cnt.updatedBy = { name: cleanUser, timestamp: Date.now() };

    saveLocalSubjects(localList);
    return cnt;
  },

  async deleteTopicContent(subjectId: string, unit: number, contentId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: subRow } = await supabase.from('subjects').select('units').eq('id', subjectId).single();
        if (subRow) {
          const units = subRow.units || createDefaultUnits();
          if (units[unit]) {
            units[unit].contents = units[unit].contents.filter((c: any) => c.id !== contentId);
            const { error } = await supabase.from('subjects').update({ units }).eq('id', subjectId);
            if (!error) {
              const localList = getLocalSubjects();
              const sub = localList.find((s) => s.id === subjectId);
              if (sub && sub.units[unit]) {
                sub.units[unit].contents = sub.units[unit].contents.filter((c) => c.id !== contentId);
                saveLocalSubjects(localList);
              }
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase deleteTopicContent failed, falling back:', err);
      }
    }

    try {
      const res = await fetch(`/api/subjects/${subjectId}/units/${unit}/contents/${contentId}`, {
        method: 'DELETE',
      });
      if (res.ok) return;
    } catch {
      // fallback
    }

    const localList = getLocalSubjects();
    const sub = localList.find((s) => s.id === subjectId);
    if (sub && sub.units[unit]) {
      sub.units[unit].contents = sub.units[unit].contents.filter((c) => c.id !== contentId);
      saveLocalSubjects(localList);
    }
  },

  async getMembers(): Promise<CommunityMember[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const [memRes, subRes] = await Promise.all([
          supabase.from('members').select('*'),
          supabase.from('subjects').select('*'),
        ]);

        if (!memRes.error && memRes.data) {
          const map = new Map<string, { name: string; contributions: number; lastActive: number }>();
          memRes.data.forEach((m: any) => {
            map.set(m.name.toLowerCase(), { name: m.name, contributions: 0, lastActive: Number(m.last_active) });
          });

          if (!subRes.error && subRes.data) {
            subRes.data.forEach((sub: any) => {
              const c = sub.created_by?.name;
              if (c) {
                const item = map.get(c.toLowerCase()) || { name: c, contributions: 0, lastActive: sub.created_by.timestamp };
                item.contributions += 1;
                map.set(c.toLowerCase(), item);
              }
              const units = sub.units || {};
              for (let u = 1; u <= 5; u++) {
                units[u]?.contents?.forEach((cnt: any) => {
                  const tc = cnt.createdBy?.name;
                  if (tc) {
                    const item = map.get(tc.toLowerCase()) || { name: tc, contributions: 0, lastActive: cnt.createdBy.timestamp };
                    item.contributions += 1;
                    map.set(tc.toLowerCase(), item);
                  }
                });
              }
            });
          }

          const sorted = Array.from(map.values()).sort((a, b) => b.lastActive - a.lastActive);
          saveLocalMembers(sorted);
          return sorted;
        }
      } catch (err) {
        console.warn('Supabase getMembers failed, falling back:', err);
      }
    }

    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json();
        saveLocalMembers(data);
        return data;
      }
    } catch {
      // fallback
    }
    return getLocalMembers();
  },

  async joinCommunity(userName: string): Promise<void> {
    if (!userName || !userName.trim()) return;
    const clean = userName.trim();
    const now = Date.now();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('members').upsert(
          {
            name: clean,
            last_active: now,
            joined_at: now,
          },
          { onConflict: 'name' }
        );
        return;
      } catch (err) {
        console.warn('Supabase joinCommunity failed, falling back:', err);
      }
    }

    try {
      await fetch('/api/members/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
    } catch {
      // ignore
    }
  },

  async getLogs(): Promise<ActivityLog[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(150);

        if (!error && data) {
          const formatted: ActivityLog[] = data.map((row: any) => ({
            id: row.id,
            userName: row.user_name || row.userName || 'Anonymous',
            action: row.action as LogActionType,
            entityType: row.entity_type || row.entityType,
            details: row.details,
            timestamp: Number(row.timestamp),
          }));
          saveLocalLogs(formatted);
          return formatted;
        }
      } catch (err) {
        console.warn('Supabase getLogs failed, falling back:', err);
      }
    }

    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        saveLocalLogs(data);
        return data;
      }
    } catch {
      // fallback
    }

    return getLocalLogs();
  },

  async addLog(log: {
    userName: string;
    action: LogActionType;
    entityType: 'subject' | 'checklist' | 'content' | 'member';
    details: string;
  }): Promise<ActivityLog> {
    const newLog: ActivityLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userName: log.userName?.trim() || 'Anonymous',
      action: log.action,
      entityType: log.entityType,
      details: log.details,
      timestamp: Date.now(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('activity_logs').insert({
          id: newLog.id,
          user_name: newLog.userName,
          action: newLog.action,
          entity_type: newLog.entityType,
          details: newLog.details,
          timestamp: newLog.timestamp,
        });
      } catch (err) {
        console.warn('Supabase addLog failed:', err);
      }
    }

    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog),
      }).catch(() => {});
    } catch {
      // ignore
    }

    const localList = getLocalLogs();
    localList.unshift(newLog);
    saveLocalLogs(localList);
    return newLog;
  },
};
