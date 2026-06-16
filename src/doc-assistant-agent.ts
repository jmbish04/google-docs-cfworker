import { Agent } from "agents";
import {
  getAssistantDb,
  getAssistantMessages,
  insertAssistantMessage,
  recordToolInvocation,
  updateAssistantThreadTitle,
  upsertAssistantThread,
  type AssistantMessage,
} from "./assistant-store";
import { executeWorkspaceTool } from "./mcp/execute";
import { mcpTools } from "./mcp/tools";
import { getGoogleWorkspaceAccessToken } from "./services/google-service-account";
import { isWorkerApiKeyAuthorized } from "./secrets";

type WorkersAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

type WorkersAIToolCall = {
  name: string;
  arguments: Record<string, any>;
};

type WorkersAI = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

type ChatRequestBody = {
  message?: string;
};

const DEFAULT_MODEL = "@cf/moonshotai/kimi-k2.6";

const SYSTEM_PROMPT = [
  "You are the Google Workspace MCP Assistant running inside a Cloudflare Agent.",
  "You can use the hosted MCP tools in this Worker to create, inspect, edit, move, search, and delete Google Docs, Drive files, folders, and Sheets.",
  "Google API calls are made with a service account using domain-wide delegation impersonating justin@126colby.com.",
  "Use tools when a request requires action or current workspace state. Ask for a document, folder, spreadsheet, or file ID only when the request cannot be completed from the information provided.",
  "After tool execution, summarize the result clearly and include document or file URLs when the tool result contains them.",
].join(" ");

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function toolsForWorkersAI() {
  return mcpTools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function modelMessages(history: AssistantMessage[]): WorkersAIMessage[] {
  const messages: WorkersAIMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  for (const message of history.slice(-40)) {
    if (message.role === "user" || message.role === "assistant") {
      messages.push({ role: message.role, content: message.content });
    }
  }

  return messages;
}

function parseArguments(value: unknown): Record<string, any> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch (error) {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function extractToolCalls(response: unknown): WorkersAIToolCall[] {
  const body = response as any;
  const directCalls = body?.tool_calls;
  const choiceCalls = body?.choices?.[0]?.message?.tool_calls;
  const calls = Array.isArray(directCalls) ? directCalls : Array.isArray(choiceCalls) ? choiceCalls : [];

  return calls
    .map((call: any) => ({
      name: call?.name ?? call?.function?.name,
      arguments: parseArguments(call?.arguments ?? call?.function?.arguments),
    }))
    .filter((call: WorkersAIToolCall) => typeof call.name === "string" && call.name.length > 0);
}

function stringifyContentPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }

  if (part && typeof part === "object" && "text" in part) {
    return String((part as { text?: unknown }).text ?? "");
  }

  return "";
}

function extractText(response: unknown): string {
  const body = response as any;
  const content =
    body?.response ??
    body?.result?.response ??
    body?.choices?.[0]?.message?.content ??
    body?.choices?.[0]?.text ??
    body?.text;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content.map(stringifyContentPart).join("").trim();
  }

  return "";
}

function titleFromMessage(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length <= 64 ? singleLine : `${singleLine.slice(0, 61)}...`;
}

function envModel(env: CloudflareBindings): string {
  return ((env as unknown as { WORKERS_AI_MODEL?: string }).WORKERS_AI_MODEL || DEFAULT_MODEL).trim();
}

function envAI(env: CloudflareBindings): WorkersAI {
  const ai = (env as unknown as { AI?: WorkersAI }).AI;

  if (!ai) {
    throw new Error("AI binding is not configured");
  }

  return ai;
}

export class DocAssistant extends Agent<CloudflareBindings> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname.endsWith("/messages")) {
      return this.handleChatMessage(request);
    }

    return super.fetch(request);
  }

  private async handleChatMessage(request: Request): Promise<Response> {
    const auth = await isWorkerApiKeyAuthorized(request, this.env);

    if (!auth.ok) {
      return json({ error: auth.message }, { status: auth.status });
    }

    const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
    const text = body.message?.trim();

    if (!text) {
      return json({ error: "Message is required" }, { status: 400 });
    }

    const db = getAssistantDb(this.env);
    const thread = await upsertAssistantThread(db, this.name);
    const previousMessages = await getAssistantMessages(db, thread.id);

    if (previousMessages.length === 0 || thread.title === "New thread") {
      await updateAssistantThreadTitle(db, thread.id, titleFromMessage(text));
    }

    const userMessage = await insertAssistantMessage(db, {
      threadId: thread.id,
      role: "user",
      content: text,
      parts: [{ type: "text", text }],
      metadata: { source: "assistant-ui" },
    });

    try {
      const assistantText = await this.runAssistant([...previousMessages, userMessage], thread.id);
      const assistantMessage = await insertAssistantMessage(db, {
        threadId: thread.id,
        role: "assistant",
        content: assistantText,
        parts: [{ type: "text", text: assistantText }],
        metadata: { model: envModel(this.env) },
      });
      const messages = await getAssistantMessages(db, thread.id);

      return json({
        thread: await upsertAssistantThread(db, thread.id),
        userMessage,
        assistantMessage,
        messages,
      });
    } catch (error) {
      const message = `The assistant could not complete the request: ${(error as Error).message}`;
      const assistantMessage = await insertAssistantMessage(db, {
        threadId: thread.id,
        role: "assistant",
        content: message,
        parts: [{ type: "text", text: message }],
        metadata: { error: true, model: envModel(this.env) },
      });
      const messages = await getAssistantMessages(db, thread.id);

      return json(
        {
          error: (error as Error).message,
          thread: await upsertAssistantThread(db, thread.id),
          userMessage,
          assistantMessage,
          messages,
        },
        { status: 500 }
      );
    }
  }

  private async runAssistant(history: AssistantMessage[], threadId: string): Promise<string> {
    const ai = envAI(this.env);
    const model = envModel(this.env);
    const tools = toolsForWorkersAI();
    const messages = modelMessages(history);
    const firstResponse = await ai.run(model, {
      messages,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: true,
      max_completion_tokens: 4096,
    });
    const toolCalls = extractToolCalls(firstResponse);

    if (toolCalls.length === 0) {
      return extractText(firstResponse) || "I did not receive a usable response from the model.";
    }

    const googleAccessToken = await getGoogleWorkspaceAccessToken(this.env);
    const toolResultMessages: WorkersAIMessage[] = [
      {
        role: "assistant",
        content: JSON.stringify({ tool_calls: toolCalls }),
      },
    ];

    for (const toolCall of toolCalls.slice(0, 8)) {
      try {
        const content = await executeWorkspaceTool(toolCall.name, toolCall.arguments, googleAccessToken);
        await recordToolInvocation(getAssistantDb(this.env), {
          threadId,
          toolName: toolCall.name,
          arguments: toolCall.arguments,
          result: content,
          status: "complete",
        });
        toolResultMessages.push({
          role: "tool",
          content: JSON.stringify({ name: toolCall.name, content }),
        });
      } catch (error) {
        await recordToolInvocation(getAssistantDb(this.env), {
          threadId,
          toolName: toolCall.name,
          arguments: toolCall.arguments,
          status: "error",
          error: (error as Error).message,
        });
        toolResultMessages.push({
          role: "tool",
          content: JSON.stringify({ name: toolCall.name, error: (error as Error).message }),
        });
      }
    }

    const finalResponse = await ai.run(model, {
      messages: [...messages, ...toolResultMessages],
      tools,
      max_completion_tokens: 4096,
    });

    return extractText(finalResponse) || "The requested tool calls completed, but the model did not return a final summary.";
  }
}
