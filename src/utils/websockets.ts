import type { WebSocket } from "ws";
import type { ChatMessageType, websocketMessageType } from "../types/index.js";
import { IncomingMessage } from "node:http";

const establishedUsers = new Map<string, WebSocket>();
const baseUrl =
  process.env.NODE_ENV === "production"
    ? "https://chat-app-ui-hpdx.onrender.com/"
    : "http://localhost:5173";

export function wsServerConnectionHandler(
  req: IncomingMessage,
  ws: WebSocket
): string {
  const userId =
    req.url !== undefined
      ? new URL(req.url, baseUrl).searchParams.get("userId")
      : undefined;
  if (userId) {
    establishedUsers.set(userId, ws);
    console.log("Established Users", Array.from(establishedUsers.keys()));
    //   when new user connects, broadcast their presence status
    broadcastMessage(
      JSON.stringify({
        type: "presenceStatus",
        userPresence: {
          users: Array.from(establishedUsers.keys()),
        },
      } as websocketMessageType)
    );
  }
  return userId ?? "";
}

export function wsMessageHandler(message: string, userId: string) {
  const messageData = JSON.parse(message.toString()) as websocketMessageType;
  const { type: messageType, chatMessage } = messageData;

  if (chatMessage !== undefined) {
    if (messageType === "chat") {
      if (chatMessage.toUserId && userId) {
        handleMessageRouting(userId, chatMessage.toUserId, chatMessage.data);
      }
    }
  }
}

export function wsCloseHandler(userId: string) {
  if (userId) {
    establishedUsers.delete(userId);
    broadcastMessage(
      JSON.stringify({
        type: "presenceStatus",
        userPresence: {
          users: Array.from(establishedUsers.keys()),
        },
      } as websocketMessageType)
    );
  }
}

function broadcastMessage(message: string) {
  establishedUsers.forEach((socket) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    } else {
      console.error("Socket is not open, cannot send message");
    }
  });
}

function handleMessageRouting(
  fromUserId: string,
  toUserId: string,
  message: string
) {
  const socket = establishedUsers.get(toUserId);
  // Check if the socket for the recipient user is open.
  if (socket && socket.readyState === socket.OPEN) {
    const chatMessage: ChatMessageType = {
      fromUserId: fromUserId,
      data: String(message),
    };
    socket.send(
      JSON.stringify({
        type: "chat",
        chatMessage,
        timestamp: new Date().toISOString(),
      } as websocketMessageType)
    );
  } else {
    console.error(`No active WebSocket connection for user ${toUserId}`);
  }
}

export function closeWebSocketOnUserLogout(userId: string) {
  const socket = establishedUsers.get(userId);
  if (socket) {
    socket.close();
    establishedUsers.delete(userId);
    console.log(`WebSocket connection for user ${userId} closed`);
  } else {
    console.error(`No WebSocket connection found for user ${userId}`);
  }
}
