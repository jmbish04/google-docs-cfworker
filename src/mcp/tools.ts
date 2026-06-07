// MCP Tool Definitions for Google Workspace Operations (Docs, Drive, Sheets)
import { McpTool } from './schemas';

export const mcpTools: McpTool[] = [
  // Google Docs Tools
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

  // Google Drive Tools
  {
    name: 'google_drive_search',
    description: 'Search for files in Google Drive using query parameters. Supports filtering by name, type, owner, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query using Google Drive query syntax. Example: "name contains \'report\' and mimeType=\'application/pdf\'"',
        },
        pageSize: {
          type: 'integer',
          description: 'Maximum number of files to return (1-1000). Default: 100',
          minimum: 1,
          maximum: 1000,
        },
        orderBy: {
          type: 'string',
          description: 'Sort order. Examples: "name", "modifiedTime desc", "createdTime"',
        },
      },
    },
  },
  {
    name: 'google_drive_get_file',
    description: 'Get metadata for a specific file or folder in Google Drive.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file or folder.',
        },
        fields: {
          type: 'string',
          description: 'Specific fields to retrieve. Example: "id,name,mimeType,createdTime,size"',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'google_drive_create_folder',
    description: 'Create a new folder in Google Drive.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the folder to create.',
        },
        parentId: {
          type: 'string',
          description: 'Optional parent folder ID. If not provided, creates in root.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'google_drive_move_file',
    description: 'Move a file or folder to a different parent folder in Google Drive.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file or folder to move.',
        },
        newParentId: {
          type: 'string',
          description: 'The ID of the new parent folder.',
        },
      },
      required: ['fileId', 'newParentId'],
    },
  },
  {
    name: 'google_drive_delete_file',
    description: 'Delete a file or folder from Google Drive. This moves it to trash.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file or folder to delete.',
        },
      },
      required: ['fileId'],
    },
  },

  // Google Sheets Tools
  {
    name: 'google_sheets_get',
    description: 'Get spreadsheet metadata and optionally specific ranges of data.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet.',
        },
        ranges: {
          type: 'array',
          description: 'Optional array of A1 notation ranges to retrieve. Example: ["Sheet1!A1:D10", "Sheet2!B2:C5"]',
          items: {
            type: 'string',
          },
        },
      },
      required: ['spreadsheetId'],
    },
  },
  {
    name: 'google_sheets_get_values',
    description: 'Get values from a specific range in a spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet.',
        },
        range: {
          type: 'string',
          description: 'The A1 notation range to retrieve. Example: "Sheet1!A1:D10"',
        },
      },
      required: ['spreadsheetId', 'range'],
    },
  },
  {
    name: 'google_sheets_update_values',
    description: 'Update values in a specific range of a spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet.',
        },
        range: {
          type: 'string',
          description: 'The A1 notation range to update. Example: "Sheet1!A1:D10"',
        },
        values: {
          type: 'array',
          description: '2D array of values to write. Example: [["Name", "Age"], ["John", 30], ["Jane", 25]]',
          items: {
            type: 'array',
          },
        },
        valueInputOption: {
          type: 'string',
          description: 'How to interpret input. "RAW" for uninterpreted, "USER_ENTERED" for parsing (default).',
          enum: ['RAW', 'USER_ENTERED'],
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
  },
  {
    name: 'google_sheets_append_values',
    description: 'Append values to the end of a table in a spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet.',
        },
        range: {
          type: 'string',
          description: 'The A1 notation range to append to. Example: "Sheet1!A:D"',
        },
        values: {
          type: 'array',
          description: '2D array of values to append. Example: [["John", 30], ["Jane", 25]]',
          items: {
            type: 'array',
          },
        },
        valueInputOption: {
          type: 'string',
          description: 'How to interpret input. "RAW" for uninterpreted, "USER_ENTERED" for parsing (default).',
          enum: ['RAW', 'USER_ENTERED'],
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
  },
  {
    name: 'google_sheets_create',
    description: 'Create a new Google Sheets spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title for the new spreadsheet.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'google_sheets_batch_update',
    description: 'Apply multiple updates to a spreadsheet in a single operation. Supports adding sheets, formatting, merging cells, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet.',
        },
        requests: {
          type: 'array',
          description: 'Array of update requests following Google Sheets API specification.',
          items: {
            type: 'object',
          },
        },
      },
      required: ['spreadsheetId', 'requests'],
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
