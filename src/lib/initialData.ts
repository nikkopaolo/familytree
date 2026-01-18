import type { AppData } from "./types";

/**
 * Local/offline starter state.
 * Intentionally contains no people or relationships so you can start clean.
 */
export const initialData: AppData = {
  clans: [
    {
      id: "local-clan-1",
      name: "My Family",
      slug: "my-family",
      description: "Start by adding your first members and relationships.",
    },
  ],
  memberships: [{ clanId: "local-clan-1", role: "admin" }],
  currentUser: {
    id: "local-user",
    name: "Local User",
    email: "",
  },
  persons: [],
  relationships: [],
  positions: [],
  suggestions: [],
  changeEvents: [],
};









