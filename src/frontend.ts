import type { Context } from "hono";
import { mcpTools } from "./mcp/tools";

type ActivePage = "home" | "docs";

const navLinks = [
  { href: "/", label: "Assistant" },
  { href: "/docs", label: "Docs" },
  { href: "/health", label: "Health" },
  { href: "/context", label: "Context" },
  { href: "/openapi.json", label: "OpenAPI" },
  { href: "/scaler", label: "Scalar" },
  { href: "/swagger", label: "Swagger" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nav(active: ActivePage): string {
  return navLinks
    .map((link) => {
      const isActive =
        (active === "home" && link.href === "/") || (active === "docs" && link.href === "/docs");

      return `<a class="nav-link${isActive ? " active" : ""}" href="${link.href}">${link.label}</a>`;
    })
    .join("");
}

function shell(title: string, active: ActivePage, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --background: #09090b;
      --foreground: #fafafa;
      --muted: #a1a1aa;
      --muted-foreground: #71717a;
      --card: #111113;
      --card-foreground: #fafafa;
      --popover: #18181b;
      --border: #27272a;
      --input: #27272a;
      --primary: #fafafa;
      --primary-foreground: #18181b;
      --secondary: #18181b;
      --secondary-foreground: #fafafa;
      --accent: #27272a;
      --accent-foreground: #fafafa;
      --ring: #d4d4d8;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--background);
      color: var(--foreground);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    a { color: inherit; text-decoration: none; }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid var(--border);
      background: rgba(9, 9, 11, 0.92);
      backdrop-filter: blur(12px);
    }

    .header-inner {
      width: min(1180px, calc(100vw - 32px));
      min-height: 64px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 190px;
    }

    .brand strong { font-size: 14px; font-weight: 650; }
    .brand span { color: var(--muted); font-size: 12px; }

    .nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }

    .nav-link {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      border-radius: 6px;
      padding: 0 11px;
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .nav-link:hover, .nav-link.active {
      background: var(--accent);
      color: var(--accent-foreground);
    }

    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 34px 0 56px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 0.95fr) minmax(420px, 1.05fr);
      gap: 28px;
      align-items: stretch;
      min-height: calc(100vh - 170px);
    }

    .intro, .panel, .doc-panel {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card);
      color: var(--card-foreground);
    }

    .intro {
      padding: 30px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 32px;
    }

    .eyebrow {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
    }

    h1, h2, h3, p { margin-top: 0; }

    h1 {
      margin-bottom: 16px;
      max-width: 760px;
      font-size: clamp(42px, 7vw, 86px);
      line-height: 0.95;
      font-weight: 760;
    }

    h2 { margin-bottom: 12px; font-size: 28px; line-height: 1.1; }
    h3 { margin-bottom: 8px; font-size: 16px; }

    .lead {
      max-width: 680px;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.7;
    }

    .actions { display: flex; flex-wrap: wrap; gap: 10px; }

    .button {
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      border: 1px solid var(--border);
      padding: 0 14px;
      font-size: 14px;
      font-weight: 600;
    }

    .button.primary {
      border-color: var(--primary);
      background: var(--primary);
      color: var(--primary-foreground);
    }

    .button.secondary {
      background: var(--secondary);
      color: var(--secondary-foreground);
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .metric {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      background: #0c0c0f;
    }

    .metric strong { display: block; font-size: 20px; }
    .metric span { color: var(--muted); font-size: 12px; }

    .panel { min-height: 640px; overflow: hidden; }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      padding: 14px 16px;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
    }

    .status::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #22c55e;
    }

    #assistant-root { min-height: 584px; }

    .chat-shell {
      display: grid;
      grid-template-rows: 1fr auto;
      min-height: 584px;
    }

    .messages {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      overflow: auto;
      max-height: 500px;
    }

    .message {
      width: min(86%, 520px);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 13px;
      background: var(--popover);
      color: var(--foreground);
      line-height: 1.5;
      font-size: 14px;
    }

    .message.user {
      align-self: flex-end;
      background: var(--primary);
      color: var(--primary-foreground);
    }

    .composer {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      border-top: 1px solid var(--border);
      padding: 14px;
    }

    input, textarea {
      width: 100%;
      min-height: 40px;
      border: 1px solid var(--input);
      border-radius: 6px;
      background: #09090b;
      color: var(--foreground);
      padding: 0 12px;
      font: inherit;
    }

    input:focus, textarea:focus {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .doc-layout {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 28px;
      align-items: start;
    }

    .toc {
      position: sticky;
      top: 90px;
      display: grid;
      gap: 6px;
      border-left: 1px solid var(--border);
      padding-left: 14px;
    }

    .toc a { color: var(--muted); font-size: 13px; padding: 5px 0; }
    .toc a:hover { color: var(--foreground); }

    .docs-content {
      display: grid;
      gap: 18px;
    }

    .doc-panel {
      padding: 24px;
      scroll-margin-top: 90px;
    }

    .doc-panel p, .doc-panel li {
      color: var(--muted);
      line-height: 1.65;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .surface {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      background: #0c0c0f;
    }

    code, pre {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 13px;
    }

    code {
      border: 1px solid var(--border);
      border-radius: 5px;
      background: #0c0c0f;
      padding: 2px 5px;
    }

    pre {
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #050507;
      padding: 16px;
      color: #e4e4e7;
    }

    .tools-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .tool-name {
      display: block;
      margin-bottom: 6px;
      font-weight: 650;
      color: var(--foreground);
    }

    @media (max-width: 920px) {
      .header-inner { align-items: flex-start; flex-direction: column; padding: 14px 0; }
      .nav { justify-content: flex-start; }
      .hero, .doc-layout { grid-template-columns: 1fr; }
      .hero { min-height: 0; }
      .toc { position: static; }
      .grid, .tools-list, .metrics { grid-template-columns: 1fr; }
      h1 { font-size: 44px; }
      .panel { min-height: 560px; }
      #assistant-root, .chat-shell { min-height: 504px; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/">
        <strong>Google Workspace MCP</strong>
        <span>Cloudflare Worker</span>
      </a>
      <nav class="nav" aria-label="Primary navigation">${nav(active)}</nav>
    </div>
  </header>
  <main>${body}</main>
  ${script}
</body>
</html>`;
}

function assistantMountScript(): string {
  return `<script type="module">
const root = document.getElementById("assistant-root");
const fallbackReply = async (text) => {
  const response = await fetch("/assistant/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: text })
  });
  return response.json();
};

function textFromParts(message) {
  if (!message?.parts) return "";
  return message.parts.map((part) => part.type === "text" ? part.text : "").join("");
}

function renderFallback(error) {
  const escape = (str) => String(str).replace(/[&<>'" ]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  let messages = [
    { role: "assistant", text: "Ask about MCP installation, OpenAPI routes, Google Docs tools, or the Cloudflare Agent setup." }
  ];

  const paint = () => {
    root.innerHTML =
      '<div class="chat-shell">' +
        '<div class="messages" aria-live="polite">' +
          messages.map((message) => '<div class="message ' + (message.role === "user" ? "user" : "") + '">' + escape(message.text) + '</div>').join("") +
          (error ? '<div class="message">Chat SDK module fallback is active. ' + escape(error) + '</div>' : "") +
        '</div>' +
        '<form class="composer">' +
          '<input name="message" autocomplete="off" placeholder="Ask how to install the MCP server..." />' +
          '<button class="button primary" type="submit">Send</button>' +
        '</form>' +
      '</div>';

    root.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = event.currentTarget.elements.namedItem("message");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      messages = [...messages, { role: "user", text }];
      paint();
      try {
        const { reply } = await fallbackReply(text);
        messages = [...messages, { role: "assistant", text: reply }];
      } catch (err) {
        messages = [...messages, { role: "assistant", text: "Error: Failed to get response from assistant." }];
      }
      paint();
    });
  };

  paint();
}

renderFallback();

const sdkSetup = {
  assistantUi: "@assistant-ui/react",
  assistantRuntime: "@assistant-ui/react-ai-sdk",
  agentClient: "agents/react",
  chatClient: "@cloudflare/ai-chat/react",
  agent: "DocAssistant",
  name: "landing",
};

window.googleWorkspaceAssistantSdkSetup = sdkSetup;

async function loadAssistantUiAgentSdk() {
  try {
    const [assistantUi, assistantRuntime, agentsReact, cloudflareChat] = await Promise.all([
      import("https://esm.sh/@assistant-ui/react?deps=react@19.2.3,react-dom@19.2.3"),
      import("https://esm.sh/@assistant-ui/react-ai-sdk?deps=react@19.2.3,react-dom@19.2.3"),
      import("https://esm.sh/agents@0.14.4/react?deps=react@19.2.3,react-dom@19.2.3"),
      import("https://esm.sh/@cloudflare/ai-chat@0.8.4/react?deps=react@19.2.3,react-dom@19.2.3,agents@0.14.4"),
    ]);

    window.googleWorkspaceAssistantSdkModules = {
      AssistantRuntimeProvider: assistantUi.AssistantRuntimeProvider,
      Thread: assistantUi.Thread,
      useChatRuntime: assistantRuntime.useChatRuntime,
      useAgent: agentsReact.useAgent,
      useAgentChat: cloudflareChat.useAgentChat,
    };
    root.dataset.sdk = "assistant-ui-agents-chat-sdk";
  } catch (error) {
    root.dataset.sdk = "preview-transport";
    console.info("Assistant SDK modules are documented and configured; preview transport remains active.", error);
  }
}

loadAssistantUiAgentSdk();

</script>`;
}

export function serveLanding(c: Context): Response {
  return c.html(
    shell(
      "Google Workspace MCP Assistant",
      "home",
      `<section class="hero">
        <div class="intro">
          <div>
            <p class="eyebrow">Cloudflare Agent interface</p>
            <h1>Google Workspace MCP Assistant</h1>
            <p class="lead">A single Cloudflare Worker for Google Docs automation, Drive operations, REST APIs, OpenAPI reference, and MCP clients. The chat surface bootstraps assistant-ui with Cloudflare Agents SDK and Chat SDK modules, then keeps a deploy-safe local preview transport active until a live Agent binding is attached.</p>
            <div class="actions">
              <a class="button primary" href="/docs">Read docs</a>
              <a class="button secondary" href="/scaler">Open Scalar</a>
              <a class="button secondary" href="/openapi.json">OpenAPI JSON</a>
            </div>
          </div>
          <div class="metrics">
            <div class="metric"><strong>${mcpTools.length}</strong><span>MCP tools</span></div>
            <div class="metric"><strong>3</strong><span>API docs surfaces</span></div>
            <div class="metric"><strong>1</strong><span>Unified Worker</span></div>
          </div>
        </div>
        <div class="panel" aria-label="Assistant chat">
          <div class="panel-header">
            <div>
              <h2>Assistant</h2>
              <p class="eyebrow">assistant-ui + Agents SDK + Chat SDK</p>
            </div>
            <span class="status">DocAssistant</span>
          </div>
          <div id="assistant-root"></div>
        </div>
      </section>`,
      assistantMountScript()
    )
  );
}

export function serveDocs(c: Context): Response {
  const toolCards = mcpTools
    .map(
      (tool) => `<div class="surface">
        <span class="tool-name">${escapeHtml(tool.name)}</span>
        <p>${escapeHtml(tool.description)}</p>
      </div>`
    )
    .join("");

  return c.html(
    shell(
      "Google Workspace MCP Documentation",
      "docs",
      `<div class="doc-layout">
        <aside class="toc" aria-label="Documentation sections">
          <a href="#overview">Overview</a>
          <a href="#assistant">Assistant</a>
          <a href="#mcp">MCP installation</a>
          <a href="#tools">Tools</a>
          <a href="#api">API reference</a>
          <a href="#operations">Operations</a>
        </aside>
        <section class="docs-content">
          <section class="doc-panel" id="overview">
            <p class="eyebrow">Product documentation</p>
            <h1>Google Workspace MCP Server</h1>
            <p class="lead">This Worker exposes Google Docs, Drive, and Sheets operations through an MCP server, WebSocket transport, and REST API. It is designed for agents that need document inspection, markdown insertion, batch edits, Drive search, and schema-driven API access from one Cloudflare deployment.</p>
            <div class="grid">
              <div class="surface"><h3>Primary Worker routes</h3><p><code>/</code>, <code>/docs</code>, <code>/context</code>, <code>/health</code>, <code>/mcp</code>, <code>/mcp/ws</code>, <code>/v1</code></p></div>
              <div class="surface"><h3>Reference routes</h3><p><code>/openapi.json</code>, <code>/scalar</code>, <code>/swagger</code></p></div>
            </div>
          </section>

          <section class="doc-panel" id="assistant">
            <h2>Assistant architecture</h2>
            <p>The Worker retains the <code>DocAssistant</code> class export for Durable Object compatibility. The landing page bootstraps assistant-ui and the Cloudflare client hooks in the browser, while the local preview transport keeps the page usable until a live Agent binding is attached.</p>
            <pre><code>import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { AssistantRuntimeProvider, Thread } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const agent = useAgent({ agent: "DocAssistant", name: "landing" });
const { messages, sendMessage, status } = useAgentChat({ agent });</code></pre>
          </section>

          <section class="doc-panel" id="mcp">
            <h2>MCP installation</h2>
            <p>Point an MCP-compatible client at this Worker. Use the HTTP JSON-RPC endpoint for normal tool calls and the WebSocket endpoint for persistent sessions.</p>
            <pre><code>{
  "mcpServers": {
    "google-docs-cfworker": {
      "url": "https://&lt;your-worker-host&gt;/mcp",
      "transport": "streamable-http"
    }
  }
}</code></pre>
            <p>For WebSocket clients, connect to <code>wss://&lt;your-worker-host&gt;/mcp/ws</code>. Google OAuth is proxied through <code>/auth2/v2/auth</code>, <code>/auth2/token</code>, and <code>/swagger/oauth2-redirect.html</code>.</p>
          </section>

          <section class="doc-panel" id="tools">
            <h2>MCP tools</h2>
            <div class="tools-list">${toolCards}</div>
          </section>

          <section class="doc-panel" id="api">
            <h2>API reference</h2>
            <p>Use <code>/openapi.json</code> for generated clients and validation, <code>/scaler</code> or <code>/scalar</code> for a modern API reference, and <code>/swagger</code> for OAuth-oriented Swagger UI workflows.</p>
            <div class="actions">
              <a class="button primary" href="/openapi.json">Open OpenAPI JSON</a>
              <a class="button secondary" href="/scaler">Open Scalar</a>
              <a class="button secondary" href="/swagger">Open Swagger</a>
            </div>
          </section>

          <section class="doc-panel" id="operations">
            <h2>Operations</h2>
            <p>Deployments run through npm and Wrangler. The deploy script leaves Wrangler output in the build log by disabling Wrangler log-file writes and enabling debug-level console output.</p>
            <pre><code>npm run deploy
npm run cf-typegen
npm test</code></pre>
          </section>
        </section>
      </div>`
    )
  );
}
