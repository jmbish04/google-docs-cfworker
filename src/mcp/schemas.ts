// MCP (Model Context Protocol) JSON-RPC 2.0 Schema Definitions
import { z } from 'zod';

// Base JSON-RPC 2.0 Request Schema
export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.record(z.any()).optional(),
});

export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;

// Base JSON-RPC 2.0 Response Schema
export const jsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional(),
  }).optional(),
});

export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

// MCP Tool Call Schema
export const mcpToolCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.any()).optional(),
});

export type McpToolCall = z.infer<typeof mcpToolCallSchema>;

// MCP Content Schema
export const mcpContentSchema = z.object({
  type: z.enum(['text', 'image', 'resource']),
  text: z.string().optional(),
  data: z.string().optional(),
  mimeType: z.string().optional(),
});

export type McpContent = z.infer<typeof mcpContentSchema>;

// MCP Tool Input Schema
export const mcpToolInputSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.any()),
  required: z.array(z.string()).optional(),
});

export type McpToolInput = z.infer<typeof mcpToolInputSchema>;

// MCP Tool Definition Schema
export const mcpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: mcpToolInputSchema,
});

export type McpTool = z.infer<typeof mcpToolSchema>;

// JSON-RPC Error Codes
export const JsonRpcErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;
