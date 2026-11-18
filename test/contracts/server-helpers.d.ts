// The server helpers for plugins: what a plugin's route may call without an import (docs/api-surface.md,
// "Server helpers for plugins"). Frozen from 1.0: useCms() returns at least { db, reg }; requireCmsUser(event)
// returns the signed-in CmsUser or throws (401 signed out, 403 role-removed). Every other helper in
// packages/cms/server/utils is the server's own and may change in any minor. `db` is drizzle's: its type
// follows drizzle-orm. Accept a change with `pnpm contracts:update`.

// packages/cms/server/utils/cmsDb.ts

export function useCms(): {
    db: ReturnType<typeof createCmsDb>;
    reg: CmsRegistry;
};
// what it returns, in full:
//   db: NodePgDatabase<Record<string, unknown>> & { $client: Pool; }
//   reg: CmsRegistry

// packages/cms/server/utils/cmsSession.ts

export interface CmsUser {
    id: string;
    email?: string;
    name?: string;
    role: string;
    locale?: string | null;
}

export function requireCmsUser(event: any): CmsUser;
