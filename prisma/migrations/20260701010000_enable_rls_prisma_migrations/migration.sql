-- Prisma migration history is internal bookkeeping and should not be exposed
-- through Supabase public API roles.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "_prisma_migrations" FROM anon, authenticated;
