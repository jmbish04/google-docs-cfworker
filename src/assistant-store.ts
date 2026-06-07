export type AssistantRole = "system" | "user" | "assistant" | "tool";

export type AssistantThread = {
  id: string;
  title: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
};

export type AssistantMessage = {
  id: string;
  threadId: string;
  role: AssistantRole;
  content: string;
  parts: unknown | null;
  toolCalls: unknown | null;
  metadata: unknown | null;
  createdAt: string;
};

type ThreadRow = {
  id: string;
  title: string;
  agent_name: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  role: AssistantRole;
  content: string;
  parts: string | null;
  tool_calls: string | null;
  metadata: string | null;
  created_at: string;
};

const initializedDatabases = new WeakSet<object>();

function nowIso(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseJson(value: string | null): unknown | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function stringifyJson(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function toThread(row: ThreadRow): AssistantThread {
  return {
    id: row.id,
    title: row.title,
    agentName: row.agent_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: MessageRow): AssistantMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    content: row.content,
    parts: parseJson(row.parts),
    toolCalls: parseJson(row.tool_calls),
    metadata: parseJson(row.metadata),
    createdAt: row.created_at,
  };
}

export function getAssistantDb(env: CloudflareBindings): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;

  if (!db) {
    throw new Error("DB binding is not configured");
  }

  return db;
}

export async function ensureAssistantTables(db: D1Database): Promise<void> {
  if (initializedDatabases.has(db as object)) {
    return;
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS assistant_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New thread',
        agent_name TEXT NOT NULL DEFAULT 'doc-assistant',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS assistant_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
        content TEXT NOT NULL DEFAULT '',
        parts TEXT,
        tool_calls TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS assistant_tool_invocations (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        message_id TEXT,
        tool_name TEXT NOT NULL,
        arguments TEXT NOT NULL DEFAULT '{}',
        result TEXT,
        status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'error')),
        error TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE
      )`
    )
    .run();
  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_assistant_threads_updated_at ON assistant_threads(updated_at DESC)")
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_assistant_messages_thread_created ON assistant_messages(thread_id, created_at ASC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_assistant_tool_invocations_thread_created ON assistant_tool_invocations(thread_id, created_at ASC)"
    )
    .run();

  initializedDatabases.add(db as object);
}

export async function listAssistantThreads(db: D1Database): Promise<AssistantThread[]> {
  await ensureAssistantTables(db);
  const result = await db
    .prepare(
      "SELECT id, title, agent_name, created_at, updated_at FROM assistant_threads ORDER BY updated_at DESC LIMIT 100"
    )
    .all<ThreadRow>();

  return result.results.map(toThread);
}

export async function getAssistantThread(
  db: D1Database,
  threadId: string
): Promise<AssistantThread | null> {
  await ensureAssistantTables(db);
  const row = await db
    .prepare("SELECT id, title, agent_name, created_at, updated_at FROM assistant_threads WHERE id = ?")
    .bind(threadId)
    .first<ThreadRow>();

  return row ? toThread(row) : null;
}

export async function createAssistantThread(
  db: D1Database,
  title = "New thread"
): Promise<AssistantThread> {
  await ensureAssistantTables(db);
  const timestamp = nowIso();
  const thread: AssistantThread = {
    id: id("thread"),
    title,
    agentName: "doc-assistant",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db
    .prepare(
      "INSERT INTO assistant_threads (id, title, agent_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(thread.id, thread.title, thread.agentName, thread.createdAt, thread.updatedAt)
    .run();

  return thread;
}

export async function upsertAssistantThread(
  db: D1Database,
  threadId: string,
  title = "New thread"
): Promise<AssistantThread> {
  const existing = await getAssistantThread(db, threadId);

  if (existing) {
    return existing;
  }

  await ensureAssistantTables(db);
  const timestamp = nowIso();
  await db
    .prepare(
      "INSERT INTO assistant_threads (id, title, agent_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(threadId, title, "doc-assistant", timestamp, timestamp)
    .run();

  return {
    id: threadId,
    title,
    agentName: "doc-assistant",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function getAssistantMessages(
  db: D1Database,
  threadId: string
): Promise<AssistantMessage[]> {
  await ensureAssistantTables(db);
  const result = await db
    .prepare(
      `SELECT id, thread_id, role, content, parts, tool_calls, metadata, created_at
       FROM assistant_messages
       WHERE thread_id = ?
       ORDER BY created_at ASC`
    )
    .bind(threadId)
    .all<MessageRow>();

  return result.results.map(toMessage);
}

export async function insertAssistantMessage(
  db: D1Database,
  input: {
    threadId: string;
    role: AssistantRole;
    content: string;
    id?: string;
    parts?: unknown;
    toolCalls?: unknown;
    metadata?: unknown;
    createdAt?: string;
  }
): Promise<AssistantMessage> {
  await ensureAssistantTables(db);
  const message: AssistantMessage = {
    id: input.id ?? id("message"),
    threadId: input.threadId,
    role: input.role,
    content: input.content,
    parts: input.parts ?? null,
    toolCalls: input.toolCalls ?? null,
    metadata: input.metadata ?? null,
    createdAt: input.createdAt ?? nowIso(),
  };

  await db
    .prepare(
      `INSERT INTO assistant_messages
        (id, thread_id, role, content, parts, tool_calls, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      message.id,
      message.threadId,
      message.role,
      message.content,
      stringifyJson(message.parts),
      stringifyJson(message.toolCalls),
      stringifyJson(message.metadata),
      message.createdAt
    )
    .run();
  await touchAssistantThread(db, message.threadId);

  return message;
}

export async function touchAssistantThread(db: D1Database, threadId: string): Promise<void> {
  await db
    .prepare("UPDATE assistant_threads SET updated_at = ? WHERE id = ?")
    .bind(nowIso(), threadId)
    .run();
}

export async function updateAssistantThreadTitle(
  db: D1Database,
  threadId: string,
  title: string
): Promise<void> {
  await ensureAssistantTables(db);
  await db
    .prepare("UPDATE assistant_threads SET title = ?, updated_at = ? WHERE id = ?")
    .bind(title, nowIso(), threadId)
    .run();
}

export async function recordToolInvocation(
  db: D1Database,
  input: {
    threadId: string;
    messageId?: string;
    toolName: string;
    arguments: unknown;
    result?: unknown;
    status: "complete" | "error";
    error?: string;
  }
): Promise<void> {
  await ensureAssistantTables(db);
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO assistant_tool_invocations
        (id, thread_id, message_id, tool_name, arguments, result, status, error, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id("tool"),
      input.threadId,
      input.messageId ?? null,
      input.toolName,
      stringifyJson(input.arguments) ?? "{}",
      stringifyJson(input.result),
      input.status,
      input.error ?? null,
      timestamp,
      timestamp
    )
    .run();
}
