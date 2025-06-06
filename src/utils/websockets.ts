import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { ChatMessageType, websocketMessageType } from "../types/index.js";

const WebSocketServerInstance = new WebSocketServer({
  port: 3333,
  clientTracking: true,
});

const establishedUsers = new Map<string, WebSocket>();

WebSocketServerInstance.on("connection", (ws, req) => {
  const userId =
    req.url !== undefined
      ? new URL(req.url, "http://localhost").searchParams.get("userId")
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

  ws.on("message", (message: string) => {
    const messageData = JSON.parse(message.toString()) as websocketMessageType;
    const { type: messageType, chatMessage } = messageData;

    if (chatMessage !== undefined) {
      if (messageType === "chat") {
        if (chatMessage.toUserId && userId) {
          handleMessageRouting(userId, chatMessage.toUserId, chatMessage.data);
        }
      }
    }
  });

  ws.on("close", () => {
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
  });
});

WebSocketServerInstance.on("listening", () => {
  console.log("WebSocket server is listening on port 3333");
});

WebSocketServerInstance.on("error", (error) => {
  console.error(`WebSocket error: ${error.message}`);
});

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
