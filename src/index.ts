import { Http2ServerRequest, Http2ServerResponse } from "node:http2";
import path from "path";
import dotenv from "dotenv";
import "./utils/websockets";
import { WebSocketServer } from "ws";
import {
  wsServerConnectionHandler,
  wsMessageHandler,
  wsCloseHandler,
} from "./utils/websockets";

const envPath = path.resolve(__dirname, "./../.env");
dotenv.config({ path: envPath });

const http = require("http");
const routeHandler = require("./routeHandler/index");

const server = http.createServer(
  (req: Http2ServerRequest, res: Http2ServerResponse) => {
    routeHandler(req, res);
  }
);

// Attach WebSocket server to the same HTTP server
const WebSocketServerInstance = new WebSocketServer({ server });

WebSocketServerInstance.on("connection", (ws, req) => {
  const userId = wsServerConnectionHandler(req, ws);
  ws.on("message", (message) => wsMessageHandler(message.toString(), userId));
  ws.on("close", () => wsCloseHandler(userId));
});

server.listen(4647, function () {
  console.log("Server running in port 4647");
});
