import { Http2ServerRequest, Http2ServerResponse } from "node:http2";
import path from "path";
import dotenv from "dotenv";
import "./utils/websockets";

const envPath = path.resolve(__dirname, "./../.env");
dotenv.config({ path: envPath });

const http = require("http");
const routeHandler = require("./routeHandler/index");

const server = http.createServer(
  (req: Http2ServerRequest, res: Http2ServerResponse) => {
    routeHandler(req, res);
  }
);

server.listen(4647, function () {
  console.log("Server running in port 4647");
});
