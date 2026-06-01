# Google Workspace MCP - Cloudflare Worker

A comprehensive Cloudflare Worker implementation that provides **three powerful interfaces** for interacting with Google Workspace (Docs, Drive, Sheets) designed specifically for AI agents and automation tools.

## 🚀 Features

### Triple Interface Architecture

1. **REST API** - Standard HTTP endpoints for Google Docs operations
2. **MCP Protocol** - Model Context Protocol (JSON-RPC 2.0) for AI agents
3. **WebSocket API** - Real-time MCP protocol over WebSocket

### Key Capabilities

- ✅ Full Google Docs API proxy with authentication
- ✅ Model Context Protocol (MCP) support for AI agents
- ✅ WebSocket support for real-time communication
- ✅ Markdown to Google Docs conversion
- ✅ Document structure inspection and manipulation
- ✅ Batch updates with transaction support
- ✅ OAuth2 authentication flow
- ✅ Dynamic OpenAPI 3.1 specification
- ✅ Swagger UI and Scalar API documentation
- ✅ Zod validation for type safety

## 📚 Quick Start

### 1. Setup

```bash
# Clone the repository
git clone <repository-url>
cd google-docs-cfworker

# Install dependencies
npm install

# Configure secrets
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Run locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

### 2. Authentication

The worker uses OAuth2 authentication with Google:

- **Authorization URL**: `https://your-worker.workers.dev/auth2/v2/auth`
- **Token URL**: `https://your-worker.workers.dev/auth2/token`
- **Scope**: `https://www.googleapis.com/auth/drive`

### 3. API Documentation

Access the interactive API documentation:

- **Scalar UI** (recommended): `https://your-worker.workers.dev/docs`
- **Swagger UI**: `https://your-worker.workers.dev/swagger/public.yaml`
- **OpenAPI Spec**: `https://your-worker.workers.dev/openapi.json`

## 🔧 API Endpoints

### REST API

#### Document Operations

```bash
# Get document structure
GET /v1/documents/{documentId}/structure

# Apply batch updates
POST /v1/documents/{documentId}/batchUpdate

# Insert markdown content
POST /v1/documents/{documentId}/markdown/insert

# Delete content range
POST /v1/documents/{documentId}/deleteContentRangeRequest
```

### MCP Protocol

#### HTTP Endpoint

```bash
# List available tools
POST /mcp
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

# Execute a tool
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "google_docs_structure",
    "arguments": {
      "documentId": "YOUR_DOC_ID"
    }
  }
}
```

#### WebSocket Endpoint

```javascript
const ws = new WebSocket('wss://your-worker.workers.dev/mcp/ws');

ws.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list'
}));
```

## 🛠️ Available MCP Tools

1. **google_docs_structure** - Inspect document structure
2. **google_docs_batch_update** - Apply multiple updates
3. **google_docs_markdown_insert** - Insert markdown content
4. **google_docs_delete_content_range** - Delete content ranges
5. **google_docs_create** - Create new documents

See [MCP Documentation](src/mcp/README.md) for detailed usage.

## 🏗️ Architecture

```
src/
├── index.ts              # Main Hono router
├── auth.ts               # OAuth2 authentication
├── docs/
│   ├── routes.ts         # REST API routes
│   └── apis/             # API implementations
├── mcp/
│   ├── schemas.ts        # JSON-RPC 2.0 schemas
│   ├── tools.ts          # MCP tool definitions
│   ├── handler.ts        # MCP request handler
│   └── websocket.ts      # WebSocket support
├── openapi/
│   ├── spec.ts           # Dynamic OpenAPI generator
│   ├── scalar.ts         # Scalar UI
│   └── swagger-ui.ts     # Swagger UI
└── utils/                # Utility functions
```

## 📖 Examples

### Create a Document with Markdown

```bash
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "google_docs_create",
      "arguments": {
        "title": "My New Document"
      }
    }
  }'
```

### Insert Markdown Content

```bash
curl -X POST https://your-worker.workers.dev/v1/documents/{docId}/markdown/insert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "markdown": "IyBIZWxsbyBXb3JsZAoKVGhpcyBpcyAqKmJvbGQqKiB0ZXh0Lg=="
  }'
```

## 🔐 Environment Variables

Configure these secrets using Wrangler:

```bash
# Required
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run in development mode
npm run dev
```

## 📦 Deployment

```bash
# Deploy to production
npm run deploy

# Deploy with minification
npm run deploy
```

## 🤝 Contributing

Contributions are welcome! Please see the [contributing guidelines](CONTRIBUTING.md) for more information.

## 📄 License

Apache 2.0 - See LICENSE file for details.

## 🔗 Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Google Docs API](https://developers.google.com/docs/api)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)

