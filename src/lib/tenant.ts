import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, users } from "@/lib/drizzle/schema";
import { createClient } from "@/lib/supabase/server";

export interface AuthContext {
  authUserId: string;
  email: string;
  name: string;
  tenantId: string;
}

/**
 * Resolve the authenticated session into an app tenant context.
 * Auto-provisions the tenant + user rows on first login so every new
 * signup gets a working workspace without manual setup.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[tenant] supabase auth.getUser error:", authError.message);
      return null;
    }
    if (!user?.email) return null;

    const db = getDb();
    const [existing] = await db.select().from(users).where(eq(users.id, user.id));

    if (existing?.tenantId) {
      return {
        authUserId: existing.id,
        email: existing.email,
        name: existing.name ?? user.email,
        tenantId: existing.tenantId,
      };
    }

    // First login: provision tenant + user.
    const slugBase = user.email
      .split("@")[0]!
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24);
    const slug = `${slugBase}-${user.id.slice(0, 8)}`;

    let tenantId: string;
    const [existingBySlug] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug));

    if (existingBySlug) {
      tenantId = existingBySlug.id;
    } else {
      const [tenant] = await db
        .insert(tenants)
        .values({ name: `${slugBase}'s workspace`, slug })
        .returning();
      if (!tenant) {
        console.error("[tenant] failed to insert tenant");
        return null;
      }
      tenantId = tenant.id;
    }

    if (!existing) {
      await db.insert(users).values({
        id: user.id,
        tenantId,
        email: user.email,
        name:
          (user.user_metadata as { full_name?: string } | null)?.full_name ?? null,
        role: "owner",
      });
    } else {
      await db.update(users).set({ tenantId }).where(eq(users.id, existing.id));
    }

    return { authUserId: user.id, email: user.email, name: user.email, tenantId };
  } catch (err) {
    console.error("[tenant] getAuthContext unexpected error:", err);
    return null;
  }
}
