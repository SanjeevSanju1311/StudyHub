export interface ChecklistTopic {
  id: string;
  title: string;
  completedBy: string[]; // List of names who marked as read/completed
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

export interface CommunityMember {
  name: string;
  contributions: number;
  lastActive: number;
}
