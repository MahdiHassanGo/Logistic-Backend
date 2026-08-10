import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function createMockReq(url: string) {
  return {
    method: "GET",
    url,
    headers: { host: "localhost:4000" },
    socket: { remoteAddress: "127.0.0.1" }
  } as any;
}

function createMockRes() {
  const headers: Record<string, string | string[]> = {};
  let statusCode = 200;
  let body: any = null;

  const res = {
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    removeHeader(name: string) {
      delete headers[name.toLowerCase()];
      return res;
    },
    hasHeader(name: string) {
      return name.toLowerCase() in headers;
    },
    getHeaderNames() {
      return Object.keys(headers);
    },
    getHeaders() {
      return { ...headers };
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      body = data;
      return res;
    },
    send(data: any) {
      body = data;
      return res;
    },
    end() {
      return res;
    },
    getStatus() {
      return statusCode;
    },
    getBody() {
      return body;
    }
  };

  return res;
}

describe("Health endpoints", () => {
  it("should respond to GET /health/live", async () => {
    const app = createApp();
    const req = createMockReq("/health/live");
    const res = createMockRes();

    await new Promise<void>((resolve) => {
      app(req, res as any, () => resolve());
      setTimeout(resolve, 50);
    });

    expect(res.getStatus()).toBe(200);
    expect(res.getBody()).toEqual({
      success: true,
      data: expect.objectContaining({
        status: "alive"
      })
    });
  });

  it("should respond to GET /api/v1/health/live", async () => {
    const app = createApp();
    const req = createMockReq("/api/v1/health/live");
    const res = createMockRes();

    await new Promise<void>((resolve) => {
      app(req, res as any, () => resolve());
      setTimeout(resolve, 50);
    });

    expect(res.getStatus()).toBe(200);
    expect(res.getBody()).toEqual({
      success: true,
      data: expect.objectContaining({
        status: "alive"
      })
    });
  });
});
