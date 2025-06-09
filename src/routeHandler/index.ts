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

const isProd = process.env.NODE_ENV === "production";

async function routeHandler(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;

  if (
    origin?.includes("localhost:5173") ||
    origin?.includes("chat-app-ui-hpdx.onrender.com")
  ) {
    const headers = { ...headerConfig } as Record<string, string>;
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
  }

  if (req.method === "OPTIONS") {
    res.writeHead(200, headerConfig);
    return res.end();
  }

  if (req.url === "/") {
    return sendJsonResponse(res, 200, { message: "Home: Chat-app 4647" });
  }

  if (req.url === "/create-user" && req.method === "POST") {
    try {
      const body = await bodyParser(req);
      const userData: RegisterUserDataType = JSON.parse(body);
      await addUser(userData);
      return sendJsonResponse(res, 201, {
        message: "User created successfully",
      });
    } catch (err) {
      console.error("Error in create-user route:", err);
      return sendJsonResponse(res, 500, {
        error: "500: Internal Server Error",
      });
    }
  }

  if (req.url === "/login" && req.method === "POST") {
    try {
      const body = await bodyParser(req);
      const loginData: LoginUserDataType = JSON.parse(body);
      const existingUser = await checkUser(loginData.email, loginData.password);

      if (existingUser) {
        const token = createToken(existingUser);
        const tokenCookie = `token=${token}; HttpOnly; Path=/; ${
          isProd ? "Secure; SameSite=None;" : "SameSite=Lax;"
        }`;

        res.setHeader("Set-Cookie", tokenCookie);
        return sendJsonResponse(res, 201, {
          message: "User Logged in successfully",
          data: { id: existingUser.id, name: existingUser.name },
        });
      } else {
        return sendJsonResponse(res, 401, { error: "401: Unauthorized" });
      }
    } catch (err) {
      console.error("Error in login route:", err);
      return sendJsonResponse(res, 500, {
        error: "500: Internal Server Error",
      });
    }
  }

  if (req.url === "/get-users" && req.method === "GET") {
    try {
      const users = await getSecuredUsers();
      return sendJsonResponse(res, 200, {
        message: "Users fetched successfully",
        data: users,
      });
    } catch (err) {
      console.error("Error in get-users route:", err);
      return sendJsonResponse(res, 500, {
        error: "500: Internal Server Error",
      });
    }
  }

  if (req.url === "/check-session" && req.method === "GET") {
    const isAuth = verifyToken(req.headers.cookie);
    if (isAuth) {
      return sendJsonResponse(res, 200, { message: "User is authenticated" });
    } else {
      return sendJsonResponse(res, 401, { error: "401: Unauthorized" });
    }
  }

  if (req.url === "/get-chat" && req.method === "GET") {
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
  }

  if (req.url === "/update-chat" && req.method === "POST") {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      return sendJsonResponse(res, 400, { error: "400: Bad Request" });
    }

    try {
      const body = await bodyParser(req);
      if (body) {
        await writeChatDataToFile(userId, JSON.parse(body));
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
  }

  if (req.url === "/logout" && req.method === "POST") {
    closeWebSocketOnUserLogout(req.headers["x-user-id"] as string);
    const clearCookie = `token=; Max-Age=0; HttpOnly; Path=/; ${
      isProd ? "Secure; SameSite=None;" : "SameSite=Lax;"
    }`;
    res.setHeader("Set-Cookie", clearCookie);
    return sendJsonResponse(res, 200, {
      message: "User logged out successfully",
    });
  }

  return sendJsonResponse(res, 404, { error: "404: Page not found" });
}

module.exports = routeHandler;
