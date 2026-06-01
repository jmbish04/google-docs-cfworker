// MCP Protocol Handler
import { Context } from 'hono';
import { JsonRpcRequest, JsonRpcResponse, JsonRpcErrorCode, McpContent } from './schemas';
import { mcpTools } from './tools';
import { SERVICE_ENDPOINT } from '../docs/apis/forward';

/**
 * Execute a Google Docs MCP tool
 */
async function executeGoogleDocsTool(
  toolName: string,
  args: Record<string, any>,
  bearerToken: string
): Promise<McpContent[]> {
  const headers = {
    'Authorization': `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (toolName) {
      case 'google_docs_structure': {
        const { documentId } = args;
        const fields = [
          'title',
          'headers',
          'footers',
          'body.content.startIndex',
          'body.content.endIndex',
          'body.content.paragraph.elements.startIndex',
          'body.content.paragraph.elements.textRun.content',
          'body.content.table.rows',
          'body.content.table.columns',
          'body.content.table.tableRows',
        ];
        const url = `${SERVICE_ENDPOINT}/v1/documents/${documentId}?fields=${fields.join(',')}`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
          const errorData = await response.json() as any;
          throw new Error(errorData.error?.message || 'Failed to fetch document structure');
        }

        const data = await response.json();
        return [{ type: 'text', text: JSON.stringify(data, null, 2) }];
      }

      case 'google_docs_batch_update': {
        const { documentId, requests } = args;
        const url = `${SERVICE_ENDPOINT}/v1/documents/${documentId}:batchUpdate`;
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ requests }),
        });

        if (!response.ok) {
          const errorData = await response.json() as any;
          throw new Error(errorData.error?.message || 'Batch update failed');
        }

        const data = await response.json();
        return [{ type: 'text', text: `Successfully applied ${requests.length} updates. Response: ${JSON.stringify(data)}` }];
      }

      case 'google_docs_markdown_insert': {
        const { documentId, markdown } = args;
        // This would use the markdown-insert endpoint
        const url = `${SERVICE_ENDPOINT}/v1/documents/${documentId}:batchUpdate`;
        // Note: In real implementation, we'd convert markdown to Google Docs requests
        return [{ type: 'text', text: 'Markdown insertion requires the markdown conversion logic from the REST API endpoint' }];
      }

      case 'google_docs_delete_content_range': {
        const { documentId, range } = args;

        // First, get document length if endIndex not provided
        const docUrl = `${SERVICE_ENDPOINT}/v1/documents/${documentId}?fields=body.content.endIndex`;
        const docResponse = await fetch(docUrl, { headers });

        if (!docResponse.ok) {
          throw new Error('Failed to fetch document structure');
        }

        const docData = await docResponse.json() as { body: { content: { endIndex: number }[] } };
        const endIndex = docData.body.content[docData.body.content.length - 1].endIndex - 1;

        const deleteUrl = `${SERVICE_ENDPOINT}/v1/documents/${documentId}:batchUpdate`;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requests: [{
              deleteContentRange: {
                range: {
                  startIndex: range?.startIndex || 1,
                  endIndex: range?.endIndex || endIndex,
                  ...range,
                },
              },
            }],
          }),
        });

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json() as any;
          throw new Error(errorData.error?.message || 'Delete content failed');
        }

        const data = await deleteResponse.json();
        return [{ type: 'text', text: `Successfully deleted content range. Response: ${JSON.stringify(data)}` }];
      }

      case 'google_docs_create': {
        const { title } = args;
        const url = `${SERVICE_ENDPOINT}/v1/documents`;
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: title || 'Untitled Document' }),
        });

        if (!response.ok) {
          const errorData = await response.json() as any;
          throw new Error(errorData.error?.message || 'Document creation failed');
        }

        const data = await response.json();
        return [{ type: 'text', text: `Document created successfully. ID: ${(data as any).documentId}. URL: https://docs.google.com/document/d/${(data as any).documentId}/edit` }];
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (err: unknown) {
    const error = err as Error;
    throw new Error(`Tool execution failed: ${error.message}`);
  }
}

/**
 * Handle MCP JSON-RPC 2.0 requests
 */
export async function handleMcpRequest(c: Context): Promise<Response> {
  let request: JsonRpcRequest;

  try {
    request = await c.req.json();
  } catch (error) {
    const errorResponse: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: JsonRpcErrorCode.PARSE_ERROR,
        message: 'Parse error: Invalid JSON',
      },
    };
    return c.json(errorResponse, 400);
  }

  // Validate JSON-RPC structure
  if (request.jsonrpc !== '2.0') {
    const errorResponse: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: request.id || null,
      error: {
        code: JsonRpcErrorCode.INVALID_REQUEST,
        message: 'Invalid Request: jsonrpc must be "2.0"',
      },
    };
    return c.json(errorResponse, 400);
  }

  try {
    const { method, params, id } = request;

    // Handle different MCP methods
    switch (method) {
      case 'tools/list': {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: id || null,
          result: {
            tools: mcpTools,
          },
        };
        return c.json(response);
      }

      case 'tools/call': {
        if (!params || !params.name) {
          const errorResponse: JsonRpcResponse = {
            jsonrpc: '2.0',
            id: id || null,
            error: {
              code: JsonRpcErrorCode.INVALID_PARAMS,
              message: 'Invalid params: "name" is required',
            },
          };
          return c.json(errorResponse, 400);
        }

        const toolName = params.name as string;
        const toolArgs = params.arguments || {};

        // Get bearer token from Authorization header
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          const errorResponse: JsonRpcResponse = {
            jsonrpc: '2.0',
            id: id || null,
            error: {
              code: JsonRpcErrorCode.INTERNAL_ERROR,
              message: 'Authorization required: Bearer token must be provided',
            },
          };
          return c.json(errorResponse, 401);
        }

        const bearerToken = authHeader.substring(7);

        try {
          const content = await executeGoogleDocsTool(toolName, toolArgs, bearerToken);
          const response: JsonRpcResponse = {
            jsonrpc: '2.0',
            id: id || null,
            result: {
              content,
            },
          };
          return c.json(response);
        } catch (error) {
          const errorResponse: JsonRpcResponse = {
            jsonrpc: '2.0',
            id: id || null,
            error: {
              code: JsonRpcErrorCode.INTERNAL_ERROR,
              message: (error as Error).message,
            },
          };
          return c.json(errorResponse, 500);
        }
      }

      case 'initialize': {
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: id || null,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'google-workspace-mcp',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          },
        };
        return c.json(response);
      }

      default: {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: id || null,
          error: {
            code: JsonRpcErrorCode.METHOD_NOT_FOUND,
            message: `Method not found: ${method}`,
          },
        };
        return c.json(errorResponse, 404);
      }
    }
  } catch (error) {
    const errorResponse: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: request.id || null,
      error: {
        code: JsonRpcErrorCode.INTERNAL_ERROR,
        message: `Internal error: ${(error as Error).message}`,
      },
    };
    return c.json(errorResponse, 500);
  }
}
