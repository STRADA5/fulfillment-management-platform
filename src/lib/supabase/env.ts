const getRequiredPublicEnvironmentVariable = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const getSupabasePublicConfig = () => ({
  url: getRequiredPublicEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: getRequiredPublicEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
});
