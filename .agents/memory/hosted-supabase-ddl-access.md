---
name: Hosted Supabase DDL access gap
description: Why the agent could not apply an RLS policy migration to a hosted (non-Replit-managed) Supabase project, and what to do about it.
---

When a project uses an external/hosted Supabase Postgres (not Replit's managed database),
the agent typically only has REST-level credentials (anon/publishable key, service-role
key). Neither can run DDL (`CREATE POLICY`, `ALTER TABLE`, etc.) — the service-role key
bypasses RLS for row-level operations but is not a Postgres superuser session.

**Why:** Supabase's REST/PostgREST layer intentionally has no generic SQL-execution
endpoint. Running DDL requires a real Postgres connection (a `postgres://` URL with a DB
password, e.g. from Dashboard → Settings → Database → Connection string), which is not
part of the standard Supabase API-key set and won't already exist as a secret unless the
user added it themselves.

**How to apply:** When a schema/RLS change is needed on a hosted Supabase project and only
API keys are available, don't guess at a connection string or ask the user to paste a
secret blindly — write the migration SQL to the repo's `supabase/migrations/` for the
record, then ask the user to run it once via the Supabase SQL Editor (Dashboard → SQL
Editor). This is faster and more reliable than chasing DB credentials.
