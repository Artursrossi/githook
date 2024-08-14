import Fastify from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { exec } from "node:child_process";
import crypto from "node:crypto";
import { z } from "zod";

import { errorHandler } from "./error-handler.js";
import { envSchema } from "./env.js";

const app = Fastify({
  logger: true,
  disableRequestLogging: true,
});

envSchema.parse(process.env);

app.register(fastifyRateLimit, {
  global: true,
  max: 1,
  timeWindow: 1000 * 10, // 30 segundos
});

app.setErrorHandler(errorHandler);

/*  Index Route */
app.get("/", async (request, reply) => {
  return reply.status(200).send({
    message: "Github Webhook Listener developed by Artur Schincariol Rossi",
  });
});

/* Hook Listener Route */
const hookParams = z.object({
  env_repo_array_index: z.coerce.number().min(0, "Invalid Index"),
});
app.post("/hook/:env_repo_array_index", async (request, reply) => {
  const githubWebhookSecret = process.env.REPO_GITHUB_WEBHOOK_SECRET;
  const stringifiedPaths = process.env.REPO_FULL_PATH;
  if (!githubWebhookSecret || !stringifiedPaths)
    return reply.status(500).send({ message: "No Env File" });

  /* Authentication Headers */
  const authorization = request.headers["x-hub-signature-256"];
  if (!authorization)
    return reply.status(401).send({ message: "Not Authorized" });
  try {
    const sig = Buffer.from(authorization, "utf8");
    const hmac = crypto.createHmac("sha256", githubWebhookSecret);
    const digest = Buffer.from(
      "sha256" + "=" + hmac.update(JSON.stringify(request.body)).digest("hex"),
      "utf8"
    );
    if (sig.length !== digest.length || !crypto.timingSafeEqual(digest, sig))
      return reply.status(403).send({ message: "Not Authorized" });
  } catch (err) {
    return reply.status(403).send({ message: "Not Authorized" });
  }

  const { env_repo_array_index } = hookParams.parse(request.params);
  const paths = stringifiedPaths.split(",");
  if (env_repo_array_index > paths.length - 1)
    return reply.status(400).send({ message: "Invalid Index" });
  const path = paths[env_repo_array_index];

  /* Execute Shell Commands */
  const shell_command = `cd ${path} && git pull`;
  try {
    exec(shell_command, (error, stdout, stderr) => {
      if (error) {
        reply.log.error({ error });
        return;
      }
      if (stderr) {
        reply.log.error({ stderr });
        return;
      }

      reply.log.info({ stdout });
    });
  } catch (err) {
    return reply.status(500).send({
      message: "An unexpected error occurred executing shell commands",
    });
  }

  return reply
    .status(200)
    .send({ message: "OK", executed_command: shell_command });
});

try {
  await app.listen({
    host: "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3330,
  });
} catch (error) {
  app.log.fatal(error);
  process.exit(1);
}
