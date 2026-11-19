import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL || 'postgres://cms:cms@localhost:5434/keeper' },
})
