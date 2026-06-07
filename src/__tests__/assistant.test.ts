import { latestUserText } from "../assistant";

describe("latestUserText", () => {
  it("returns text from the latest user message parts", () => {
    const text = latestUserText([
      { role: "user", parts: [{ type: "text", text: "old prompt" }] },
      { role: "assistant", parts: [{ type: "text", text: "reply" }] },
      { role: "user", parts: [{ type: "text", text: " latest prompt " }] },
    ]);

    expect(text).toBe("latest prompt");
  });

  it("falls back to content when parts are missing", () => {
    const text = latestUserText([{ role: "user", content: " content-only prompt " }]);

    expect(text).toBe("content-only prompt");
  });

  it("falls back to content when parts do not produce text", () => {
    const text = latestUserText([
      {
        role: "user",
        content: "fallback prompt",
        parts: [{ type: "tool-invocation" }],
      },
    ]);

    expect(text).toBe("fallback prompt");
  });
});
