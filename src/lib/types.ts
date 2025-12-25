export type Clan = {
  id: string;
  name: string;
  slug: string;
  description?: string;
};

export type MembershipRole = "admin" | "member";

export type Membership = {
  clanId: string;
  role: MembershipRole;
};

export type PersonStats = {
  occupation?: string;
  location?: string;
  education?: string;
  tags?: string[];
};

export type Person = {
  id: string;
  clanId: string;
  fullName: string;
  birthDate?: string;
  deathDate?: string;
  isAlive: boolean;
  gender?: string;
  branchRootId: string;
  photoUrl?: string;
  notes?: string;
  stats?: PersonStats;
  createdAt: string;
};

export type Relationship = {
  id: string;
  clanId: string;
  parentId: string;
  childId: string;
  relationshipType: "parent";
};

export type PersonPosition = {
  personId: string;
  clanId: string;
  x: number;
  y: number;
};

export type SuggestionStatus = "pending" | "approved" | "rejected";

export type Suggestion = {
  id: string;
  clanId: string;
  createdAt: string;
  createdBy?: string;
  creatorEmail?: string;
  targetType: "person" | "relationship" | "position";
  targetId?: string;
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  status: SuggestionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
};

export type DiffItem = {
  field: string;
  before?: string;
  after?: string;
};

export type ChangeEvent = {
  id: string;
  clanId: string;
  actorName?: string;
  actorId?: string;
  targetType: "person" | "relationship" | "position";
  targetId?: string;
  action: "create" | "update" | "delete";
  diff: DiffItem[];
  createdAt: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
};

export type AppData = {
  clans: Clan[];
  memberships: Membership[];
  currentUser: UserProfile;
  persons: Person[];
  relationships: Relationship[];
  positions: PersonPosition[];
  suggestions: Suggestion[];
  changeEvents: ChangeEvent[];
};
