import { loadEnv } from "./load-env";

// Populate process.env from the local .env before any service module that reads
// lib/env.ts is imported.
loadEnv();
