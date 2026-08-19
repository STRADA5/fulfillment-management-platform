const getRequiredPublicEnvironmentVariable = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const getSupabasePublicConfig = () => ({
  url: getRequiredPublicEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
  publishableKey: getRequiredPublicEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
});
