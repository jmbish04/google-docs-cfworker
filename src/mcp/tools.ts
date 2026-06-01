// MCP Tool Definitions for Google Docs Operations
import { McpTool } from './schemas';

export const mcpTools: McpTool[] = [
  {
    name: 'google_docs_structure',
    description: 'Inspect the structure of a Google Docs document including content, styles, and metadata. Use this before making changes to understand the document layout.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Docs document. Can be extracted from a document URL.',
        },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'google_docs_batch_update',
    description: 'Apply multiple updates to a Google Docs document in a single operation. Supports inserting text, formatting, creating lists, tables, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Docs document.',
        },
        requests: {
          type: 'array',
          description: 'Array of update requests following Google Docs API specification. Examples: insertText, updateTextStyle, createParagraphBullets.',
          items: {
            type: 'object',
          },
        },
      },
      required: ['documentId', 'requests'],
    },
  },
  {
    name: 'google_docs_markdown_insert',
    description: 'Insert markdown-formatted content into a Google Docs document. The markdown will be automatically converted to proper Google Docs formatting.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Docs document.',
        },
        markdown: {
          type: 'string',
          description: 'The markdown content to insert. Can be plain text or base64-encoded.',
        },
      },
      required: ['documentId', 'markdown'],
    },
  },
  {
    name: 'google_docs_delete_content_range',
    description: 'Delete content from a specific range in a Google Docs document. If no range is provided, clears the entire document.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Docs document.',
        },
        range: {
          type: 'object',
          description: 'The range to delete. Omit to clear entire document.',
          properties: {
            startIndex: {
              type: 'integer',
              description: 'Start index (minimum 1)',
              minimum: 1,
            },
            endIndex: {
              type: 'integer',
              description: 'End index',
            },
            segmentId: {
              type: 'string',
              description: 'Optional segment ID for headers/footers',
            },
            tabId: {
              type: 'string',
              description: 'Optional tab ID',
            },
          },
        },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'google_docs_create',
    description: 'Create a new Google Docs document with an optional title.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title for the new document.',
        },
      },
    },
  },
];

// Helper to get tool by name
export function getToolByName(name: string): McpTool | undefined {
  return mcpTools.find(tool => tool.name === name);
}

// Helper to list all tool names
export function getToolNames(): string[] {
  return mcpTools.map(tool => tool.name);
}
