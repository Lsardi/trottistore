/**
 * Fail-fast environment variable validation.
 * Call at service startup to crash immediately if required vars are missing.
 */

export interface EnvRequirement {
  name: string;
  required: boolean;
  secret?: boolean; // Don't log the value
}

export function validateEnv(serviceName: string, requirements: EnvRequirement[]): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const req of requirements) {
    const value = process.env[req.name];

    if (req.required && (!value || value.trim() === "")) {
      missing.push(req.name);
    } else if (!req.required && (!value || value.trim() === "")) {
      warnings.push(req.name);
    }
  }

  if (warnings.length > 0) {
    console.warn(`[${serviceName}] Optional env vars not set: ${warnings.join(", ")}`);
  }

  if (missing.length > 0) {
    console.error(`[${serviceName}] FATAL: Missing required env vars: ${missing.join(", ")}`);
    console.error(`[${serviceName}] Service cannot start. Check .env or .env.example.`);
    process.exit(1);
  }

  console.log(`[${serviceName}] Env check passed (${requirements.length} vars checked)`);
}

// Common requirements shared by all services
export const COMMON_ENV: EnvRequirement[] = [
  { name: "DATABASE_URL", required: true, secret: true },
  { name: "REDIS_URL", required: true },
  { name: "JWT_ACCESS_SECRET", required: true, secret: true },
  { name: "NODE_ENV", required: false },
  { name: "BASE_URL", required: false },
];
