import React, { useState, useEffect, useMemo } from 'react';
import { SimpleSubject, ChecklistTopic, TopicContent, ContentLink, CommunityMember } from './types';
import { api } from './services/api';
import {
  BookOpen,
  Plus,
  ArrowLeft,
  ExternalLink,
  Edit2,
  Trash2,
  User,
  Users,
  X,
  Check,
  FileText,
  CheckSquare,
  Square,
  ChevronRight,
  ListCheck,
  FolderOpen,
} from 'lucide-react';

const LOCAL_STORAGE_NAME_KEY = 'peerdesk_student_name_v4';

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'recently';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'link';
  }
}

export default function App() {
  // Current user's name
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_NAME_KEY) || '';
  });

  // Navigation
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<number>(1);

  // Data
  const [subjects, setSubjects] = useState<SimpleSubject[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isNamePromptOpen, setIsNamePromptOpen] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [isMembersModalOpen, setIsMembersModalOpen] = useState<boolean>(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState<boolean>(false);
  const [isContentModalOpen, setIsContentModalOpen] = useState<boolean>(false);

  // Subject Form
  const [editingSubject, setEditingSubject] = useState<SimpleSubject | null>(null);
  const [subjectName, setSubjectName] = useState<string>('');
  const [subjectSemester, setSubjectSemester] = useState<string>('Sem 5');

  // Inline "Topic to Cover" checklist input & edit state
  const [newChecklistTitle, setNewChecklistTitle] = useState<string>('');
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistTitle, setEditingChecklistTitle] = useState<string>('');

  // Topic Content Form (Add / Edit)
  const [editingContent, setEditingContent] = useState<TopicContent | null>(null);
  const [contentTopic, setContentTopic] = useState<string>('');
  const [contentNotes, setContentNotes] = useState<string>('');
  const [contentLinks, setContentLinks] = useState<Array<{ id: string; title: string; url: string }>>([
    { id: 'lnk-1', title: '', url: '' },
  ]);

  // Initial load
  useEffect(() => {
    const savedName = localStorage.getItem(LOCAL_STORAGE_NAME_KEY);
    if (!savedName || !savedName.trim()) {
      setIsNamePromptOpen(true);
    } else {
      setUserName(savedName.trim());
      api.joinCommunity(savedName.trim());
    }

    async function loadData() {
      setIsLoading(true);
      try {
        const [subList, memList] = await Promise.all([api.getSubjects(), api.getMembers()]);
        setSubjects(subList);
        setMembers(memList);
      } catch (err) {
        console.error('Failed loading data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Save Name
  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const finalName = nameInput.trim();
    setUserName(finalName);
    localStorage.setItem(LOCAL_STORAGE_NAME_KEY, finalName);
    api.joinCommunity(finalName);
    setIsNamePromptOpen(false);
    api.getMembers().then(setMembers).catch(() => {});
  };

  const handleEditName = () => {
    setNameInput(userName);
    setIsNamePromptOpen(true);
  };

  // Active Subject
  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  // Active Unit Section
  const activeUnitSection = useMemo(() => {
    if (!activeSubject) return { checklist: [], contents: [] };
    const section = activeSubject.units?.[selectedUnit];
    return {
      checklist: section?.checklist || [],
      contents: section?.contents || [],
    };
  }, [activeSubject, selectedUnit]);

  // Open Add Subject
  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setSubjectName('');
    setSubjectSemester('Sem 5');
    setIsAddSubjectOpen(true);
  };

  // Open Edit Subject
  const handleOpenEditSubject = (sub: SimpleSubject, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSubject(sub);
    setSubjectName(sub.name);
    setSubjectSemester(sub.semester || 'Sem 5');
    setIsAddSubjectOpen(true);
  };

  // Save Subject (Create or Edit)
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

    if (editingSubject) {
      const updated = await api.updateSubject(editingSubject.id, subjectName.trim(), subjectSemester.trim());
      setSubjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingSubject(null);
    } else {
      const created = await api.addSubject(subjectName.trim(), subjectSemester.trim(), userName);
      setSubjects((prev) => [...prev, created]);
      setSelectedSubjectId(created.id);
      setSelectedUnit(1);
    }

    setSubjectName('');
    setIsAddSubjectOpen(false);
    api.getMembers().then(setMembers).catch(() => {});
  };

  // Delete Subject
  const handleDeleteSubject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this subject and all its units?')) {
      await api.deleteSubject(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      if (selectedSubjectId === id) {
        setSelectedSubjectId(null);
      }
      api.getMembers().then(setMembers).catch(() => {});
    }
  };

  // Add Topic to Cover (Checklist item)
  const handleAddChecklistTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !newChecklistTitle.trim()) return;

    const created = await api.addChecklistTopic(
      selectedSubjectId,
      selectedUnit,
      newChecklistTitle.trim(),
      userName
    );

    setSubjects((prev) =>
      prev.map((sub) => {
        if (sub.id !== selectedSubjectId) return sub;
        const currentUnit = sub.units[selectedUnit] || { checklist: [], contents: [] };
        return {
          ...sub,
          units: {
            ...sub.units,
            [selectedUnit]: {
              ...currentUnit,
              checklist: [...currentUnit.checklist, created],
            },
          },
        };
      })
    );

    setNewChecklistTitle('');
  };

  // Toggle checklist topic mark as read / complete
  const handleToggleChecklist = async (checkId: string) => {
    if (!selectedSubjectId || !userName) return;

    const res = await api.toggleChecklistTopic(
      selectedSubjectId,
      selectedUnit,
      checkId,
      userName
    );

    setSubjects((prev) =>
      prev.map((sub) => {
        if (sub.id !== selectedSubjectId) return sub;
        const currentUnit = sub.units[selectedUnit] || { checklist: [], contents: [] };
        return {
          ...sub,
          units: {
            ...sub.units,
            [selectedUnit]: {
              ...currentUnit,
              checklist: currentUnit.checklist.map((item) => {
                if (item.id === checkId) {
                  return { ...item, completedBy: res.completedBy };
                }
                return item;
              }),
            },
          },
        };
      })
    );
  };

  // Start editing checklist topic
  const handleStartEditChecklist = (item: ChecklistTopic, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChecklistId(item.id);
    setEditingChecklistTitle(item.title);
  };

  // Save edited checklist topic
  const handleSaveEditChecklist = async (checkId: string) => {
    if (!selectedSubjectId || !editingChecklistTitle.trim()) {
      setEditingChecklistId(null);
      return;
    }
    const updated = await api.updateChecklistTopic(
      selectedSubjectId,
      selectedUnit,
      checkId,
      editingChecklistTitle.trim()
    );
    setSubjects((prev) =>
      prev.map((sub) => {
        if (sub.id !== selectedSubjectId) return sub;
        const currentUnit = sub.units[selectedUnit] || { checklist: [], contents: [] };
        return {
          ...sub,
          units: {
            ...sub.units,
            [selectedUnit]: {
              ...currentUnit,
              checklist: currentUnit.checklist.map((c) =>
                c.id === checkId ? { ...c, title: updated.title } : c
              ),
            },
          },
        };
      })
    );
    setEditingChecklistId(null);
    setEditingChecklistTitle('');
  };

  const handleCancelEditChecklist = () => {
    setEditingChecklistId(null);
    setEditingChecklistTitle('');
  };

  // Delete checklist topic
  const handleDeleteChecklist = async (checkId: string) => {
    if (!selectedSubjectId) return;
    if (window.confirm('Delete this checklist topic?')) {
      await api.deleteChecklistTopic(selectedSubjectId, selectedUnit, checkId);
      setSubjects((prev) =>
        prev.map((sub) => {
          if (sub.id !== selectedSubjectId) return sub;
          const currentUnit = sub.units[selectedUnit] || { checklist: [], contents: [] };
          return {
            ...sub,
            units: {
              ...sub.units,
              [selectedUnit]: {
                ...currentUnit,
                checklist: currentUnit.checklist.filter((item) => item.id !== checkId),
              },
            },
          };
        })
      );
    }
  };

  // Open Add Topic Content Modal
  const handleOpenAddContent = () => {
    setEditingContent(null);
    setContentTopic('');
    setContentNotes('');
    setContentLinks([{ id: 'lnk-' + Date.now(), title: '', url: '' }]);
    setIsContentModalOpen(true);
  };

  // Open Edit Topic Content Modal
  const handleOpenEditContent = (item: TopicContent) => {
    setEditingContent(item);
    setContentTopic(item.topic);
    setContentNotes(item.notes || '');
    if (item.links && item.links.length > 0) {
      setContentLinks(item.links.map((l) => ({ id: l.id, title: l.title || '', url: l.url })));
    } else {
      setContentLinks([{ id: 'lnk-' + Date.now(), title: '', url: '' }]);
    }
    setIsContentModalOpen(true);
  };

  // Dynamic Link Rows
  const handleAddLinkRow = () => {
    setContentLinks((prev) => [
      ...prev,
      { id: 'lnk-' + Date.now() + Math.random().toString(36).substring(2, 5), title: '', url: '' },
    ]);
  };

  const handleUpdateLinkRow = (index: number, field: 'title' | 'url', value: string) => {
    setContentLinks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveLinkRow = (index: number) => {
    setContentLinks((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Topic Content (Create or Update)
  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !contentTopic.trim()) return;

    const validLinks: ContentLink[] = contentLinks
      .filter((l) => l.url && l.url.trim())
      .map((l) => {
        let u = l.url.trim();
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        return {
          id: l.id,
          title: l.title.trim() || undefined,
          url: u,
        };
      });

    if (editingContent) {
      const updated = await api.updateTopicContent(
        selectedSubjectId,
        selectedUnit,
        editingContent.id,
        contentTopic.trim(),
        validLinks,
        contentNotes.trim() || undefined,
        userName
      );

      setSubjects((prev) =>
        prev.map((sub) => {
          if (sub.id !== selectedSubjectId) return sub;
          const currentUnit = sub.units[selectedUnit] || { checklist: [], contents: [] };
          return {
            ...sub,
            units: {
              ...sub.units,
              [selectedUnit]: {
                ...currentUnit,
                contents: currentUnit.contents.map((c) => (c.id === updated.id ? updated : c)),
              },
            },
          };
        })
      );
    } else {
      const created = await api.addTopicContent(
        selectedSubjectId,
        selectedUnit,
        contentTopic.trim(),
        validLinks,
        contentNotes.trim() || undefined,
        userName
      );

      setSubjects((prev) =>
        prev.map((sub) => {
          if (sub.id !== selectedSubjectId) return sub;
          const currentUnit = sub.units[selectedUnit] || { checklist: [], contents: [] };
          return {
            ...sub,
            units: {
              ...sub.units,
              [selectedUnit]: {
                ...currentUnit,
                contents: [...currentUnit.contents, created],
              },
            },
          };
        })
      );
    }

    setIsContentModalOpen(false);
    api.getMembers().then(setMembers).catch(() => {});
  };

  // Delete Topic Content
  const handleDeleteContent = async (contentId: string) => {
    if (!selectedSubjectId) return;
    if (window.confirm('Delete this topic material?')) {
      await api.deleteTopicContent(selectedSubjectId, selectedUnit, contentId);
      setSubjects((prev) =>
        prev.map((sub) => {
          if (sub.id !== selectedSubjectId) return sub;
          const currentUnit = sub.units[selectedUnit] || { checklist: [], contents: [] };
          return {
            ...sub,
            units: {
              ...sub.units,
              [selectedUnit]: {
                ...currentUnit,
                contents: currentUnit.contents.filter((c) => c.id !== contentId),
              },
            },
          };
        })
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
          <div
            onClick={() => setSelectedSubjectId(null)}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-xs">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Study Circle
                </span>
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                  Notes
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden xs:block">
                Unit topics to cover & content links
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                api.getMembers().then(setMembers).catch(() => {});
                setIsMembersModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
              title="See people in community"
            >
              <Users className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">People</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                {members.length}
              </span>
            </button>

            <button
              onClick={handleEditName}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
              title="Click to edit your name"
            >
              <User className="h-3.5 w-3.5 text-indigo-600" />
              <span className="max-w-[80px] sm:max-w-[130px] truncate">
                {userName || 'Set Name'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        {/* VIEW 1: Home - Subject Boxes */}
        {!activeSubject ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Subject Boxes
                </h2>
                <p className="text-xs text-slate-500">
                  Click a subject box to open its units, topics to cover & content links
                </p>
              </div>

              <button
                onClick={handleOpenAddSubject}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-98 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Add Subject</span>
              </button>
            </div>

            {isLoading ? (
              <div className="py-20 text-center text-xs text-slate-400">
                <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading subjects...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Add Subject Box */}
                <div
                  onClick={handleOpenAddSubject}
                  className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/20 p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all min-h-[140px] group"
                >
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-indigo-900">+ Add New Subject</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Anyone can add</span>
                </div>

                {/* Existing Subject Cards */}
                {subjects.map((sub) => {
                  let totalContents = 0;
                  let totalChecklist = 0;
                  for (let i = 1; i <= 5; i++) {
                    totalContents += sub.units?.[i]?.contents?.length || 0;
                    totalChecklist += sub.units?.[i]?.checklist?.length || 0;
                  }

                  return (
                    <div
                      key={sub.id}
                      onClick={() => {
                        setSelectedSubjectId(sub.id);
                        setSelectedUnit(1);
                      }}
                      className="group relative rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between min-h-[140px]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                            {sub.name}
                          </h3>
                          {sub.semester && (
                            <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200/60">
                              {sub.semester}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                          <p>
                            {totalChecklist} {totalChecklist === 1 ? 'topic to cover' : 'topics to cover'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {totalContents} {totalContents === 1 ? 'content link' : 'content links'} shared
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate">
                          By <strong className="text-slate-600">{sub.createdBy.name}</strong>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleOpenEditSubject(sub, e)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                            title="Edit subject"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSubject(sub.id, e)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Delete subject"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: Inside Subject -> Unit View */
          <div className="space-y-4">
            {/* Top Bar with Back Button */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSelectedSubjectId(null)}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs shrink-0"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Subjects</span>
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                      {activeSubject.name}
                    </h2>
                    {activeSubject.semester && (
                      <span className="rounded-md bg-indigo-50 px-2 py-0.2 text-[10px] font-bold text-indigo-700 border border-indigo-100 shrink-0">
                        {activeSubject.semester}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleOpenEditSubject(activeSubject, e)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                      title="Edit subject"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSubject(activeSubject.id, e)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Delete subject"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Created by {activeSubject.createdBy.name}
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenAddContent}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Add Topic Material</span>
              </button>
            </div>

            {/* Unit Switcher Tabs (Unit 1 to 5) */}
            <div className="grid grid-cols-5 gap-1 sm:gap-2">
              {[1, 2, 3, 4, 5].map((u) => {
                const uSection = activeSubject.units?.[u];
                const checkCount = uSection?.checklist?.length || 0;
                const readCount =
                  uSection?.checklist?.filter((c) => c.completedBy && c.completedBy.includes(userName))
                    .length || 0;
                const isAllRead = checkCount > 0 && readCount === checkCount;

                return (
                  <button
                    key={u}
                    onClick={() => setSelectedUnit(u)}
                    className={`flex flex-col sm:flex-row items-center justify-center sm:justify-between rounded-xl px-2 py-2 sm:px-3 text-xs font-semibold transition-all border ${
                      selectedUnit === u
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>Unit {u}</span>
                    <span
                      className={`text-[10px] font-bold rounded-md px-1 py-0.2 mt-0.5 sm:mt-0 ${
                        selectedUnit === u
                          ? 'bg-slate-800 text-slate-200'
                          : isAllRead
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {readCount}/{checkCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ============================================================== */}
            {/* BOX 1: THE DEDICATED "TOPICS TO COVER" CHECKLIST BOX           */}
            {/* "a box in each unit in that box just a note of topics to cover  */}
            {/*  no need any other feature in that box click to mark as read   */}
            {/*  or complete"                                                  */}
            {/* ============================================================== */}
            <div className="rounded-2xl border-2 border-indigo-100 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-50 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <ListCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Unit {selectedUnit} — Topics to Cover
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Click any topic below to mark as read / complete
                    </p>
                  </div>
                </div>

                {activeUnitSection.checklist.length > 0 && (
                  <div className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                    {
                      activeUnitSection.checklist.filter(
                        (c) => c.completedBy && c.completedBy.includes(userName)
                      ).length
                    }{' '}
                    / {activeUnitSection.checklist.length} read
                  </div>
                )}
              </div>

              {/* Quick Add Topic to Cover Input (Inside this Box) */}
              <form onSubmit={handleAddChecklistTopic} className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Type a topic to cover in this unit (e.g. CPU Scheduling)..."
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!newChecklistTitle.trim()}
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-2xs"
                >
                  Add Topic
                </button>
              </form>

              {/* Checklist items list */}
              {activeUnitSection.checklist.length === 0 ? (
                <div className="py-5 text-center text-xs text-slate-400 italic">
                  No topics to cover added yet for Unit {selectedUnit}. Type above to add syllabus topics.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeUnitSection.checklist.map((item) => {
                    const isRead = item.completedBy && item.completedBy.includes(userName);
                    const readByCount = item.completedBy?.length || 0;
                    const isEditing = editingChecklistId === item.id;

                    if (isEditing) {
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-xl bg-white border-2 border-indigo-500 px-3 py-2 text-xs shadow-xs"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingChecklistTitle}
                            onChange={(e) => setEditingChecklistTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEditChecklist(item.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEditChecklist();
                              }
                            }}
                            className="flex-1 bg-transparent text-slate-900 font-semibold focus:outline-hidden text-xs"
                            placeholder="Checklist topic title..."
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditChecklist(item.id)}
                            className="rounded-lg bg-indigo-600 p-1 text-white hover:bg-indigo-700 transition-colors"
                            title="Save changes"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditChecklist}
                            className="rounded-lg bg-slate-100 p-1 text-slate-500 hover:bg-slate-200 transition-colors"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleChecklist(item.id)}
                        className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer select-none border ${
                          isRead
                            ? 'bg-emerald-50/40 border-emerald-200/80'
                            : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          {isRead ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <span
                            className={`font-semibold break-words ${
                              isRead ? 'text-slate-400 line-through' : 'text-slate-800'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isRead && (
                            <span className="rounded-md bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                              ✓ Read
                            </span>
                          )}
                          {readByCount > 0 && !isRead && (
                            <span className="text-[10px] text-slate-400">
                              {readByCount} read
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleStartEditChecklist(item, e)}
                            className="p-1 rounded-md text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            title="Edit topic title"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChecklist(item.id);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Delete topic"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* SECTION 2: TOPIC-WISE CONTENTS (DIRECTLY BELOW THE BOX)         */}
            {/* "below that topic wise contents"                                */}
            {/* ============================================================== */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                    Topic-wise Contents & Study Links ({activeUnitSection.contents.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Shared materials, Drive links, lecture videos, and notes
                  </p>
                </div>

                <button
                  onClick={handleOpenAddContent}
                  className="flex items-center gap-1 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Material</span>
                </button>
              </div>

              {/* Contents List */}
              {activeUnitSection.contents.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
                  <FolderOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-slate-700">
                    No contents or links added in Unit {selectedUnit} yet
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                    Click "Add Topic Material" to attach Google Drive, YouTube, or web links for this unit.
                  </p>
                  <button
                    onClick={handleOpenAddContent}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Upload First Material</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeUnitSection.contents.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      {/* Topic Header & Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          {item.topic}
                        </h4>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditContent(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContent(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content Links Buttons (Multiple Links) */}
                      {item.links && item.links.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.links.map((link) => (
                            <a
                              key={link.id}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 transition-colors shadow-2xs"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-indigo-600" />
                              <span>{link.title || getDomain(link.url)}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Notes / Tips Block */}
                      {item.notes && (
                        <div className="mt-2.5 rounded-xl bg-slate-50/90 p-3 text-xs text-slate-700 border border-slate-100 whitespace-pre-line leading-relaxed">
                          <span className="font-semibold text-slate-900 block mb-0.5">Notes:</span>
                          {item.notes}
                        </div>
                      )}

                      {/* Transparent Contributor Signature */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <div>
                          {item.updatedBy ? (
                            <span>
                              Edited by <strong className="text-slate-600">{item.updatedBy.name}</strong> · {formatRelativeTime(item.updatedBy.timestamp)}
                            </span>
                          ) : (
                            <span>
                              Added by <strong className="text-slate-600">{item.createdBy.name}</strong> · {formatRelativeTime(item.createdBy.timestamp)}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-300">Unit {item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Mandatory Name Prompt on first open */}
      {isNamePromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="text-center mb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 mb-2 font-bold">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Welcome to Study Circle</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter your name to organize units, topics to cover, and share links with friends.
              </p>
            </div>

            <form onSubmit={handleSaveName} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Sanjeev"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <p className="text-[11px] text-slate-400">
                Saved in your browser memory. All your shared topics and links will transparently display your name.
              </p>

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
              >
                Join & Continue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Community Members Modal */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Study Circle Friends</h3>
                  <p className="text-[11px] text-slate-500">{members.length} people active in group</p>
                </div>
              </div>
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {members.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">No members yet.</p>
              ) : (
                members.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-[11px]">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{m.name}</span>
                          {m.name.toLowerCase() === userName.toLowerCase() && (
                            <span className="rounded-md bg-indigo-100 px-1 py-0.2 text-[9px] font-bold text-indigo-700">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {m.contributions} {m.contributions === 1 ? 'item' : 'items'} contributed
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatRelativeTime(m.lastActive)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Add / Edit Subject */}
      {isAddSubjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingSubject ? 'Edit Subject' : 'Add Subject Box'}
              </h3>
              <button
                onClick={() => {
                  setIsAddSubjectOpen(false);
                  setEditingSubject(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Operating Systems"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Semester (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Sem 5"
                  value={subjectSemester}
                  onChange={(e) => setSubjectSemester(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-500">
                {editingSubject ? (
                  <span>Editing subject: <strong className="text-slate-800">{editingSubject.name}</strong></span>
                ) : (
                  <span>Created by: <strong className="text-slate-800">{userName}</strong></span>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {editingSubject ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      handleDeleteSubject(editingSubject.id, e);
                      setIsAddSubjectOpen(false);
                      setEditingSubject(null);
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    Delete Subject
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddSubjectOpen(false);
                      setEditingSubject(null);
                    }}
                    className="rounded-xl px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 font-bold text-white hover:bg-indigo-700 shadow-xs"
                  >
                    {editingSubject ? 'Save Changes' : 'Create Subject'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add / Edit Topic Material with Multiple Links */}
      {isContentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto">
          <div className="my-6 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingContent ? 'Edit Topic Material' : 'Add Topic Material'}
                </h3>
                <p className="text-[11px] text-slate-400">Unit {selectedUnit}</p>
              </div>
              <button
                onClick={() => setIsContentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Topic Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Banker's Algorithm & Deadlock Avoidance"
                  value={contentTopic}
                  onChange={(e) => setContentTopic(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-hidden font-medium"
                />
              </div>

              {/* Multiple Links Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">
                    Content Links (Drive, YouTube, Docs, PDFs)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLinkRow}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Link</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {contentLinks.map((linkRow, idx) => (
                    <div
                      key={linkRow.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Label (e.g. YouTube Video, Drive Notes)"
                          value={linkRow.title}
                          onChange={(e) => handleUpdateLinkRow(idx, 'title', e.target.value)}
                          className="w-1/3 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:outline-hidden text-[11px]"
                        />
                        <input
                          type="url"
                          placeholder="https://drive.google.com/... or https://youtu.be/..."
                          value={linkRow.url}
                          onChange={(e) => handleUpdateLinkRow(idx, 'url', e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:outline-hidden text-[11px]"
                        />
                        {contentLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLinkRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Remove link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes / Tips */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes / Formulas / Key Questions (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary, exam tips, key formulas..."
                  value={contentNotes}
                  onChange={(e) => setContentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-500">
                Transparent signature: <strong className="text-slate-800">{userName}</strong>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {editingContent ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this topic material?')) {
                        handleDeleteContent(editingContent.id);
                        setIsContentModalOpen(false);
                      }
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    Delete Material
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsContentModalOpen(false)}
                    className="rounded-xl px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 font-bold text-white hover:bg-indigo-700 shadow-xs"
                  >
                    {editingContent ? 'Save Changes' : 'Save Material'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
