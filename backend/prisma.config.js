module.exports = {
  schema: './prisma/schema.prisma',
  datasource: {
    db: {
      adapter: process.env.DATABASE_URL,
    },
  },
};