import "@testing-library/react";

// Supabase clients read these at call time and throw when missing.
// Tests never reach the network; these only satisfy the guard clauses.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
