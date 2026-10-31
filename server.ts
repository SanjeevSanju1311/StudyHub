import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'clean_study_store.json');

export interface ChecklistTopic {
  id: string;
  title: string;
  completedBy: string[]; // List of user names who marked as read
}

export interface ContentLink {
  id: string;
  title?: string;
  url: string;
}

export interface TopicContent {
  id: string;
  unit: number; // 1 to 5
  topic: string;
  links: ContentLink[];
  notes?: string;
  createdBy: {
    name: string;
    timestamp: number;
  };
  updatedBy?: {
    name: string;
    timestamp: number;
  };
}

export interface UnitSection {
  checklist: ChecklistTopic[];
  contents: TopicContent[];
}

export interface SimpleSubject {
  id: string;
  name: string;
  semester?: string;
  createdBy: {
    name: string;
    timestamp: number;
  };
  units: Record<number, UnitSection>;
}

export type LogActionType = 'add' | 'edit' | 'delete' | 'view';

export interface ActivityLog {
  id: string;
  userName: string;
  action: LogActionType;
  entityType: 'subject' | 'checklist' | 'content' | 'member';
  details: string;
  timestamp: number;
}

interface StoreData {
  subjects: SimpleSubject[];
  members: Array<{ name: string; joinedAt: number; lastActive: number }>;
  logs: ActivityLog[];
}

function createEmptyUnits(): Record<number, UnitSection> {
  const units: Record<number, UnitSection> = {};
  for (let i = 1; i <= 5; i++) {
    units[i] = { checklist: [], contents: [] };
  }
  return units;
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.subjects)) {
        if (!Array.isArray(parsed.members)) parsed.members = [];
        if (!Array.isArray(parsed.logs)) parsed.logs = [];
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading clean_study_store.json:', err);
  }

  const emptyStore: StoreData = {
    subjects: [],
    members: [],
    logs: [],
  };
  saveStore(emptyStore);
  return emptyStore;
}

function saveStore(store: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing clean_study_store.json:', err);
  }
}

function touchMember(store: StoreData, name: string): boolean {
  if (!name || !name.trim()) return false;
  const clean = name.trim();
  const existing = store.members.find((m) => m.name.toLowerCase() === clean.toLowerCase());
  const now = Date.now();
  if (existing) {
    if (now - existing.lastActive < 5 * 60 * 1000) {
      return false;
    }
    existing.lastActive = now;
    return true;
  } else {
    store.members.push({ name: clean, joinedAt: now, lastActive: now });
    return true;
  }
}

function addServerLog(
  store: StoreData,
  log: {
    userName: string;
    action: LogActionType;
    entityType: 'subject' | 'checklist' | 'content' | 'member';
    details: string;
  }
): ActivityLog {
  const newLog: ActivityLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    userName: log.userName?.trim() || 'Anonymous',
    action: log.action,
    entityType: log.entityType,
    details: log.details,
    timestamp: Date.now(),
  };
  if (!Array.isArray(store.logs)) store.logs = [];
  store.logs.unshift(newLog);
  if (store.logs.length > 300) {
    store.logs = store.logs.slice(0, 300);
  }
  return newLog;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // GET all subjects
  app.get('/api/subjects', (_req: Request, res: Response) => {
    const store = loadStore();
    res.json(store.subjects);
  });

  // GET members
  app.get('/api/members', (_req: Request, res: Response) => {
    const store = loadStore();
    const map = new Map<string, { name: string; contributions: number; lastActive: number }>();

    store.members.forEach((m) => {
      map.set(m.name.toLowerCase(), { name: m.name, contributions: 0, lastActive: m.lastActive });
    });

    store.subjects.forEach((sub) => {
      const c = sub.createdBy?.name;
      if (c) {
        const item = map.get(c.toLowerCase()) || { name: c, contributions: 0, lastActive: sub.createdBy.timestamp };
        item.contributions += 1;
        map.set(c.toLowerCase(), item);
      }
      for (let u = 1; u <= 5; u++) {
        const unit = sub.units?.[u];
        unit?.contents?.forEach((cnt) => {
          const tc = cnt.createdBy?.name;
          if (tc) {
            const item = map.get(tc.toLowerCase()) || { name: tc, contributions: 0, lastActive: cnt.createdBy.timestamp };
            item.contributions += 1;
            map.set(tc.toLowerCase(), item);
          }
        });
      }
    });

    res.json(Array.from(map.values()).sort((a, b) => b.lastActive - a.lastActive));
  });

  // GET activity logs
  app.get('/api/logs', (_req: Request, res: Response) => {
    const store = loadStore();
    res.json(store.logs || []);
  });

  // POST create activity log
  app.post('/api/logs', (req: Request, res: Response) => {
    const { userName, action, entityType, details } = req.body;
    if (!action || !details) return res.status(400).json({ error: 'Missing log fields' });
    const store = loadStore();
    const newLog = addServerLog(store, { userName, action, entityType, details });
    touchMember(store, userName || 'Anonymous');
    saveStore(store);
    res.status(201).json(newLog);
  });

  // POST join community
  app.post('/api/members/join', (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
    const store = loadStore();
    const changed = touchMember(store, name);
    if (changed) {
      saveStore(store);
    }
    res.json({ success: true });
  });

  // POST create subject
  app.post('/api/subjects', (req: Request, res: Response) => {
    const { name, semester, userName } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Subject name required' });

    const store = loadStore();
    const cleanUser = userName?.trim() || 'Anonymous';
    touchMember(store, cleanUser);

    const newSub: SimpleSubject = {
      id: 'sub-' + Date.now(),
      name: name.trim(),
      semester: semester?.trim() || undefined,
      createdBy: { name: cleanUser, timestamp: Date.now() },
      units: createEmptyUnits(),
    };
    store.subjects.push(newSub);
    saveStore(store);
    res.status(201).json(newSub);
  });

  // PUT update subject
  app.put('/api/subjects/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, semester } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Subject name required' });

    const store = loadStore();
    const subject = store.subjects.find((s) => s.id === id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    subject.name = name.trim();
    subject.semester = semester?.trim() || undefined;
    saveStore(store);
    res.json(subject);
  });

  // DELETE subject
  app.delete('/api/subjects/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const store = loadStore();
    store.subjects = store.subjects.filter((s) => s.id !== id);
    saveStore(store);
    res.json({ success: true, id });
  });

  // POST add topic to cover in checklist box
  app.post('/api/subjects/:subjectId/units/:unit/checklist', (req: Request, res: Response) => {
    const { subjectId, unit } = req.params;
    const { title, userName } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

    const store = loadStore();
    const subject = store.subjects.find((s) => s.id === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const unitNum = Number(unit);
    if (!subject.units[unitNum]) subject.units[unitNum] = { checklist: [], contents: [] };

    const newItem: ChecklistTopic = {
      id: 'chk-' + Date.now(),
      title: title.trim(),
      completedBy: [],
    };
    subject.units[unitNum].checklist.push(newItem);
    touchMember(store, userName || 'Anonymous');
    saveStore(store);
    res.status(201).json(newItem);
  });

  // PATCH toggle checklist topic completed/read
  app.patch('/api/subjects/:subjectId/units/:unit/checklist/:checkId/toggle', (req: Request, res: Response) => {
    const { subjectId, unit, checkId } = req.params;
    const { userName } = req.body;
    if (!userName || !userName.trim()) return res.status(400).json({ error: 'Name required' });

    const store = loadStore();
    const subject = store.subjects.find((s) => s.id === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const unitNum = Number(unit);
    const item = subject.units[unitNum]?.checklist.find((c) => c.id === checkId);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });

    if (!Array.isArray(item.completedBy)) item.completedBy = [];
    const cleanUser = userName.trim();
    const idx = item.completedBy.indexOf(cleanUser);
    if (idx > -1) {
      item.completedBy.splice(idx, 1);
    } else {
      item.completedBy.push(cleanUser);
    }

    touchMember(store, cleanUser);
    saveStore(store);
    res.json({ checkId, completedBy: item.completedBy, isCompleted: item.completedBy.includes(cleanUser) });
  });

  // PUT update checklist topic title
  app.put('/api/subjects/:subjectId/units/:unit/checklist/:checkId', (req: Request, res: Response) => {
    const { subjectId, unit, checkId } = req.params;
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

    const store = loadStore();
    const subject = store.subjects.find((s) => s.id === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const unitNum = Number(unit);
    const item = subject.units[unitNum]?.checklist.find((c) => c.id === checkId);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });

    item.title = title.trim();
    saveStore(store);
    res.json(item);
  });

  // DELETE checklist topic
  app.delete('/api/subjects/:subjectId/units/:unit/checklist/:checkId', (req: Request, res: Response) => {
    const { subjectId, unit, checkId } = req.params;
    const store = loadStore();
    const subject = store.subjects.find((s) => s.id === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const unitNum = Number(unit);
    if (subject.units[unitNum]) {
      subject.units[unitNum].checklist = subject.units[unitNum].checklist.filter((c) => c.id !== checkId);
      saveStore(store);
    }
    res.json({ success: true, checkId });
  });

  // POST add topic content & links below the checklist box
  app.post('/api/subjects/:subjectId/units/:unit/contents', (req: Request, res: Response) => {
    const { subjectId, unit } = req.params;
    const { topic, links, notes, userName } = req.body;
    if (!topic || !topic.trim()) return res.status(400).json({ error: 'Topic title required' });

    const store = loadStore();
    const subject = store.subjects.find((s) => s.id === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const unitNum = Number(unit);
    if (!subject.units[unitNum]) subject.units[unitNum] = { checklist: [], contents: [] };

    const cleanUser = userName?.trim() || 'Anonymous';
    touchMember(store, cleanUser);

    const formattedLinks: ContentLink[] = Array.isArray(links)
      ? links
          .filter((l: any) => l && l.url && l.url.trim())
          .map((l: any) => ({
            id: l.id || 'lnk-' + Math.random().toString(36).substring(2, 8),
            title: l.title?.trim() || undefined,
            url: l.url.trim(),
          }))
      : [];

    const newContent: TopicContent = {
      id: 'cnt-' + Date.now(),
      unit: unitNum,
      topic: topic.trim(),
      links: formattedLinks,
      notes: notes?.trim() || undefined,
      createdBy: { name: cleanUser, timestamp: Date.now() },
    };

    subject.units[unitNum].contents.push(newContent);
    saveStore(store);
    res.status(201).json(newContent);
  });

  // PUT update topic content
  app.put('/api/subjects/:subjectId/units/:unit/contents/:contentId', (req: Request, res: Response) => {
    const { subjectId, unit, contentId } = req.params;
    const { topic, links, notes, userName } = req.body;

    const store = loadStore();
    const subject = store.subjects.find((s) => s.id === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const unitNum = Number(unit);
    const contentIndex = subject.units[unitNum]?.contents.findIndex((c) => c.id === contentId);
    if (contentIndex === undefined || contentIndex === -1) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const cleanUser = userName?.trim() || 'Anonymous';
    touchMember(store, cleanUser);

    const prev = subject.units[unitNum].contents[contentIndex];
    const formattedLinks: ContentLink[] = Array.isArray(links)
      ? links
          .filter((l: any) => l && l.url && l.url.trim())
          .map((l: any) => ({
            id: l.id || 'lnk-' + Math.random().toString(36).substring(2, 8),
            title: l.title?.trim() || undefined,
            url: l.url.trim(),
          }))
      : prev.links;

    const updated: TopicContent = {
      ...prev,
      topic: topic ? topic.trim() : prev.topic,
      links: formattedLinks,
      notes: notes !== undefined ? (notes.trim() || undefined) : prev.notes,
      updatedBy: { name: cleanUser, timestamp: Date.now() },
    };

    subject.units[unitNum].contents[contentIndex] = updated;
    saveStore(store);
    res.json(updated);
  });

  // DELETE topic content
  app.delete('/api/subjects/:subjectId/units/:unit/contents/:contentId', (req: Request, res: Response) => {
    const { subjectId, unit, contentId } = req.params;
    const store = loadStore();
    const subject = store.subjects.find((s) => s.id === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const unitNum = Number(unit);
    if (subject.units[unitNum]) {
      subject.units[unitNum].contents = subject.units[unitNum].contents.filter((c) => c.id !== contentId);
      saveStore(store);
    }
    res.json({ success: true, contentId });
  });

  // Vite or static
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/clean_study_store.json', '**/*.json'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n  Clean Study Notes server running:`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://127.0.0.1:${PORT}/\n`);
  });
}

startServer();
