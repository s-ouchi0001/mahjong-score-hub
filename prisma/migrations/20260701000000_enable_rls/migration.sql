-- Supabase exposes tables in the public schema through its API roles.
-- This app accesses data through the Next.js server and Prisma, so public
-- Supabase roles should not be able to read or mutate application tables.

ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Player" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Game" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GamePlayer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PointSnapshot" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Store" FROM anon, authenticated;
REVOKE ALL ON TABLE "tables" FROM anon, authenticated;
REVOKE ALL ON TABLE "Player" FROM anon, authenticated;
REVOKE ALL ON TABLE "AppUser" FROM anon, authenticated;
REVOKE ALL ON TABLE "Game" FROM anon, authenticated;
REVOKE ALL ON TABLE "GamePlayer" FROM anon, authenticated;
REVOKE ALL ON TABLE "PointSnapshot" FROM anon, authenticated;
