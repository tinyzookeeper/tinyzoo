import type { TemplateDef } from '../../shared/templates'

// Where websites run. The rest of the cloud talks only to this interface: a driver makes the
// infrastructure of a site (a database, storage, a running process with its environment),
// keeps it running, and removes it. What happens inside the site afterwards (demo content,
// accounts, its name) is the cloud's own work and the same for every driver
// (server/utils/provision.ts).

/** The two steps a driver reports while it makes a site. */
export type InfraStep = 'database' | 'start'
export type OnStep = (step: InfraStep, state: 'running' | 'done') => void | Promise<void>

export interface SiteSpec {
  siteId: string
  slug: string
  template: TemplateDef
  /**
   * The site's own environment, decided by the cloud: its app secret, setup code, status token,
   * mail transport, migrations on start. The driver adds what only it knows: the database, the
   * storage, the port and the public address.
   */
  env: Record<string, string>
}

export interface Provisioned {
  /** The address people open. */
  publicUrl: string
  /** The address the cloud itself reaches the site at (the same on a real host). */
  internalUrl: string
  /** Whatever the driver needs to find the site again; stored as it is (sites.driver_state). */
  state: Record<string, unknown>
}

/** A site that exists, as a driver sees it. */
export interface HostedSite extends SiteSpec {
  publicUrl: string | null
  internalUrl: string | null
  state: Record<string, unknown> | null
}

export interface HostingDriver {
  readonly name: string
  /**
   * Infrastructure only: a database, storage, a running site with its environment. Resolves
   * when the site answers /api/health/ready. Safe to call again for the same site (after a
   * failure or a restart): what exists is found and kept.
   */
  provision(spec: SiteSpec, onStep: OnStep): Promise<Provisioned>
  /** Make sure a site that should be up is up (after a restart of the cloud app or of the machine). */
  ensureRunning(site: HostedSite): Promise<void>
  /** Stop the site and remove its data. Safe to call again. */
  remove(site: HostedSite): Promise<void>
  describe(site: HostedSite): Promise<{ running: boolean; memoryBytes?: number }>
  /**
   * What the cloud keeps about the site changed (its state, its own domains, its plan): bring
   * the hosting in line and resolve once that is in effect, with the address people open now.
   * Only a driver that keeps such things outside the site's own process has it (the shared one).
   */
  refresh?(site: HostedSite): Promise<{ publicUrl: string }>
  /** Where the site's data is, for a backup or a restore the cloud runs itself. Never sent anywhere. */
  access?(site: HostedSite): Promise<SiteAccess>
  /** Remove the site's database and files, and keep what makes its address answer (a site that moved away keeps redirecting). */
  removeData?(site: HostedSite): Promise<void>
}

/** A site's own database and files, as the cloud's own tools reach them. */
export interface SiteAccess {
  /** The site's database with the site's own user. */
  databaseUrl: string
  /** The folder its uploads are in. */
  uploadsDir: string
  /** The site's own folder (the uploads are inside it): archives of the site are kept here, outside anything that is served. */
  dir: string
  /** The template's source folder: tinyzoo's command line is run from the packages it resolves. */
  sourceDir: string
  /** The tinyzoo the site runs on. */
  tinyzooVersion: string
}

/**
 * A failure with a reason the pages can put into words. `code` is one of the dictionary's
 * `fail.*` keys; `detail` is for the log and for developers.
 */
export class HostingError extends Error {
  constructor(readonly code: string, readonly detail: string) {
    super(`${code}: ${detail}`)
  }
}
