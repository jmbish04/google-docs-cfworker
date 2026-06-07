# Model Context Protocol (MCP) Integration

This directory contains the implementation of the Model Context Protocol (MCP) for the Google Workspace Worker, enabling AI agents to interact with Google Docs through a standardized protocol.

## Overview

The MCP implementation provides three interfaces for interacting with Google Workspace:

1. **REST API** - Standard HTTP endpoints for Google Docs operations
2. **MCP Protocol** - Model Context Protocol (JSON-RPC 2.0) for AI agents
3. **WebSocket API** - Real-time MCP protocol over WebSocket

## Architecture

```
src/mcp/
├── schemas.ts      # Zod schemas for JSON-RPC 2.0 validation
├── tools.ts        # MCP tool definitions for Google Docs operations
├── handler.ts      # MCP JSON-RPC 2.0 request handler
└── websocket.ts    # WebSocket support for MCP protocol
```

## Available Tools

### 1. google_docs_structure
Inspect the structure of a Google Docs document including content, styles, and metadata.

**Input:**
```json
{
  "documentId": "string"
}
```

### 2. google_docs_batch_update
Apply multiple updates to a Google Docs document in a single operation.

**Input:**
```json
{
  "documentId": "string",
  "requests": [
    {
      "insertText": {
        "text": "Hello, world!",
        "location": { "index": 1 }
      }
    }
  ]
}
```

### 3. google_docs_markdown_insert
Insert markdown-formatted content into a Google Docs document.

**Input:**
```json
{
  "documentId": "string",
  "markdown": "# Hello World\n\nThis is **bold** text."
}
```

### 4. google_docs_delete_content_range
Delete content from a specific range in a Google Docs document.

**Input:**
```json
{
  "documentId": "string",
  "range": {
    "startIndex": 1,
    "endIndex": 100
  }
}
```

### 5. google_docs_create
Create a new Google Docs document.

**Input:**
```json
{
  "title": "My New Document"
}
```

## Usage

### HTTP Endpoint

**POST /mcp**

Send JSON-RPC 2.0 requests to the MCP endpoint:

```bash
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### WebSocket Endpoint

**GET /mcp/ws**

Connect via WebSocket for real-time communication:

```javascript
const ws = new WebSocket('wss://your-worker.workers.dev/mcp/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log(response);
};
```

## MCP Methods

### initialize
Initialize the MCP connection.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": {
      "name": "my-client",
      "version": "1.0.0"
    }
  }
}
```

### tools/list
List all available tools.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "google_docs_structure",
        "description": "Inspect the structure of a Google Docs document...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

### tools/call
Execute a specific tool.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "google_docs_structure",
    "arguments": {
      "documentId": "1s0gTYKvaqW7VHoSQg53Mu43KmA4im0mPGEoReAsmbO4"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{ ... document structure ... }"
      }
    ]
  }
}
```

## Error Handling

The MCP handler follows JSON-RPC 2.0 error codes:

- `-32700` Parse error - Invalid JSON
- `-32600` Invalid Request - The JSON sent is not a valid Request object
- `-32601` Method not found - The method does not exist
- `-32602` Invalid params - Invalid method parameters
- `-32603` Internal error - Internal JSON-RPC error

**Error Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found: invalid_method"
  }
}
```

## Authentication

All MCP requests require a valid Google OAuth2 Bearer token in the Authorization header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

For WebSocket connections, you can include the token in the first message:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "_auth": "YOUR_ACCESS_TOKEN"
}
```

## Testing

Use the interactive API documentation at `/docs` or `/scalar` to test MCP endpoints with OAuth2 authentication.

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Google Docs API Reference](https://developers.google.com/docs/api)
