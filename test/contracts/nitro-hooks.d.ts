declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    role: 'admin' | 'editor' | 'author' | (string & {})
    locale: string | null
  }
  interface UserSession {
    cms?: { uid: string; sv: number; iat: number }
  }
}
declare module 'nitropack/types' {
  interface NitroRuntimeHooks {
    /** A content change was saved (see CmsChange). Runs on the instance that saved it. */
    'cms:change': (change: import('tinyzoo').CmsChange) => void | Promise<void>
    /** The sitemap is being built: push entries for addresses that are not entries (see CmsSitemapEntry). Runs at most once a minute. */
    'cms:sitemap': (entries: import('tinyzoo').CmsSitemapEntry[]) => void | Promise<void>
    /** A server error (5xx request, failed scheduled task, webhook that gave up), after the response. See CmsErrorReport. */
    'cms:error': (report: import('tinyzoo').CmsErrorReport) => void | Promise<void>
  }
}
export {}
