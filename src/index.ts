import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import { forwardLogin, forwardToken, handleCallback } from "./auth";
import { buildDocAssistantReply } from "./assistant";
import docs from "./docs/routes";
import { ui } from "./openapi/swagger-ui";
import { serveOpenAPISpec } from "./openapi/spec";
import { serveScalarUI } from "./openapi/scalar";
import { handleMcpRequest } from "./mcp/handler";
import { handleWebSocket } from "./mcp/websocket";
import { mcpTools } from "./mcp/tools";
import { serveDocs, serveLanding } from "./frontend";

const app = new Hono<{ Bindings: CloudflareBindings }>();

export class DocAssistant {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: CloudflareBindings
  ) {}

  async fetch(): Promise<Response> {
    return new Response("DocAssistant is retained for Durable Object compatibility.", {
      status: 410,
    });
  }
}

// Frontend routes
app.get("/", serveLanding);
app.get("/docs", serveDocs);
app.get("/docs/", serveDocs);
app.post("/assistant/preview", async (c) => {
  const body: { message?: string } = await c.req.json<{ message?: string }>().catch(() => ({}));

  return c.json({ reply: buildDocAssistantReply(body.message?.trim() ?? "") });
});

app.get("/context", (c) =>
  c.json({
    service: "google-workspace-mcp",
    runtime: "cloudflare-workers",
    assistant: {
      className: "DocAssistant",
      previewRoute: "/assistant/preview",
      chatSdkRoute: "/agents/doc-assistant/landing",
      client: ["agents/react useAgent", "@cloudflare/ai-chat/react useAgentChat"],
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
    features: ["REST API", "MCP Protocol", "WebSocket"],
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
