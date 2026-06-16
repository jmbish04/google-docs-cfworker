import type { Context } from "hono";
import { getGoogleWorkspaceAccessToken } from "../services/google-service-account";
import { isWorkerApiKeyAuthorized } from "../secrets";
import { executeWorkspaceTool } from "./execute";
import {
  JsonRpcErrorCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
  jsonRpcRequestSchema,
} from "./schemas";
import { mcpTools } from "./tools";

function errorResponse(
  id: JsonRpcRequest["id"] | null,
  code: number,
  message: string
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  };
}

export async function handleMcpRequest(c: Context<{ Bindings: CloudflareBindings }>): Promise<Response> {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch (error) {
    return c.json(errorResponse(null, JsonRpcErrorCode.PARSE_ERROR, "Parse error: Invalid JSON"), 400);
  }

  const parseResult = jsonRpcRequestSchema.safeParse(body);

  if (!parseResult.success) {
    const id =
      body && typeof body === "object" && "id" in body
        ? ((body as { id?: JsonRpcRequest["id"] }).id ?? null)
        : null;

    return c.json(
      errorResponse(
        id,
        JsonRpcErrorCode.INVALID_REQUEST,
        `Invalid Request: ${parseResult.error.issues
          .map((issue: { message: string }) => issue.message)
          .join(", ")}`
      ),
      400
    );
  }

  const request = parseResult.data;

  try {
    const { method, params, id } = request;

    switch (method) {
      case "initialize": {
        return c.json({
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "google-workspace-mcp",
              version: "1.0.0",
            },
            capabilities: {
              tools: {},
            },
          },
        } satisfies JsonRpcResponse);
      }

      case "tools/list": {
        return c.json({
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            tools: mcpTools,
          },
        } satisfies JsonRpcResponse);
      }

      case "tools/call": {
        if (!params || !params.name) {
          return c.json(
            errorResponse(id ?? null, JsonRpcErrorCode.INVALID_PARAMS, 'Invalid params: "name" is required'),
            400
          );
        }

        const auth = await isWorkerApiKeyAuthorized(c.req.raw, c.env);

        if (!auth.ok) {
          return c.json(errorResponse(id ?? null, JsonRpcErrorCode.INTERNAL_ERROR, auth.message), { status: 401 });
        }

        const toolName = params.name as string;
        const toolArgs = params.arguments || {};

        try {
          const googleAccessToken = await getGoogleWorkspaceAccessToken(c.env);
          const content = await executeWorkspaceTool(toolName, toolArgs, googleAccessToken);

          return c.json({
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              content,
            },
          } satisfies JsonRpcResponse);
        } catch (error) {
          return c.json(
            errorResponse(id ?? null, JsonRpcErrorCode.INTERNAL_ERROR, (error as Error).message),
            500
          );
        }
      }

      default:
        return c.json(
          errorResponse(id ?? null, JsonRpcErrorCode.METHOD_NOT_FOUND, `Method not found: ${method}`),
          404
        );
    }
  } catch (error) {
    return c.json(
      errorResponse(
        request.id ?? null,
        JsonRpcErrorCode.INTERNAL_ERROR,
        `Internal error: ${(error as Error).message}`
      ),
      500
    );
  }
}
