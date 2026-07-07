---
name: Supabase embedded relation selects
description: How embedded foreign-table selects return arrays and how to normalize them.
---

**Rule:** Supabase `.select('..., foreign_table(col)')` returns the embedded relation as an array, even for one-to-one relationships.

**Why:** The query syntax is a join. The result shape wraps the foreign row in an array so the same select pattern works consistently for one-to-one and one-to-many relationships. Type casts like `as PendingPost[]` will fail TypeScript checks if the type expects a single object.

**How to apply:**
- After fetching, normalize the embedded array to a single object: `post.profiles?.[0] ?? null`.
- Update the TypeScript type to reflect that the raw select returns an array, or transform the data before casting.
- Use `maybeSingle()` only when selecting directly from the foreign table, not when embedding it inside another select.