import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().default("3330"),
  REPO_FULL_PATH: z.string(),
  REPO_GITHUB_WEBHOOK_SECRET: z.string(),
});
