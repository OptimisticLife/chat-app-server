import { IncomingMessage, ServerResponse } from "http";

export const headerConfig = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "range, Content-Type, X-user-id",
  "Access-Control-Expose-Headers": "token",
};

export function bodyParser(req: IncomingMessage): Promise<string> {
  let body = "";
  req.on("data", (chunk: Buffer) => {
    body += chunk;
  });
  return new Promise((resolve, reject) => {
    req.on("end", () => {
      resolve(body);
    });
  });
}

export function sendJsonResponse(
  res: ServerResponse,
  statusCode: number,
  data: Record<string, any>
) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}
