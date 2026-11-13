// Demo users. Real apps: back this with a DB table + hashed passwords.
export interface DemoUser {
  id: string
  email: string
  password: string
  name: string
  role: 'admin' | 'editor'
}

export const USERS: DemoUser[] = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'admin@demo.test', password: 'admin', name: 'Admin User', role: 'admin' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'editor@demo.test', password: 'editor', name: 'Edie Editor', role: 'editor' },
]

export function findUser(email: string, password: string): DemoUser | undefined {
  return USERS.find((u) => u.email === email && u.password === password)
}
