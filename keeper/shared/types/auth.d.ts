// What Keeper keeps in the sealed session cookie (nuxt-auth-utils): who is signed in. Which
// workspace and team they look at is in the address (/w/<workspace>/t/<team>).
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
