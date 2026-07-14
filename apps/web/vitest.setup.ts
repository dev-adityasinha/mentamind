import "@testing-library/jest-dom";

// Provide a test value so getApiBase() in client.ts doesn't throw.
// In production/Vercel this is set via the dashboard.
process.env.NEXT_PUBLIC_API_URL = "http://test.local";

// Also set API_URL for BFF route handler tests.
process.env.API_URL = "http://test.local";
