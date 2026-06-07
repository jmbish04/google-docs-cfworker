type ChatMessage = {
  role?: string;
  parts?: Array<{
    type?: string;
    text?: string;
  }>;
};

function partText(part: NonNullable<ChatMessage["parts"]>[number]): string {
  if (part.type === "text") {
    return part.text ?? "";
  }

  return "";
}

export function latestUserText(messages: ChatMessage[]): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  if (!lastUserMessage?.parts) {
    return "";
  }

  return lastUserMessage.parts.map(partText).join("").trim();
}

export function buildDocAssistantReply(prompt: string): string {
  const normalizedPrompt = prompt.toLowerCase();

  if (!prompt) {
    return [
      "Ask me about the Google Workspace MCP server, REST API, OpenAPI docs, or the Cloudflare Agent chat setup.",
      "I can point you to the right route, install command, or tool surface.",
    ].join(" ");
  }

  if (normalizedPrompt.includes("install") || normalizedPrompt.includes("mcp")) {
    return [
      "Install the MCP server by pointing your MCP client at this Worker.",
      "Use /mcp for JSON-RPC over HTTP and /mcp/ws for WebSocket sessions.",
      "The tool surface includes Google Docs structure, batch updates, markdown insertion, content deletion, document creation, Drive search, file metadata, folders, moves, and trash operations.",
    ].join(" ");
  }

  if (normalizedPrompt.includes("openapi") || normalizedPrompt.includes("swagger") || normalizedPrompt.includes("scalar")) {
    return [
      "The API reference is exposed three ways: /openapi.json for the raw OpenAPI document, /scalar for Scalar, and /swagger for Swagger UI.",
      "Use /docs for the product documentation page and /context for a compact machine-readable service map.",
    ].join(" ");
  }

  if (normalizedPrompt.includes("agent") || normalizedPrompt.includes("chat")) {
    return [
      "This assistant is backed by Cloudflare's AIChatAgent class and is routed through /agents/doc-assistant/landing.",
      "The landing page mounts the documented useAgent and useAgentChat hooks from agents/react and @cloudflare/ai-chat/react.",
    ].join(" ");
  }

  return [
    "This Worker exposes a Google Workspace MCP server and REST API for Google Docs, Drive, and Sheets workflows.",
    "Start with /docs for setup details, /mcp for MCP clients, /v1 for REST calls, and /openapi.json for schema-driven integrations.",
  ].join(" ");
}
