import { isWorkerApiKeyAuthorized } from "../secrets";

const env = {
  WORKER_API_KEY: "expected-key",
} as unknown as CloudflareBindings;

describe("isWorkerApiKeyAuthorized", () => {
  it("authorizes worker_api_key cookies", async () => {
    const request = new Request("https://example.com/assistant/threads", {
      headers: {
        cookie: "theme=dark; worker_api_key=expected-key",
      },
    });

    await expect(isWorkerApiKeyAuthorized(request, env)).resolves.toEqual({ ok: true });
  });

  it("rejects invalid worker_api_key cookies", async () => {
    const request = new Request("https://example.com/assistant/threads", {
      headers: {
        cookie: "worker_api_key=wrong-key",
      },
    });

    await expect(isWorkerApiKeyAuthorized(request, env)).resolves.toEqual({
      ok: false,
      status: 401,
      message: "Invalid Worker API key",
    });
  });
});
