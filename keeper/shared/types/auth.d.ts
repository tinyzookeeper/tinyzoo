// What Keeper keeps in the sealed session cookie (nuxt-auth-utils).
declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    workspaceId: string
    workspaceName: string
  }
  interface UserSession {
    /** The account's session version when this session was made (see users.session_version). */
    sv: number
  }
}
export {}
