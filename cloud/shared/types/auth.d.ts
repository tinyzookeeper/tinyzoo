// What the sealed session cookie holds (nuxt-auth-utils): who is signed in.
declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
  }
  interface UserSession {
    /** The account's session version when this session was made (see users.session_version). */
    sv: number
  }
}
export {}
