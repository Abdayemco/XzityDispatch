// prisma.config.ts
import { defineConfig } from '@prisma/internals';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    db: {
      adapter: process.env.DATABASE_URL, // expects url in env var
    },
  },
});