"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/supabase/env";

export const createClient = () => {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
};
