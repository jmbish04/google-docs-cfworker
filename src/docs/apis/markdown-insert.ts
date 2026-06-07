import { Context } from "hono";
import { forward, SERVICE_ENDPOINT } from "./forward";
import { decodeMarkdownInput, markdownToGoogleDocsRequests } from "../../utils/markdown-to-google-docs";

// convert markdown to Google Docs format, then apply batchUpdate
export const markdownInsert = async (
  c: Context,
) => {
  try {
    // Get JSON body and extract the base64 encoded markdown
    const body = await c.req.json();
    if (!body || !body.markdown) {
      return c.json({
        error: "Markdown content not found. Please insert markdown as a base64 encoded string in the 'markdown' field."
      }, 400);
    }

    const markdown = decodeMarkdownInput(body.markdown);
    const requests = markdownToGoogleDocsRequests(markdown);

    console.log(`Generated ${requests.length} requests for Google Docs API`);
    const documentId = c.req.param("documentId");
    const path = `/v1/documents/${documentId}:batchUpdate`;
    const url = `${SERVICE_ENDPOINT}${path}`;
    return forward(c, undefined, { url, body: { requests } });
  } catch (error) {
    console.error(error);
    return c.json({
      error: "Failed to convert markdown to Google Docs format",
      details: (error as Error).message
    }, 500);
  }
};
