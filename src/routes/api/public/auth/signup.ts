// POST /api/public/auth/signup
// Used by the Expo app for college-email-only signup.
// Body: { email, password, display_name }
// Server enforces the @ashoka.edu.in (or whichever) domain BEFORE creating the auth user,
// then creates a profile row and grants the default 'student' role.
import { createFileRoute } from "@tanstack/react-router";
import { isCollegeEmail, COLLEGE_EMAIL_DOMAIN } from "@/lib/college";

export const Route = createFileRoute("/api/public/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as
          | { email?: string; password?: string; display_name?: string }
          | null;
        if (!body?.email || !body.password) {
          return new Response("email & password required", { status: 400 });
        }
        if (!isCollegeEmail(body.email)) {
          return Response.json(
            { error: `College email required (@${COLLEGE_EMAIL_DOMAIN})` },
            { status: 400 },
          );
        }
        if (body.password.length < 8) {
          return Response.json({ error: "Password must be 8+ chars" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Create the auth user (auto-confirmed so college students don't wait for email).
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: { display_name: body.display_name ?? null },
        });
        if (createErr || !created.user) {
          return Response.json({ error: createErr?.message ?? "Signup failed" }, { status: 400 });
        }

        // 2. Insert profile (CHECK constraint also enforces domain — defence in depth).
        await supabaseAdmin.from("profiles").insert({
          id: created.user.id,
          email: body.email,
          display_name: body.display_name ?? body.email.split("@")[0],
        });

        // 3. Default role: student.
        await supabaseAdmin.from("user_roles").insert({
          user_id: created.user.id,
          role: "student",
        });

        return Response.json({ ok: true, user_id: created.user.id });
      },
    },
  },
});
