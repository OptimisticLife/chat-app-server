import { IncomingMessage, ServerResponse } from "node:http";
import { sendJsonResponse, bodyParser, headerConfig } from "../utils";
import {
  addUser,
  checkUser,
  getSecuredUsers,
} from "../routeHandler/userHandler";
import {
  RegisterUserDataType,
  LoginUserDataType,
  UserModelType,
} from "../types";
import { createToken, verifyToken } from "../utils/jwtHandlers";
import { closeWebSocketOnUserLogout } from "../utils/websockets";
import {
  readChatDataFromFile,
  writeChatDataToFile,
} from "../utils/chatFileHandler";

async function routeHandler(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (
    origin?.includes("localhost:5173") ||
    origin?.includes("chat-app-server-c4lt.onrender")
  ) {
    // Create a copy of headerConfig as plain object
    const headers = { ...headerConfig } as Record<string, string>;
    headers["Access-Control-Allow-Origin"] = origin;

    // Set each header separately:
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
  }
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, headerConfig);
    return res.end();
  }
  if (req.url === "/") {
    sendJsonResponse(res, 200, { message: "Home: Chat-app 4647" });
    return;
  } else if (req.url === "/create-user" && req.method === "POST") {
    try {
      const response: string = await bodyParser(req);
      const userData: RegisterUserDataType = JSON.parse(response);
      await addUser(userData);
      sendJsonResponse(res, 201, { message: "User created successfully" });
      return;
    } catch (err) {
      sendJsonResponse(res, 500, { error: "500: Internal Server Error" });
      console.error("Error in create-user route:", err);
      return;
    }
  } else if (req.url === "/login" && req.method === "POST") {
    try {
      const response: string = await bodyParser(req);
      const loginData: LoginUserDataType = JSON.parse(response);
      const existingUser: UserModelType | null = await checkUser(
        loginData.email,
        loginData.password
      );
      if (existingUser) {
        // New JWT token generation
        const token = createToken(existingUser);
        const tokenCookie = `token=${token}; SameSite=None; Path=/; Secure; HttpOnly`;

        res.setHeader("Set-Cookie", tokenCookie);
        sendJsonResponse(res, 201, {
          message: "User Loggedin successfully",
          data: { id: existingUser.id, name: existingUser.name },
        });
        return;
      } else {
        sendJsonResponse(res, 401, { error: "401: Unauthorized" });
        return;
      }
    } catch (err) {
      sendJsonResponse(res, 500, { error: "500: Internal Server Error" });
      console.error("Error in create-user route:", err);
      return;
    }
  } else if (req.url === "/get-users" && req.method === "GET") {
    console.log("Route /get-users ...");
    try {
      const securedUsers = await getSecuredUsers();

      if (securedUsers) {
        sendJsonResponse(res, 201, {
          message: "Users fetched..",
          data: securedUsers,
        });
        return;
      } else {
        sendJsonResponse(res, 500, { error: "500: Internal server Error" });
        return;
      }
    } catch (err) {
      sendJsonResponse(res, 500, { error: "500: Internal Server Error" });
      console.error("Error in create-user route:", err);
      return;
    }
  } else if (req.url === "/check-session" && req.method === "GET") {
    const isAuth = verifyToken(req.headers.cookie);
    if (isAuth) {
      return sendJsonResponse(res, 200, { message: "User is authenticated" });
    } else {
      return sendJsonResponse(res, 401, { error: "401: Unauthorized" });
    }
  } else if (req.url === "/get-chat" && req.method === "GET") {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      return sendJsonResponse(res, 400, { error: "400: Bad Request" });
    }
    try {
      const chatData = await readChatDataFromFile(userId);
      return sendJsonResponse(res, 200, { data: chatData });
    } catch (err) {
      console.error("Error fetching chat data:", err);
      return sendJsonResponse(res, 500, {
        error: "500: Internal Server Error",
      });
    }
  } else if (req.url === "/update-chat" && req.method === "POST") {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      return sendJsonResponse(res, 400, { error: "400: Bad Request" });
    }
    try {
      const bodyString: string = await bodyParser(req);
      if (bodyString) {
        writeChatDataToFile(userId, JSON.parse(bodyString));
        return sendJsonResponse(res, 200, {
          message: "Chat data updated successfully",
        });
      } else {
        return sendJsonResponse(res, 400, { error: "400: Bad Request" });
      }
    } catch (err) {
      console.error("Error updating chat data:", err);
      return sendJsonResponse(res, 500, {
        error: "500: Internal Server Error",
      });
    }
  } else if (req.url === "/logout" && req.method === "POST") {
    closeWebSocketOnUserLogout(req.headers["x-user-id"] as string);
    res.setHeader("Set-Cookie", "token=; Max-Age=0; Path=/; HttpOnly");
    return sendJsonResponse(res, 200, {
      message: "User logged out successfully",
    });
  } else sendJsonResponse(res, 404, { error: "404: Page not found" });
}

module.exports = routeHandler;
