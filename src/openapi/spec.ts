// Dynamic OpenAPI Specification Generator
import { Context } from 'hono';
import { mcpTools } from '../mcp/tools';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    license: {
      name: string;
      url: string;
    };
  };
  servers: Array<{ url: string }>;
  security: Array<Record<string, string[]>>;
  components: {
    securitySchemes: Record<string, any>;
    schemas: Record<string, any>;
  };
  paths: Record<string, any>;
}

export function generateOpenAPISpec(c: Context): OpenAPISpec {
  const baseUrl = new URL(c.req.url).origin;

  return {
    openapi: '3.1.0',
    info: {
      title: 'Google Workspace MCP API',
      description: `
This API provides three interfaces for interacting with Google Workspace (Docs, Drive, Sheets):

1. **REST API** - Standard HTTP endpoints for Google Docs operations
2. **MCP Protocol** - Model Context Protocol (JSON-RPC 2.0) for AI agents
3. **WebSocket API** - Real-time MCP protocol over WebSocket

## Available MCP Tools

### Google Docs (5 tools)
- **google_docs_structure** - Inspect document structure
- **google_docs_batch_update** - Apply batch updates
- **google_docs_markdown_insert** - Insert markdown content
- **google_docs_delete_content_range** - Delete content ranges
- **google_docs_create** - Create new documents

### Google Drive (5 tools)
- **google_drive_search** - Search for files with queries
- **google_drive_get_file** - Get file metadata
- **google_drive_create_folder** - Create folders
- **google_drive_move_file** - Move files/folders
- **google_drive_delete_file** - Delete files/folders

### Google Sheets (6 tools)
- **google_sheets_get** - Get spreadsheet metadata
- **google_sheets_get_values** - Get cell values
- **google_sheets_update_values** - Update cell values
- **google_sheets_append_values** - Append rows
- **google_sheets_create** - Create new spreadsheets
- **google_sheets_batch_update** - Apply batch updates

All endpoints require OAuth2 authentication with Google.
      `.trim(),
      version: '1.0.0',
      license: {
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
      },
    },
    servers: [{ url: baseUrl }],
    security: [{ googleOAuth: [] }],
    components: {
      securitySchemes: {
        googleOAuth: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: `${baseUrl}/auth2/v2/auth`,
              tokenUrl: `${baseUrl}/auth2/token`,
              scopes: {
                'https://www.googleapis.com/auth/drive': 'Full access to Google Drive',
              },
            },
          },
        },
      },
      schemas: {
        JsonRpcRequest: {
          type: 'object',
          required: ['jsonrpc', 'method'],
          properties: {
            jsonrpc: {
              type: 'string',
              enum: ['2.0'],
              description: 'JSON-RPC version',
            },
            id: {
              oneOf: [
                { type: 'string' },
                { type: 'number' },
                { type: 'null' },
              ],
              description: 'Request identifier',
            },
            method: {
              type: 'string',
              description: 'Method name (e.g., "tools/list", "tools/call")',
            },
            params: {
              type: 'object',
              description: 'Method parameters',
            },
          },
        },
        JsonRpcResponse: {
          type: 'object',
          required: ['jsonrpc', 'id'],
          properties: {
            jsonrpc: {
              type: 'string',
              enum: ['2.0'],
            },
            id: {
              oneOf: [
                { type: 'string' },
                { type: 'number' },
                { type: 'null' },
              ],
            },
            result: {
              type: 'object',
              description: 'Result object (present on success)',
            },
            error: {
              type: 'object',
              description: 'Error object (present on failure)',
              properties: {
                code: { type: 'number' },
                message: { type: 'string' },
                data: { type: 'object' },
              },
            },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check endpoint',
          description: 'Returns the service health status',
          operationId: 'health_check',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      service: { type: 'string', example: 'google-workspace-mcp' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/mcp': {
        post: {
          summary: 'MCP JSON-RPC 2.0 Endpoint',
          description: `
Model Context Protocol endpoint for AI agents. Supports the following methods:
- **initialize**: Initialize MCP connection
- **tools/list**: List all available tools
- **tools/call**: Execute a specific tool

Available tools:
${mcpTools.map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}
          `.trim(),
          operationId: 'mcp_request',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/JsonRpcRequest',
                },
                examples: {
                  list_tools: {
                    summary: 'List available tools',
                    value: {
                      jsonrpc: '2.0',
                      id: 1,
                      method: 'tools/list',
                    },
                  },
                  call_tool: {
                    summary: 'Call a tool',
                    value: {
                      jsonrpc: '2.0',
                      id: 2,
                      method: 'tools/call',
                      params: {
                        name: 'google_docs_structure',
                        arguments: {
                          documentId: '1s0gTYKvaqW7VHoSQg53Mu43KmA4im0mPGEoReAsmbO4',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Successful JSON-RPC response',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/JsonRpcResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/mcp/ws': {
        get: {
          summary: 'WebSocket MCP Endpoint',
          description: 'WebSocket endpoint for real-time MCP protocol communication. Upgrade to WebSocket and send JSON-RPC 2.0 messages.',
          operationId: 'mcp_websocket',
          responses: {
            '101': {
              description: 'Switching Protocols to WebSocket',
            },
            '426': {
              description: 'Upgrade Required',
            },
          },
        },
      },
      '/v1/documents/{documentId}/structure': {
        get: {
          operationId: 'documents_structure',
          summary: 'Get document structure',
          description: 'Inspect the structure of a Google Docs document.',
          parameters: [
            {
              in: 'path',
              name: 'documentId',
              required: true,
              description: 'The ID of the document',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Document structure retrieved successfully',
            },
          },
        },
      },
      '/v1/documents/{documentId}/batchUpdate': {
        post: {
          operationId: 'documents_batchUpdate',
          summary: 'Apply batch updates',
          description: 'Apply multiple updates to a Google Docs document',
          parameters: [
            {
              in: 'path',
              name: 'documentId',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    requests: {
                      type: 'array',
                      items: { type: 'object' },
                    },
                  },
                  required: ['requests'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Updates applied successfully' },
          },
        },
      },
      '/v1/documents/{documentId}/markdown/insert': {
        post: {
          operationId: 'documents_markdown_insert',
          summary: 'Insert markdown content',
          description: 'Insert markdown-formatted content into a Google Doc',
          parameters: [
            {
              in: 'path',
              name: 'documentId',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    markdown: {
                      type: 'string',
                      description: 'Base64-encoded markdown content',
                    },
                  },
                  required: ['markdown'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Markdown inserted successfully' },
          },
        },
      },
      '/v1/documents/{documentId}/deleteContentRangeRequest': {
        post: {
          operationId: 'documents_deleteContentRangeRequest',
          summary: 'Delete content range',
          description: 'Delete content from a specific range in the document',
          parameters: [
            {
              in: 'path',
              name: 'documentId',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    range: {
                      type: 'object',
                      properties: {
                        startIndex: { type: 'integer', minimum: 1 },
                        endIndex: { type: 'integer' },
                      },
                    },
                  },
                  required: ['range'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Content deleted successfully' },
          },
        },
      },
    },
  };
}

export async function serveOpenAPISpec(c: Context): Promise<Response> {
  const spec = generateOpenAPISpec(c);
  return c.json(spec);
}
