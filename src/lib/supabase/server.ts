
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const c = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return c.getAll();
        },

        setAll(
          values: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof c.set>[2];
          }>
        ) {
          try {
            values.forEach(({ name, value, options }) => {
              c.set(name, value, options);
            });
          } catch {
            // Cookie updates may be unavailable in Server Components.
          }
        },
      },
    }
  );
}
