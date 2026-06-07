// WebSocket Handler for MCP Protocol
import { Context } from 'hono';
import { handleMcpRequest } from './handler';

/**
 * Handle WebSocket upgrade and MCP protocol over WebSocket
 */
export async function handleWebSocket(c: Context): Promise<Response> {
  const upgradeHeader = c.req.header('Upgrade');

  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket connection' }, 426);
  }

  // Create a WebSocket pair
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  // Accept the WebSocket connection
  server.accept();

  let authToken: string | undefined;

  // Handle WebSocket messages
  server.addEventListener('message', async (event: MessageEvent) => {
    try {
      let message: string;

      if (typeof event.data === 'string') {
        message = event.data;
      } else if (event.data instanceof ArrayBuffer) {
        const decoder = new TextDecoder();
        message = decoder.decode(event.data);
      } else {
        // Blob or other types - convert to text
        message = await new Response(event.data).text();
      }

      const request = JSON.parse(message);
      if (request._auth) {
        authToken = request._auth;
      }

      // Create a mock Hono context for the MCP handler
      const mockContext = {
        req: {
          json: async () => request,
          header: (name: string) => {
            // WebSocket connections can send auth via first message
            if (name === 'Authorization') {
              const token = authToken || request._auth;
              return token ? `Bearer ${token}` : undefined;
            }
            return undefined;
          },
        },
        json: (data: any, status?: number) => {
          server.send(JSON.stringify(data));
          return new Response(JSON.stringify(data), {
            status: status || 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      } as any;

      await handleMcpRequest(mockContext);
    } catch (error) {
      server.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: `Parse error: ${(error as Error).message}`,
          },
        })
      );
    }
  });

  server.addEventListener('close', () => {
    // WebSocket connection closed
  });

  server.addEventListener('error', (event: Event) => {
    console.error('WebSocket error:', event);
  });

  // Return the client side of the WebSocket pair
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
