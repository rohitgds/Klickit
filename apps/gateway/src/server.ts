import Fastify from "fastify";
import { loadGatewayConfig, type GatewayConfig } from "./config.js";
import {
  createDatabasePool,
  loadClinicBootstrap,
  touchGatewayHeartbeat,
  type ClinicBootstrap,
  type DatabasePoolLike,
} from "./db/client.js";
import {
  createServiceLifecycle,
  markServiceReady,
  markServiceStopping,
  type ServiceLifecycle,
} from "./lifecycle.js";
import { registerGatewayRoutes, type GatewayDependencies } from "./routes/index.js";

export interface BuildServerOptions {
  config?: GatewayConfig;
  lifecycle?: ServiceLifecycle;
  pool?: DatabasePoolLike | null;
  bootstrap?: ClinicBootstrap | null;
  skipDatabase?: boolean;
  /** When false, close() will not call pool.end() — use for integration tests sharing a pool. */
  closePoolOnClose?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}) {
  const config = options.config ?? loadGatewayConfig();
  const lifecycle = options.lifecycle ?? createServiceLifecycle();
  let pool = options.pool ?? null;
  let bootstrap = options.bootstrap ?? null;
  let databaseConnected = false;
  let databaseError: string | undefined;

  if (!options.skipDatabase && pool === null) {
    try {
      pool = await createDatabasePool(config.databaseUrl);
      bootstrap = await loadClinicBootstrap(pool, config);
      databaseConnected = Boolean(bootstrap);
      if (bootstrap) {
        await touchGatewayHeartbeat(pool, bootstrap.gateway.id, config.host);
      } else {
        databaseError = "Clinic bootstrap record not found for configured clinic/gateway codes";
      }
    } catch (error) {
      databaseError = error instanceof Error ? error.message : "Database connection failed";
      if (pool) {
        await pool.end();
      }
      pool = null;
    }
  } else if (pool && bootstrap) {
    databaseConnected = true;
  }

  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  const deps: GatewayDependencies = {
    config,
    lifecycle,
    pool,
    bootstrap,
    databaseConnected,
    databaseError,
  };

  await registerGatewayRoutes(app, deps);

  async function close() {
    markServiceStopping(lifecycle);
    await app.close();
    if (pool && options.closePoolOnClose !== false) {
      await pool.end();
    }
    lifecycle.state = "stopped";
    lifecycle.stoppedAt = new Date().toISOString();
  }

  return { app, config, lifecycle, pool, bootstrap, close };
}

export async function startServer() {
  const built = await buildServer();
  markServiceReady(built.lifecycle);
  await built.app.listen({ port: built.config.port, host: built.config.host });
  return built;
}

export async function stopServer(
  app: Awaited<ReturnType<typeof buildServer>>["app"],
  lifecycle: ServiceLifecycle,
  close?: () => Promise<void>,
) {
  if (close) {
    await close();
    return;
  }
  markServiceStopping(lifecycle);
  await app.close();
  lifecycle.state = "stopped";
  lifecycle.stoppedAt = new Date().toISOString();
}

const entryFile = process.argv[1]?.replace(/\\/g, "/") ?? "";
const isDirectRun = entryFile.endsWith("/server.ts") || entryFile.endsWith("/server.js");

if (isDirectRun) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
