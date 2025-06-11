import type { WebSocket } from "ws";
import { IncomingMessage } from "node:http";

// --- Updated Type Definitions (must match client's types for consistency) ---

// Define ChatMessageType for incoming chat data from client AND outgoing relayed chat data to recipient
type ChatMessageType = {
  toUserId: string;
  data: string;
  fromUserId?: string; // Optional when received from client, always present when relayed from server
};

// Define savedMessageType for server-side persistence (what gets stored in your database)
type ServerSavedMessageType = {
  id: string; // Server-generated unique message ID (e.g., from DB)
  fromUserId: string;
  toUserId: string;
  msg: string;
  timeStamp: string; // Server-generated timestamp for message creation
  // You might add a 'status' here for messages not yet delivered to offline users
};

// Define websocketMessageType for all message types the server will SEND or RECEIVE
type websocketMessageType =
  // Incoming message from client to server (type 'chat' with tempMessageId)
  | {
      type: "chat";
      chatMessage: ChatMessageType;
      timestamp?: string;
      tempMessageId?: string;
    }
  // Outgoing messages from server to client:
  | { type: "presenceStatus"; userPresence: { users: string[] } }
  | {
      type: "chat_ack";
      tempMessageId: string;
      serverId: string;
      serverTimestamp: string;
      status: "success" | "failed";
    } // Server ACK to sender
  | { type: "error"; message: string; originalTempMessageId?: string }; // Server error to client (e.g., recipient offline)

// --- Mock Database (Replace with actual database integration) ---
// This array simulates your persistent database.
// In a real application, you would use a proper database (e.g., MongoDB, PostgreSQL, Firestore).
const mockDatabase: ServerSavedMessageType[] = [];

/**
 * Simulates saving a message to a persistent database.
 * In a real application, this would be an actual async database call.
 * @param fromUserId The ID of the user who sent the message.
 * @param toUserId The ID of the user the message is intended for.
 * @param messageData The content of the message.
 * @returns A Promise resolving to an object containing the server-generated ID and timestamp.
 */
async function saveMessageToDatabase(
  fromUserId: string,
  toUserId: string,
  messageData: string
): Promise<{ serverId: string; serverTimestamp: string }> {
  // Simulate network delay and database write
  await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay for realism

  const serverId = `msg_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;
  const serverTimestamp = new Date().toISOString();

  const savedMsg: ServerSavedMessageType = {
    id: serverId,
    fromUserId,
    toUserId,
    msg: messageData,
    timeStamp: serverTimestamp,
  };

  mockDatabase.push(savedMsg); // Add to our mock DB
  console.log(`✉️ Message saved to mock DB: ${JSON.stringify(savedMsg)}`);
  console.log("Current mock DB size:", mockDatabase.length);

  return { serverId, serverTimestamp };
}

// --- WebSocket Server Core Logic ---

const establishedUsers = new Map<string, WebSocket>();
const baseUrl =
  process.env.NODE_ENV === "production"
    ? "https://chat-app-ui-hpdx.onrender.com/"
    : "http://localhost:5173";

/**
 * Handles new WebSocket connections.
 * Authenticates the user via userId in URL and manages presence.
 * @param req Incoming HTTP request.
 * @param ws The WebSocket instance for the new connection.
 * @returns The userId if successful, otherwise an empty string.
 */
export function wsServerConnectionHandler(
  req: IncomingMessage,
  ws: WebSocket
): string {
  const userId =
    req.url !== undefined
      ? new URL(req.url, baseUrl).searchParams.get("userId")
      : undefined;

  if (userId) {
    // Store the new user's WebSocket connection
    establishedUsers.set(userId, ws);
    console.log("Established Users", Array.from(establishedUsers.keys()));

    const currentOnlineUsers = Array.from(establishedUsers.keys());
    const initialPresenceMessage: websocketMessageType = {
      type: "presenceStatus",
      userPresence: {
        users: currentOnlineUsers,
      },
    };

    // Send the full current list of online users ONLY to the newly connected user
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(initialPresenceMessage));
      console.log(`Sent initial presence to new user: ${userId}`);
    } else {
      console.error(
        `WebSocket for ${userId} not open immediately after connection.`
      );
    }

    // Broadcast to all *other* users that a new user has joined (updated presence list)
    broadcastMessage(
      JSON.stringify({
        type: "presenceStatus",
        userPresence: {
          users: currentOnlineUsers, // This list now includes the new user
        },
      } as websocketMessageType),
      userId // Exclude the new user from this specific broadcast as they already got their initial presence
    );
  }
  return userId ?? "";
}

/**
 * Broadcasts a message to all connected users, optionally excluding one user.
 * @param message The stringified message to broadcast.
 * @param excludeUserId Optional userId to exclude from the broadcast.
 */
function broadcastMessage(message: string, excludeUserId?: string) {
  establishedUsers.forEach((socket, currentUserId) => {
    if (currentUserId === excludeUserId) {
      return; // Skip the excluded user
    }
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    } else {
      console.error(
        `Socket for user ${currentUserId} is not open, considering cleanup.`
      );
      // In a production environment, you might want to remove this socket
      // from establishedUsers here, or have a periodic cleanup routine.
      // establishedUsers.delete(currentUserId);
    }
  });
}

/**
 * Handles incoming WebSocket messages from clients.
 * This is the central point for processing chat messages, including persistence and relay.
 * @param message The incoming message string.
 * @param userId The ID of the user who sent the message.
 */
export async function wsMessageHandler(message: string, userId: string) {
  try {
    const messageData = JSON.parse(message.toString()) as websocketMessageType;

    if (messageData.type === "chat") {
      const { chatMessage, tempMessageId } = messageData; // Extract tempMessageId from client message

      // Validate incoming chat message structure
      if (
        !chatMessage ||
        !chatMessage.toUserId ||
        !chatMessage.data ||
        !userId
      ) {
        console.error("Invalid chat message structure received:", messageData);
        // Send a failed acknowledgment back to the sender if possible
        const senderSocket = establishedUsers.get(userId);
        if (senderSocket && senderSocket.readyState === senderSocket.OPEN) {
          senderSocket.send(
            JSON.stringify({
              type: "chat_ack",
              tempMessageId: tempMessageId || "unknown", // Use 'unknown' if not provided
              serverId: "n/a", // No server ID as message failed to process
              serverTimestamp: new Date().toISOString(),
              status: "failed",
            } as websocketMessageType)
          );
        }
        return; // Stop processing invalid message
      }

      const fromUserId = userId; // The 'userId' from the WebSocket connection is the true sender
      const toUserId = chatMessage.toUserId;
      const chatContent = chatMessage.data;

      console.log(
        `Received chat from ${fromUserId} to ${toUserId}: "${chatContent}" (tempId: ${tempMessageId})`
      );

      // 1. Save the message to the database first
      const { serverId, serverTimestamp } = await saveMessageToDatabase(
        fromUserId,
        toUserId,
        chatContent
      );

      // 2. Send acknowledgment (chat_ack) back to the original sender
      const senderSocket = establishedUsers.get(fromUserId);
      if (senderSocket && senderSocket.readyState === senderSocket.OPEN) {
        const ackMessage: websocketMessageType = {
          type: "chat_ack",
          tempMessageId: tempMessageId || "", // Return the original tempMessageId
          serverId: serverId,
          serverTimestamp: serverTimestamp,
          status: "success",
        };
        senderSocket.send(JSON.stringify(ackMessage));
        console.log(`ACK sent to ${fromUserId} for tempId: ${tempMessageId}`);
      } else {
        console.error(
          `Sender (${fromUserId}) socket not open to send ACK for tempId: ${tempMessageId}.`
        );
        // In a robust system, you might queue this ACK for later delivery or log it for review.
      }

      // 3. Relay the message to the recipient (toUserId)
      const recipientSocket = establishedUsers.get(toUserId);
      if (
        recipientSocket &&
        recipientSocket.readyState === recipientSocket.OPEN
      ) {
        const relayedMessage: websocketMessageType = {
          type: "chat",
          chatMessage: {
            fromUserId: fromUserId, // Explicitly set sender for recipient
            toUserId: toUserId, // Explicitly set recipient for context
            data: chatContent,
          },
          timestamp: serverTimestamp, // Use the server's authoritative timestamp for the relayed message
          // No tempMessageId needed here, as this is a server-relayed message, not a client-initiated pending one.
        };
        recipientSocket.send(JSON.stringify(relayedMessage));
        console.log(
          `➡️ Message relayed to ${toUserId} (serverId: ${serverId})`
        );
      } else {
        console.warn(
          `Recipient (${toUserId}) is offline or socket not open. Message stored (serverId: ${serverId}).`
        );
        // Optional: Notify the sender that the recipient is offline, but the message was saved.
        if (senderSocket && senderSocket.readyState === senderSocket.OPEN) {
          senderSocket.send(
            JSON.stringify({
              type: "error",
              message: `User '${toUserId}' is currently offline. Your message was saved.`,
              originalTempMessageId: tempMessageId,
            } as websocketMessageType)
          );
        }
        // In a real application, you would typically store this message in a 'pending for delivery'
        // queue and deliver it when the recipient comes online.
      }
    }
    // Add other message types handling here (e.g., 'typingStatus', 'readReceipts', etc.)
  } catch (error) {
    console.error("Error in wsMessageHandler:", error);
    // Send a general error message back to the client if message parsing fails or other server errors occur
    const senderSocket = establishedUsers.get(userId);
    if (senderSocket && senderSocket.readyState === senderSocket.OPEN) {
      senderSocket.send(
        JSON.stringify({
          type: "error",
          message:
            "Server encountered an error processing your message. Please try again.",
        } as websocketMessageType)
      );
    }
  }
}

/**
 * Handles WebSocket connection closure (e.g., client disconnects).
 * Updates and broadcasts the online user list.
 * @param userId The ID of the user whose connection closed.
 */
export function wsCloseHandler(userId: string) {
  if (userId) {
    establishedUsers.delete(userId);
    console.log(
      `User ${userId} disconnected. Active users: ${Array.from(
        establishedUsers.keys()
      )}`
    );
    // Broadcast the updated presence list to everyone
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

/**
 * Explicitly closes a WebSocket connection for a user, typically on logout.
 * This will trigger the `wsCloseHandler`.
 * @param userId The ID of the user to log out.
 */
export function closeWebSocketOnUserLogout(userId: string) {
  const socket = establishedUsers.get(userId);
  if (socket) {
    socket.close(); // This will automatically trigger wsCloseHandler
    console.log(
      `WebSocket connection for user ${userId} closed by logout action`
    );
  } else {
    console.error(
      `No WebSocket connection found for user ${userId} to close on logout`
    );
  }
}

// Periodic broadcast of online users to ensure presence consistency
setInterval(() => {
  const currentOnlineUsers = Array.from(establishedUsers.keys());
  if (currentOnlineUsers.length > 0) {
    console.log(
      "Active users (periodic presence check)...",
      currentOnlineUsers
    );
    broadcastMessage(
      JSON.stringify({
        type: "presenceStatus",
        userPresence: {
          users: currentOnlineUsers,
        },
      } as websocketMessageType)
    );
  }
}, 30 * 1000); // Broadcast every 30 seconds to keep presence consistent.
