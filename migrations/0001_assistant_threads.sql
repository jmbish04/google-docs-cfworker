CREATE TABLE IF NOT EXISTS assistant_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New thread',
  agent_name TEXT NOT NULL DEFAULT 'doc-assistant',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL DEFAULT '',
  parts TEXT,
  tool_calls TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assistant_tool_invocations (
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
);

CREATE INDEX IF NOT EXISTS idx_assistant_threads_updated_at
  ON assistant_threads(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_thread_created
  ON assistant_messages(thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_assistant_tool_invocations_thread_created
  ON assistant_tool_invocations(thread_id, created_at ASC);
