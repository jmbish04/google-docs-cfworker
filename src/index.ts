import { Hono, type Context } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import { forwardLogin, forwardToken, handleCallback } from "./auth";
import {
  createAssistantThread,
  getAssistantDb,
  getAssistantMessages,
  getAssistantThread,
  listAssistantThreads,
} from "./assistant-store";
import { DocAssistant } from "./doc-assistant-agent";
import docs from "./docs/routes";
import { ui } from "./openapi/swagger-ui";
import { serveOpenAPISpec } from "./openapi/spec";
import { serveScalarUI } from "./openapi/scalar";
import { handleMcpRequest } from "./mcp/handler";
import { handleWebSocket } from "./mcp/websocket";
import { mcpTools } from "./mcp/tools";
import { isWorkerApiKeyAuthorized } from "./secrets";
import { serveDocs, serveLanding } from "./frontend";

const app = new Hono<{ Bindings: CloudflareBindings }>();

function serveWorkerAsset(pathname: string) {
  return (c: Context<{ Bindings: CloudflareBindings }>) => {
    const assetUrl = new URL(c.req.url);
    assetUrl.pathname = pathname;
    return c.env.STATIC_MANIFEST.fetch(new Request(assetUrl, c.req.raw));
  };
}

export { DocAssistant };

async function requireWorkerApiKey(c: Context<{ Bindings: CloudflareBindings }>): Promise<Response | null> {
  try {
    const auth = await isWorkerApiKeyAuthorized(c.req.raw, c.env);

    if (!auth.ok) {
      return c.json({ error: auth.message }, { status: 401 });
    }

    return null;
  } catch (error) {
    return c.json({ error: (error as Error).message }, { status: 500 });
  }
}

function docAssistantStub(env: CloudflareBindings, threadId: string): DurableObjectStub {
  const namespace = (env as unknown as { DOC_ASSISTANT?: DurableObjectNamespace }).DOC_ASSISTANT;

  if (!namespace) {
    throw new Error("DOC_ASSISTANT binding is not configured");
  }

  return namespace.get(namespace.idFromName(threadId));
}

// Frontend routes
app.get("/", serveLanding);
app.get("/docs", serveDocs);
app.get("/docs/", serveDocs);
app.get("/assistant-ui-app.css", serveWorkerAsset("/assistant-ui-app.css"));
app.get("/assistant-ui-app.js", serveWorkerAsset("/assistant-ui-app.js"));
app.get("/favicon.svg", serveWorkerAsset("/favicon.svg"));
app.post("/assistant/preview", (c) =>
  c.json({ error: "Preview mode was replaced by the D1-backed DocAssistant Agent." }, { status: 410 })
);
app.get("/assistant/threads", async (c) => {
  const authResponse = await requireWorkerApiKey(c);

  if (authResponse) {
    return authResponse;
  }

  const threads = await listAssistantThreads(getAssistantDb(c.env));
  return c.json({ threads });
});
app.post("/assistant/threads", async (c) => {
  const authResponse = await requireWorkerApiKey(c);

  if (authResponse) {
    return authResponse;
  }

  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const thread = await createAssistantThread(getAssistantDb(c.env), body.title?.trim() || "New thread");
  return c.json({ thread });
});
app.get("/assistant/threads/:threadId/messages", async (c) => {
  const authResponse = await requireWorkerApiKey(c);

  if (authResponse) {
    return authResponse;
  }

  const threadId = c.req.param("threadId");
  const db = getAssistantDb(c.env);
  const thread = await getAssistantThread(db, threadId);

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  const messages = await getAssistantMessages(db, threadId);
  return c.json({ thread, messages });
});
app.post("/assistant/threads/:threadId/messages", async (c) => {
  const threadId = c.req.param("threadId");
  const stub = docAssistantStub(c.env, threadId);
  return stub.fetch(c.req.raw);
});

app.get("/context", (c) =>
  c.json({
    service: "google-workspace-mcp",
    runtime: "cloudflare-workers",
    assistant: {
      className: "DocAssistant",
      model: c.env.WORKERS_AI_MODEL ?? "@cf/moonshotai/kimi-k2.6",
      auth: "worker_api_key cookie or x-worker-api-key header",
      threadsRoute: "/assistant/threads",
      messagesRoute: "/assistant/threads/{threadId}/messages",
      persistence: "D1 assistant_threads and assistant_messages",
      tools: mcpTools.map((tool) => tool.name),
    },
    docs: {
      product: "/docs",
      openapi: "/openapi.json",
      scalar: "/scalar",
      scaler: "/scaler",
      swagger: "/swagger",
    },
    mcp: {
      http: "/mcp",
      websocket: "/mcp/ws",
      tools: mcpTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    },
  })
);

// Health check endpoint
app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "google-workspace-mcp",
    version: "1.0.0",
    features: ["REST API", "MCP Protocol", "WebSocket", "D1 assistant history", "Workers AI Agent"],
  })
);

// AUTHENTICATION ROUTES
app.get("/auth2/v2/auth", (c) => forwardLogin(c));
app.post("/auth2/token", (c) => forwardToken(c));
app.get("/swagger/oauth2-redirect.html", (c) => handleCallback(c));

// MCP PROTOCOL ROUTES
// JSON-RPC 2.0 endpoint for MCP
app.post("/mcp", handleMcpRequest);

// WebSocket endpoint for MCP
app.get("/mcp/ws", handleWebSocket);

// REST API ROUTES
// Mount the Google Docs REST API routes
app.route("/v1", docs);

// API DOCUMENTATION ROUTES
// Dynamic OpenAPI specification
app.get("/openapi.json", serveOpenAPISpec);

// Swagger UI (legacy support)
app.get("/swagger", ui);
app.get("/swagger/:spec", ui);

// Scalar API Documentation (modern, feature-rich)
app.get("/scaler", serveScalarUI);
app.get("/scalar", serveScalarUI);

// Static files route
app.all("/openapi/*", async (c, next) => {
  try {
    await serveStatic({
      manifest: c.env.STATIC_MANIFEST,
    })(c, next);
  } catch (error) {
    return c.json({ error: "Error serving OpenAPI content" }, 500);
  }
});

app.all("/public/*", async (c, next) => {
  try {
    await serveStatic({
      path: "./public",
      manifest: c.env.STATIC_MANIFEST,
    })(c, next);
  } catch (error) {
    return c.json({ error: "Error serving static content" }, 500);
  }
});

// Export the Hono app
export default app;
