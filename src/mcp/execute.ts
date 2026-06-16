import { GoogleApiClient } from "../services/GoogleApiClient";
import { decodeMarkdownInput, markdownToGoogleDocsRequests } from "../utils/markdown-to-google-docs";
import type { McpContent } from "./schemas";

export async function executeWorkspaceTool(
  toolName: string,
  args: Record<string, any>,
  bearerToken: string
): Promise<McpContent[]> {
  const client = new GoogleApiClient({ accessToken: bearerToken });

  try {
    switch (toolName) {
      case "google_docs_structure": {
        const { documentId } = args;
        const fields = [
          "title",
          "headers",
          "footers",
          "body.content.startIndex",
          "body.content.endIndex",
          "body.content.paragraph.elements.startIndex",
          "body.content.paragraph.elements.textRun.content",
          "body.content.table.rows",
          "body.content.table.columns",
          "body.content.table.tableRows",
        ];
        const data = await client.docs_get(documentId, fields.join(","));
        return [{ type: "text", text: JSON.stringify(data, null, 2) }];
      }

      case "google_docs_batch_update": {
        const { documentId, requests } = args;
        const data = await client.docs_batchUpdate(documentId, requests);
        return [
          {
            type: "text",
            text: `Successfully applied ${requests.length} updates.\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_docs_markdown_insert": {
        const { documentId, markdown } = args;
        const decodedMarkdown = decodeMarkdownInput(markdown);
        const requests = markdownToGoogleDocsRequests(decodedMarkdown);
        const data = await client.docs_batchUpdate(documentId, requests);
        return [
          {
            type: "text",
            text: `Successfully inserted markdown content with ${requests.length} updates.\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_docs_delete_content_range": {
        const { documentId, range } = args;
        const docData = await client.docs_get(documentId, "body.content.endIndex");
        const content = (docData as any).body?.content;
        const endIndex =
          Array.isArray(content) && content.length > 0
            ? (content[content.length - 1].endIndex || 1) - 1
            : 1;
        const deleteRequests = [
          {
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex,
                ...range,
              },
            },
          },
        ];
        const data = await client.docs_batchUpdate(documentId, deleteRequests);
        return [
          {
            type: "text",
            text: `Successfully deleted content range.\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_docs_create": {
        const { title } = args;
        const data = await client.docs_create(title);
        const docId = (data as any).documentId;
        return [
          {
            type: "text",
            text: `Document created successfully.\n\nID: ${docId}\nURL: https://docs.google.com/document/d/${docId}/edit\n\nMetadata:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_drive_search": {
        const { query, pageSize, orderBy } = args;
        const data = await client.drive_list({
          q: query,
          pageSize: pageSize || 100,
          orderBy,
          fields:
            "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink, owners)",
        });
        const files = (data as any).files || [];
        const fileList = files
          .map(
            (file: any) =>
              `- ${file.name} (${file.mimeType})\n  ID: ${file.id}\n  Link: ${file.webViewLink || "N/A"}\n  Modified: ${file.modifiedTime}`
          )
          .join("\n\n");

        return [
          {
            type: "text",
            text: `Found ${files.length} files${(data as any).nextPageToken ? " (more available)" : ""}:\n\n${fileList}\n\nFull response:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_drive_get_file": {
        const { fileId, fields } = args;
        const data = await client.drive_get(
          fileId,
          fields || "id, name, mimeType, createdTime, modifiedTime, size, webViewLink, owners, parents"
        );
        return [{ type: "text", text: `File metadata:\n${JSON.stringify(data, null, 2)}` }];
      }

      case "google_drive_create_folder": {
        const { name, parentId } = args;
        const metadata: any = {
          name,
          mimeType: "application/vnd.google-apps.folder",
        };

        if (parentId) {
          metadata.parents = [parentId];
        }

        const data = await client.drive_create(metadata);
        return [
          {
            type: "text",
            text: `Folder created successfully.\n\nName: ${(data as any).name}\nID: ${(data as any).id}\nLink: https://drive.google.com/drive/folders/${(data as any).id}\n\nMetadata:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_drive_move_file": {
        const { fileId, newParentId } = args;
        const fileData = await client.drive_get(fileId, "parents");
        const previousParents = ((fileData as any).parents || []).join(",");
        const data = await client.drive_update(
          fileId,
          {},
          {
            addParents: newParentId,
            removeParents: previousParents,
          }
        );

        return [
          {
            type: "text",
            text: `File moved successfully.\n\nNew parent: ${newParentId}\n\nMetadata:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_drive_delete_file": {
        const { fileId } = args;
        await client.drive_delete(fileId);
        return [
          {
            type: "text",
            text: `File deleted successfully.\n\nFile ID: ${fileId}\nNote: The file has been moved to trash and can be restored from there.`,
          },
        ];
      }

      case "google_sheets_get": {
        const { spreadsheetId, ranges } = args;
        const data = await client.sheets_get(spreadsheetId, ranges);
        return [{ type: "text", text: `Spreadsheet metadata:\n${JSON.stringify(data, null, 2)}` }];
      }

      case "google_sheets_get_values": {
        const { spreadsheetId, range } = args;
        const data = await client.sheets_getValues(spreadsheetId, range);
        const values = (data as any).values || [];
        let tableText = `Values from ${range}:\n\n`;

        if (values.length > 0) {
          tableText += values.map((row: any[]) => row.join(" | ")).join("\n");
        } else {
          tableText += "(No data)";
        }

        return [
          {
            type: "text",
            text: `${tableText}\n\nFull response:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_sheets_update_values": {
        const { spreadsheetId, range, values, valueInputOption } = args;
        const data = await client.sheets_updateValues(
          spreadsheetId,
          range,
          values,
          valueInputOption || "USER_ENTERED"
        );
        return [
          {
            type: "text",
            text: `Values updated successfully.\n\nUpdated ${(data as any).updatedRows || 0} rows, ${(data as any).updatedColumns || 0} columns, ${(data as any).updatedCells || 0} cells.\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_sheets_append_values": {
        const { spreadsheetId, range, values, valueInputOption } = args;
        const data = await client.sheets_appendValues(
          spreadsheetId,
          range,
          values,
          valueInputOption || "USER_ENTERED"
        );
        return [
          {
            type: "text",
            text: `Values appended successfully.\n\nAppended ${(data as any).updates?.updatedRows || 0} rows, ${(data as any).updates?.updatedColumns || 0} columns, ${(data as any).updates?.updatedCells || 0} cells.\n\nRange: ${(data as any).updates?.updatedRange}\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_sheets_create": {
        const { title } = args;
        const data = await client.sheets_create(title);
        const spreadsheetId = (data as any).spreadsheetId;
        return [
          {
            type: "text",
            text: `Spreadsheet created successfully.\n\nTitle: ${title}\nID: ${spreadsheetId}\nURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n\nMetadata:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      case "google_sheets_batch_update": {
        const { spreadsheetId, requests } = args;
        const data = await client.sheets_batchUpdate(spreadsheetId, requests);
        return [
          {
            type: "text",
            text: `Batch update applied successfully.\n\nApplied ${requests.length} requests.\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
          },
        ];
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (err: unknown) {
    const error = err as Error;
    throw new Error(`Tool execution failed: ${error.message}`);
  }
}
