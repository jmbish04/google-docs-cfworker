// Scalar API Documentation UI
import { Context } from 'hono';

export async function serveScalarUI(c: Context): Promise<Response> {
  const baseUrl = new URL(c.req.url).origin;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Workspace MCP API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="${baseUrl}/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>
  `.trim();

  return c.html(html);
}
