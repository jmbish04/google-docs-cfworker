/** @jsxImportSource react */
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  SuggestionPrimitive,
  Suggestions,
  ThreadPrimitive,
  type AppendMessage,
  type SuggestionConfig,
  type ThreadMessageLike,
  useAui,
  useAuiState,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
} from "@assistant-ui/react-markdown";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  KeyRoundIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareIcon,
} from "lucide-react";
import remarkGfm from "remark-gfm";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type FC,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";

const suggestions: SuggestionConfig[] = [
  {
    title: "Create a new doc",
    label: "Docs",
    prompt: "Create a Google Doc titled Project Notes and add a short outline.",
  },
  {
    title: "Search Drive",
    label: "Drive",
    prompt: "Search my Drive for recently modified planning documents.",
  },
  {
    title: "Edit a document",
    label: "Docs",
    prompt: "Help me update an existing Google Doc with markdown content.",
  },
];

const API_KEY_COOKIE_NAME = "worker_api_key";
const API_KEY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type AssistantThreadSummary = {
  id: string;
  title: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
};

type AssistantMessageRow = {
  id: string;
  threadId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
};

type ThreadListResponse = {
  threads: AssistantThreadSummary[];
};

type ThreadResponse = {
  thread: AssistantThreadSummary;
};

type MessagesResponse = {
  thread: AssistantThreadSummary;
  messages: AssistantMessageRow[];
};

type ApiErrorBody = {
  error?: string;
  messages?: AssistantMessageRow[];
};

class AssistantApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: ApiErrorBody = {}
  ) {
    super(message);
  }
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

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

function cookieValue(name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));

  if (!match) {
    return "";
  }

  try {
    return decodeURIComponent(match[1]);
  } catch (error) {
    return match[1];
  }
}

function hasStoredApiKey(): boolean {
  return cookieValue(API_KEY_COOKIE_NAME).length > 0;
}

function storeApiKeyCookie(value: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${API_KEY_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${API_KEY_COOKIE_MAX_AGE_SECONDS}; SameSite=Strict${secure}`;
}

function clearStoredApiKeyCookie(): void {
  document.cookie = `${API_KEY_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Strict`;
}

function messageText(message: AppendMessage): string {
  return message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function toThreadMessage(message: AssistantMessageRow): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    createdAt: new Date(message.createdAt),
    content: [{ type: "text", text: message.content }],
    ...(message.role === "assistant"
      ? { status: { type: "complete" as const, reason: "stop" as const } }
      : {}),
  };
}

function sortThreads(threads: AssistantThreadSummary[]): AssistantThreadSummary[] {
  return [...threads].sort(
    (first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  );
}

function mergeThread(
  threads: AssistantThreadSummary[],
  thread: AssistantThreadSummary
): AssistantThreadSummary[] {
  return sortThreads([thread, ...threads.filter((item) => item.id !== thread.id)]);
}

async function assistantFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, { ...init, credentials: "same-origin", headers });
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new AssistantApiError(body.error || `Assistant request failed with ${response.status}`, response.status, body);
  }

  return body as T;
}

function AssistantWorkspace() {
  const [apiKeyConfigured, setApiKeyConfigured] = useState(hasStoredApiKey);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [authOpen, setAuthOpen] = useState(() => !hasStoredApiKey());
  const [threads, setThreads] = useState<AssistantThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const suggestionsAui = useAui({ suggestions: Suggestions(suggestions) }, { parent: null });

  const handleAuthError = useCallback((error: unknown) => {
    const message = error instanceof AssistantApiError ? error.message : "";
    const isAuthError =
      error instanceof AssistantApiError &&
      (error.status === 401 || /worker[_\s-]?api[_\s-]?key|WORKER_API_KEY/i.test(message));

    if (isAuthError) {
      clearStoredApiKeyCookie();
      setApiKeyConfigured(false);
      setAuthOpen(true);
      setLoadError(error.message);
      return true;
    }

    return false;
  }, []);

  const createThread = useCallback(async () => {
    if (!apiKeyConfigured) {
      setAuthOpen(true);
      throw new Error("Worker API key required");
    }

    const response = await assistantFetch<ThreadResponse>("/assistant/threads", {
      method: "POST",
      body: JSON.stringify({ title: "New thread" }),
    });

    setThreads((current) => mergeThread(current, response.thread));
    setActiveThreadId(response.thread.id);
    setMessages([]);
    return response.thread;
  }, [apiKeyConfigured]);

  useEffect(() => {
    if (!apiKeyConfigured) {
      return;
    }

    let cancelled = false;

    async function loadThreads() {
      try {
        setLoadError(null);
        const response = await assistantFetch<ThreadListResponse>("/assistant/threads");
        let nextThreads = response.threads;

        if (nextThreads.length === 0) {
          const created = await assistantFetch<ThreadResponse>("/assistant/threads", {
            method: "POST",
            body: JSON.stringify({ title: "New thread" }),
          });
          nextThreads = [created.thread];
        }

        if (!cancelled) {
          setThreads(sortThreads(nextThreads));
          setActiveThreadId((current) => current ?? nextThreads[0]?.id ?? null);
        }
      } catch (error) {
        if (!cancelled && !handleAuthError(error)) {
          setLoadError((error as Error).message);
        }
      }
    }

    void loadThreads();

    return () => {
      cancelled = true;
    };
  }, [apiKeyConfigured, handleAuthError]);

  useEffect(() => {
    if (!apiKeyConfigured || !activeThreadId) {
      setMessages([]);
      return;
    }

    const threadId = activeThreadId;
    let cancelled = false;

    async function loadMessages() {
      try {
        setLoadError(null);
        const response = await assistantFetch<MessagesResponse>(
          `/assistant/threads/${encodeURIComponent(threadId)}/messages`
        );

        if (!cancelled) {
          setThreads((current) => mergeThread(current, response.thread));
          setMessages(response.messages.map(toThreadMessage));
        }
      } catch (error) {
        if (!cancelled && !handleAuthError(error)) {
          setLoadError((error as Error).message);
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeThreadId, apiKeyConfigured, handleAuthError]);

  const onNew = useCallback(async (message: AppendMessage) => {
    const input = messageText(message);

    if (!input) {
      return;
    }

    if (!apiKeyConfigured) {
      setAuthOpen(true);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setLoadError(null);

    let threadId = activeThreadId;

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
      if (!threadId) {
        threadId = (await createThread()).id;
      }

      const response = await assistantFetch<MessagesResponse>(
        `/assistant/threads/${encodeURIComponent(threadId)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ message: input }),
          signal: controller.signal,
        }
      );
      setThreads((current) => mergeThread(current, response.thread));
      setMessages(response.messages.map(toThreadMessage));
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const apiError = error instanceof AssistantApiError ? error : null;

      if (apiError?.body.messages) {
        setMessages(apiError.body.messages.map(toThreadMessage));
      }

      if (handleAuthError(error)) {
        return;
      }

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
                      : (error as Error).message,
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
  }, [activeThreadId, apiKeyConfigured, createThread, handleAuthError]);

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
    unstable_capabilities: { copy: true },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} aui={suggestionsAui}>
      <WorkerApiKeyDialog
        draft={apiKeyDraft}
        open={authOpen}
        setDraft={setApiKeyDraft}
        canClose={apiKeyConfigured}
        onClose={() => {
          if (apiKeyConfigured) {
            setAuthOpen(false);
          }
        }}
        onSubmit={(value) => {
          const trimmed = value.trim();

          if (!trimmed) {
            return;
          }

          storeApiKeyCookie(trimmed);
          setApiKeyConfigured(true);
          setApiKeyDraft("");
          setAuthOpen(false);
        }}
      />
      <div className="aui-app-shell">
        <ThreadSidebar
          activeThreadId={activeThreadId}
          loadError={loadError}
          threads={threads}
          onCreateThread={() => void createThread().catch((error) => setLoadError((error as Error).message))}
          onSelectThread={setActiveThreadId}
        />
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}

function WorkerApiKeyDialog({
  canClose,
  draft,
  open,
  setDraft,
  onClose,
  onSubmit,
}: {
  canClose: boolean;
  draft: string;
  open: boolean;
  setDraft: (value: string) => void;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="aui-auth-backdrop">
      <form
        aria-labelledby="worker-api-key-title"
        aria-modal="true"
        className="aui-auth-dialog"
        role="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(draft);
        }}
      >
        <div className="aui-auth-dialog-header">
          <KeyRoundIcon />
          <div>
            <h2 id="worker-api-key-title">Worker API key</h2>
            <p>Authenticate this browser session to load threads and run Workspace tools.</p>
          </div>
        </div>
        <input
          autoFocus
          className="aui-auth-input"
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="Paste WORKER_API_KEY"
          type="password"
          value={draft}
        />
        <div className="aui-auth-actions">
          {canClose ? (
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={!draft.trim()}>
            Save key
          </Button>
        </div>
      </form>
    </div>
  );
}

function threadTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function ThreadSidebar({
  activeThreadId,
  loadError,
  onCreateThread,
  onSelectThread,
  threads,
}: {
  activeThreadId: string | null;
  loadError: string | null;
  onCreateThread: () => void;
  onSelectThread: (threadId: string) => void;
  threads: AssistantThreadSummary[];
}) {
  return (
    <aside className="aui-thread-sidebar" aria-label="Threads">
      <div className="aui-thread-sidebar-header">
        <div className="aui-thread-sidebar-brand">
          <div className="aui-thread-sidebar-brand-icon">
            <MessageSquareIcon />
          </div>
          <div>
            <strong>assistant-ui</strong>
            <span>DocAssistant</span>
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="aui-thread-list-new"
        onClick={onCreateThread}
      >
        <PlusIcon />
        New Thread
      </Button>
      {loadError ? <div className="aui-thread-sidebar-error">{loadError}</div> : null}
      <div className="aui-thread-list">
        {threads.map((thread) => (
          <button
            className={cn("aui-thread-list-item", thread.id === activeThreadId && "active")}
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            type="button"
          >
            <span>
              <strong>{thread.title}</strong>
              <small>{threadTime(thread.updatedAt)}</small>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "icon" | "sm";
  variant?: "default" | "ghost" | "outline";
}>(({ className, size, variant = "default", ...props }, ref) => (
  <button
    ref={ref}
    className={cn("aui-button", `aui-button-${variant}`, size && `aui-button-${size}`, className)}
    {...props}
  />
));
Button.displayName = "Button";

const TooltipIconButton = forwardRef<HTMLButtonElement, ComponentProps<typeof Button> & {
  side?: "top" | "bottom" | "left" | "right";
  tooltip: string;
}>(({ children, tooltip, side: _side, className, ...props }, ref) => (
  <Button
    ref={ref}
    className={cn("aui-tooltip-icon-button", className)}
    title={tooltip}
    aria-label={props["aria-label"] ?? tooltip}
    {...props}
  >
    {children}
    <span className="aui-sr-only">{tooltip}</span>
  </Button>
));
TooltipIconButton.displayName = "TooltipIconButton";

const MarkdownTextImpl: FC = () => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm]}
    className="aui-md"
    components={markdownComponents}
  />
);
const MarkdownText = memo(MarkdownTextImpl);

const markdownComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => <h1 className={cn("aui-md-h1", className)} {...props} />,
  h2: ({ className, ...props }) => <h2 className={cn("aui-md-h2", className)} {...props} />,
  h3: ({ className, ...props }) => <h3 className={cn("aui-md-h3", className)} {...props} />,
  h4: ({ className, ...props }) => <h4 className={cn("aui-md-h4", className)} {...props} />,
  h5: ({ className, ...props }) => <h5 className={cn("aui-md-h5", className)} {...props} />,
  h6: ({ className, ...props }) => <h6 className={cn("aui-md-h6", className)} {...props} />,
  p: ({ className, ...props }) => <p className={cn("aui-md-p", className)} {...props} />,
  a: ({ className, ...props }) => <a className={cn("aui-md-a", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn("aui-md-blockquote", className)} {...props} />
  ),
  ul: ({ className, ...props }) => <ul className={cn("aui-md-ul", className)} {...props} />,
  ol: ({ className, ...props }) => <ol className={cn("aui-md-ol", className)} {...props} />,
  li: ({ className, ...props }) => <li className={cn("aui-md-li", className)} {...props} />,
  hr: ({ className, ...props }) => <hr className={cn("aui-md-hr", className)} {...props} />,
  table: ({ className, ...props }) => <table className={cn("aui-md-table", className)} {...props} />,
  th: ({ className, ...props }) => <th className={cn("aui-md-th", className)} {...props} />,
  td: ({ className, ...props }) => <td className={cn("aui-md-td", className)} {...props} />,
  tr: ({ className, ...props }) => <tr className={cn("aui-md-tr", className)} {...props} />,
  code: function Code({ className, ...props }) {
    const isBlock = String(className ?? "").includes("language-");
    return <code className={cn(isBlock ? "aui-md-code-block" : "aui-md-code", className)} {...props} />;
  },
  pre: ({ className, ...props }) => <pre className={cn("aui-md-pre", className)} {...props} />,
});

const CodeHeader: FC<CodeHeaderProps> = ({ language }) => {
  return language ? <div className="aui-code-header-root">{language}</div> : null;
};
void CodeHeader;

const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "44rem",
        ["--composer-radius" as string]: "24px",
        ["--composer-padding" as string]: "10px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div className="aui-thread-container mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
          <AuiIf condition={(state) => state.thread.isEmpty}>
            <ThreadWelcome />
          </AuiIf>

          <div data-slot="aui_message-group" className="aui-message-group mb-10 flex flex-col gap-y-8 empty:hidden">
            <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer bg-background sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible rounded-t-(--composer-radius) pb-4 md:pb-6">
            <ThreadScrollToBottom />
            <Composer />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((state) => state.message.role);
  const isEditing = useAuiState((state) => state.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessage />;
};

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      tooltip="Scroll to bottom"
      variant="outline"
      className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
    >
      <ArrowDownIcon />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

const ThreadWelcome: FC = () => (
  <div className="aui-thread-welcome-root my-auto flex grow flex-col">
    <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
      <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
        <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-semibold duration-200">
          Google Workspace MCP Assistant
        </h1>
        <p className="aui-thread-welcome-message-inner aui-thread-welcome-message-muted fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-muted-foreground text-xl delay-75 duration-200">
          Ask the Cloudflare Agent to create, edit, search, and organize Workspace files.
        </p>
      </div>
    </div>
    <ThreadSuggestions />
  </div>
);

const ThreadSuggestions: FC = () => (
  <div className="aui-thread-welcome-suggestions grid w-full gap-2 pb-4 @md:grid-cols-2">
    <ThreadPrimitive.Suggestions>{() => <ThreadSuggestionItem />}</ThreadPrimitive.Suggestions>
  </div>
);

const ThreadSuggestionItem: FC = () => (
  <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 nth-[n+3]:hidden @md:nth-[n+3]:block">
    <SuggestionPrimitive.Trigger send asChild>
      <Button
        variant="ghost"
        className="aui-thread-welcome-suggestion bg-background hover:bg-muted h-auto w-full flex-wrap items-start justify-start gap-1 rounded-3xl border px-4 py-3 text-start text-sm transition-colors @md:flex-col"
      >
        <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1 font-medium" />
        <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 text-muted-foreground empty:hidden" />
      </Button>
    </SuggestionPrimitive.Trigger>
  </div>
);

const Composer: FC = () => (
  <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
    <ComposerPrimitive.AttachmentDropzone asChild>
      <div
        data-slot="aui_composer-shell"
        className="aui-composer-shell bg-background focus-within:border-ring/75 focus-within:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:bg-accent/50 flex w-full flex-col gap-2 rounded-(--composer-radius) border p-(--composer-padding) transition-shadow focus-within:ring-2 data-[dragging=true]:border-dashed"
      >
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="aui-composer-input placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent px-1.75 py-1 text-sm outline-none"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.AttachmentDropzone>
  </ComposerPrimitive.Root>
);

const ComposerAction: FC = () => (
  <div className="aui-composer-action-wrapper relative flex items-center justify-between">
    <ComposerAddAttachment />
    <AuiIf condition={(state) => !state.thread.isRunning}>
      <ComposerPrimitive.Send asChild>
        <TooltipIconButton
          tooltip="Send message"
          side="bottom"
          type="button"
          variant="default"
          size="icon"
          className="aui-composer-send size-8 rounded-full"
          aria-label="Send message"
        >
          <ArrowUpIcon className="aui-composer-send-icon size-4" />
        </TooltipIconButton>
      </ComposerPrimitive.Send>
    </AuiIf>
    <AuiIf condition={(state) => state.thread.isRunning}>
      <ComposerPrimitive.Cancel asChild>
        <Button
          type="button"
          variant="default"
          size="icon"
          className="aui-composer-cancel size-8 rounded-full"
          aria-label="Stop generating"
        >
          <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
        </Button>
      </ComposerPrimitive.Cancel>
    </AuiIf>
  </div>
);

const ComposerAttachments: FC = () => (
  <div className="aui-composer-attachments">
    <ComposerPrimitive.Attachments>{() => <AttachmentTile source="composer" />}</ComposerPrimitive.Attachments>
  </div>
);

const ComposerAddAttachment: FC = () => (
  <ComposerPrimitive.AddAttachment asChild>
    <TooltipIconButton
      tooltip="Add Attachment"
      side="bottom"
      variant="ghost"
      size="icon"
      className="aui-composer-add-attachment size-8 rounded-full"
      aria-label="Add Attachment"
    >
      <PaperclipIcon className="aui-attachment-add-icon" />
    </TooltipIconButton>
  </ComposerPrimitive.AddAttachment>
);

const UserMessageAttachments: FC = () => (
  <div className="aui-user-message-attachments-end">
    <MessagePrimitive.Attachments>{() => <AttachmentTile source="message" />}</MessagePrimitive.Attachments>
  </div>
);

function AttachmentTile({ source }: { source: "composer" | "message" }) {
  return (
    <div className={cn("aui-attachment-root", `aui-attachment-root-${source}`)}>
      <div className="aui-attachment-tile">
        <FileTextIcon className="aui-attachment-tile-fallback-icon" />
        <AttachmentName />
      </div>
    </div>
  );
}

const AttachmentName: FC = () => (
  <span className="aui-attachment-name">
    <MessagePrimitive.AttachmentByIndex index={0} />
  </span>
);

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-2 rounded-md border p-3 text-sm dark:text-red-200">
      <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);

const AssistantMessage: FC = () => {
  const ACTION_BAR_PT = "pt-1.5";
  const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="aui-assistant-message-root fade-in slide-in-from-bottom-1 animate-in relative duration-150"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="aui-assistant-message-content text-foreground px-2 leading-relaxed wrap-break-word [contain-intrinsic-size:auto_24px] [content-visibility:auto]"
      >
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                return <div data-slot="aui_chain-of-thought">{children}</div>;
              case "group-reasoning":
                return (
                  <ReasoningRoot defaultOpen={part.status.type === "running"}>
                    <ReasoningTrigger active={part.status.type === "running"} />
                    <ReasoningContent aria-busy={part.status.type === "running"}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              case "group-tool":
                return (
                  <ToolGroupRoot>
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "text":
                return <MarkdownText />;
              case "reasoning":
                return <ReasoningText>{children}</ReasoningText>;
              case "tool-call":
                return <ToolFallback />;
              case "indicator":
                return (
                  <span className="aui-assistant-message-indicator" aria-label="Assistant is working">
                    {"●"}
                  </span>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn("aui-assistant-message-footer ms-2 flex items-center", ACTION_BAR_HEIGHT)}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    autohide="not-last"
    className="aui-assistant-action-bar-root text-muted-foreground col-start-3 row-start-2 -ms-1 flex gap-1"
  >
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip="Copy">
        <AuiIf condition={(state) => state.message.isCopied}>
          <CheckIcon />
        </AuiIf>
        <AuiIf condition={(state) => !state.message.isCopied}>
          <CopyIcon />
        </AuiIf>
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.Reload asChild>
      <TooltipIconButton tooltip="Refresh">
        <RefreshCwIcon />
      </TooltipIconButton>
    </ActionBarPrimitive.Reload>
    <ActionBarMorePrimitive.Root>
      <ActionBarMorePrimitive.Trigger asChild>
        <TooltipIconButton tooltip="More" className="data-[state=open]:bg-accent">
          <MoreHorizontalIcon />
        </TooltipIconButton>
      </ActionBarMorePrimitive.Trigger>
      <ActionBarMorePrimitive.Content
        side="bottom"
        align="start"
        className="aui-action-bar-more-content bg-popover text-popover-foreground z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-md"
      >
        <ActionBarPrimitive.ExportMarkdown asChild>
          <ActionBarMorePrimitive.Item className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none">
            <DownloadIcon className="aui-action-bar-more-item-icon size-4" />
            Export as Markdown
          </ActionBarMorePrimitive.Item>
        </ActionBarPrimitive.ExportMarkdown>
      </ActionBarMorePrimitive.Content>
    </ActionBarMorePrimitive.Root>
  </ActionBarPrimitive.Root>
);

const UserMessage: FC = () => (
  <MessagePrimitive.Root
    data-slot="aui_user-message-root"
    className="aui-user-message-root fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_60px] [content-visibility:auto] [&:where(>*)]:col-start-2"
    data-role="user"
  >
    <UserMessageAttachments />

    <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
      <div className="aui-user-message-content peer bg-muted text-foreground rounded-2xl px-4 py-2.5 wrap-break-word empty:hidden">
        <MessagePrimitive.Parts />
      </div>
      <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
        <UserActionBar />
      </div>
    </div>

    <BranchPicker
      data-slot="aui_user-branch-picker"
      className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -me-1 justify-end"
    />
  </MessagePrimitive.Root>
);

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    autohide="not-last"
    className="aui-user-action-bar-root flex flex-col items-end"
  >
    <ActionBarPrimitive.Edit asChild>
      <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
        <PencilIcon />
      </TooltipIconButton>
    </ActionBarPrimitive.Edit>
  </ActionBarPrimitive.Root>
);

const EditComposer: FC = () => (
  <MessagePrimitive.Root
    data-slot="aui_edit-composer-wrapper"
    className="aui-edit-composer-wrapper flex flex-col px-2"
  >
    <ComposerPrimitive.Root className="aui-edit-composer-root bg-muted ms-auto flex w-full max-w-[85%] flex-col rounded-2xl">
      <ComposerPrimitive.Input
        className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent p-4 text-sm outline-none"
        autoFocus
      />
      <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button size="sm">Update</Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  </MessagePrimitive.Root>
);

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
        className
      )}
      {...rest}
  >
    <BranchPickerPrimitive.Previous asChild>
      <TooltipIconButton tooltip="Previous">
        <ChevronLeftIcon />
      </TooltipIconButton>
    </BranchPickerPrimitive.Previous>
    <span className="aui-branch-picker-state font-medium">
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <TooltipIconButton tooltip="Next">
        <ChevronRightIcon />
      </TooltipIconButton>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);

function ReasoningRoot({
  children,
  defaultOpen,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="aui-reasoning-root" open={defaultOpen}>
      {children}
    </details>
  );
}

function ReasoningTrigger({ active }: { active?: boolean }) {
  return (
    <summary className="aui-reasoning-trigger">
      <span>Reasoning</span>
      {active ? <span className="aui-reasoning-trigger-shimmer">Reasoning</span> : null}
      <ChevronDownIcon className="aui-reasoning-trigger-chevron" />
    </summary>
  );
}

function ReasoningContent({ children, ...props }: ComponentProps<"div">) {
  return (
    <div className="aui-reasoning-content" {...props}>
      {children}
    </div>
  );
}

function ReasoningText({ children }: { children: ReactNode }) {
  return <div className="aui-reasoning-text">{children}</div>;
}

function ToolGroupRoot({ children }: { children: ReactNode }) {
  return <details className="aui-tool-group-root">{children}</details>;
}

function ToolGroupTrigger({ active, count }: { active?: boolean; count: number }) {
  return (
    <summary className="aui-tool-group-trigger">
      Tool call{count > 1 ? `s (${count})` : ""}
      {active ? " running" : ""}
    </summary>
  );
}

function ToolGroupContent({ children }: { children: ReactNode }) {
  return <div className="aui-tool-group-content">{children}</div>;
}

function ToolFallback() {
  return <div className="aui-tool-fallback">Tool call</div>;
}

function AssistantUiApp() {
  return <AssistantWorkspace />;
}

const root = document.getElementById("assistant-root");

if (root) {
  root.dataset.sdk = "assistant-ui-external-store-runtime";
  createRoot(root).render(<AssistantUiApp />);
}
