import type { ChatMessageType } from "../types/index.js";
import { retrieveJsonFilesFromS3, uploadingJsonFilestoS3 } from "./awsHandlers";

/**
 * Read chat data for a user from AWS S3.
 */
export async function readChatDataFromFile(
  userId: string
): Promise<Record<string, ChatMessageType[]>> {
  try {
    console.log("Read chat Data for user:", userId);
    const data = await retrieveJsonFilesFromS3(`${userId}_chat`, true);
    console.log("file size: ", Object.keys(data).length);

    if (!data || typeof data !== "object") {
      console.warn(
        `⚠️ No chat data found or invalid format for user: ${userId}`
      );
      return {};
    }

    return data as Record<string, ChatMessageType[]>;
  } catch (err) {
    console.error(`Failed to read chat data for user ${userId}:`, err);
    return {};
  }
}

/**
 * Write chat data for a user to AWS S3.
 */
export async function writeChatDataToFile(
  userId: string,
  chatData: Record<string, ChatMessageType[]>
): Promise<void> {
  try {
    if (!chatData || typeof chatData !== "object") {
      console.error("Invalid chat data format. Expected an object.");
      return;
    }

    console.log("Saving chat data for user:", userId);
    console.log("file size: ", Object.keys(chatData).length);
    await uploadingJsonFilestoS3(`${userId}_chat`, chatData, true);
    console.log(`✅ Chat data successfully saved for user: ${userId}`);
  } catch (err) {
    console.error(`Error saving chat data for user ${userId}:`, err);
  }
}
