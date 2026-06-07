/** @jsxImportSource react */
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type AppendMessage,
  type ThreadMessageLike,
  useComposerRuntime,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { ArrowDown, ArrowUp, Bot, Square, User } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

const suggestions = [
  { prompt: "How do I install this MCP server?" },
  { prompt: "Show me the OpenAPI and Scalar routes." },
  { prompt: "Which Google Docs tools are available?" },
];

function messageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function textMessage(role: "assistant" | "user", text: string): ThreadMessageLike {
  return {
    id: messageId(role),
    role,
    createdAt: new Date(),
    content: [{ type: "text", text }],
    ...(role === "assistant"
      ? { status: { type: "complete" as const, reason: "stop" as const } }
      : {}),
  };
}

function messageText(message: AppendMessage): string {
  return message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

async function previewReply(text: string, signal: AbortSignal): Promise<string> {
  const response = await fetch("/assistant/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: text }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Assistant preview failed with ${response.status}`);
  }

  const body = (await response.json()) as { reply?: string };
  return body.reply?.trim() || "I could not generate a preview response.";
}

function AssistantUiRuntimeProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const onNew = useCallback(async (message: AppendMessage) => {
    const input = messageText(message);

    if (!input) {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);

    const userMessage = textMessage("user", input);
    const assistantId = messageId("assistant");
    const pendingAssistant: ThreadMessageLike = {
      id: assistantId,
      role: "assistant",
      createdAt: new Date(),
      content: [{ type: "text", text: "" }],
      status: { type: "running" },
    };

    setMessages((current) => [...current, userMessage, pendingAssistant]);

    try {
      const reply = await previewReply(input, controller.signal);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: [{ type: "text", text: reply }],
                status: { type: "complete" as const, reason: "stop" as const },
              }
            : item
        )
      );
    } catch (error) {
      const cancelled = controller.signal.aborted;
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: [
                  {
                    type: "text",
                    text: cancelled
                      ? "Request cancelled."
                      : "The assistant preview endpoint did not return a response.",
                  },
                ],
                status: {
                  type: "incomplete" as const,
                  reason: cancelled ? ("cancelled" as const) : ("error" as const),
                  error: cancelled ? undefined : String(error),
                },
              }
            : item
        )
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsRunning(false);
    }
  }, []);

  const onCancel = useCallback(async () => {
    abortRef.current?.abort();
  }, []);

  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage: (message) => message,
    isRunning,
    setMessages,
    onNew,
    onCancel,
    suggestions,
    unstable_capabilities: { copy: true },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

function Thread() {
  return (
    <ThreadPrimitive.Root className="aui-thread">
      <ThreadPrimitive.Viewport className="aui-viewport" turnAnchor="top">
        <AuiIf condition={(state) => state.thread.isEmpty}>
          <ThreadWelcome />
        </AuiIf>

        <ThreadPrimitive.Messages>
          {({ message }) => (message.role === "user" ? <UserMessage /> : <AssistantMessage />)}
        </ThreadPrimitive.Messages>

        <ThreadPrimitive.ViewportFooter className="aui-footer">
          <ThreadPrimitive.ScrollToBottom className="aui-scroll-button" aria-label="Scroll to bottom">
            <ArrowDown size={16} aria-hidden="true" />
          </ThreadPrimitive.ScrollToBottom>
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

function ThreadWelcome() {
  return (
    <div className="aui-welcome">
      <div className="aui-avatar assistant" aria-hidden="true">
        <Bot size={18} />
      </div>
      <div>
        <h3>Google Workspace MCP Assistant</h3>
        <p>Ask about MCP installation, OpenAPI routes, Google Docs tools, or the Worker setup.</p>
      </div>
      <PromptSuggestions />
    </div>
  );
}

function PromptSuggestions() {
  const composer = useComposerRuntime();

  return (
    <div className="aui-suggestions">
      {suggestions.map((suggestion) => (
        <button
          className="aui-suggestion"
          key={suggestion.prompt}
          type="button"
          onClick={() => {
            composer.setText(suggestion.prompt);
            composer.send();
          }}
        >
          {suggestion.prompt}
        </button>
      ))}
    </div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="aui-message-row user">
      <div className="aui-message user">
        <MessagePrimitive.Parts />
      </div>
      <div className="aui-avatar user" aria-hidden="true">
        <User size={16} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="aui-message-row assistant">
      <div className="aui-avatar assistant" aria-hidden="true">
        <Bot size={16} />
      </div>
      <div className="aui-message assistant">
        <MessagePrimitive.Parts />
        <AuiIf condition={(state) => state.message.status?.type === "running"}>
          <span className="aui-thinking">Thinking</span>
        </AuiIf>
      </div>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="aui-composer">
      <ComposerPrimitive.Input
        className="aui-input"
        placeholder="Ask how to install the MCP server..."
        submitMode="enter"
        rows={1}
        aria-label="Message"
      />
      <AuiIf condition={(state) => !state.thread.isRunning}>
        <ComposerPrimitive.Send className="aui-send" aria-label="Send message">
          <ArrowUp size={16} aria-hidden="true" />
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel className="aui-send" aria-label="Cancel response">
          <Square size={14} aria-hidden="true" />
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </ComposerPrimitive.Root>
  );
}

function AssistantUiApp() {
  return (
    <AssistantUiRuntimeProvider>
      <Thread />
    </AssistantUiRuntimeProvider>
  );
}

const root = document.getElementById("assistant-root");

if (root) {
  root.dataset.sdk = "assistant-ui-external-store-runtime";
  createRoot(root).render(<AssistantUiApp />);
}
