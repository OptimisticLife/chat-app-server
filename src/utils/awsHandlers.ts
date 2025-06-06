import { Readable } from "stream";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

// AWS S3 Client Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,
});

// Helper to convert readable stream to string
async function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

/**
 * Upload a JSON file to AWS S3.
 */
export async function uploadingJsonFilestoS3(
  fileName: string,
  data: Record<string, any>,
  isChat: boolean = false
): Promise<void> {
  const key = isChat
    ? `chats/${fileName}.json`
    : `generic-files/${fileName}.json`;

  const params = {
    Bucket: process.env.AWS_BUCKET!,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  };

  try {
    await s3.send(new PutObjectCommand(params));
    console.log(`✅ Uploaded ${key} successfully`);
  } catch (err) {
    console.error(`Failed to upload ${key}:`, err);
    throw new Error("Upload to S3 failed");
  }
}

/**
 * Retrieve a JSON file from AWS S3. If not found, create an empty one.
 */
export async function retrieveJsonFilesFromS3(
  fileName: string,
  isChat: boolean = false
): Promise<Record<string, any>> {
  const key = isChat
    ? `chats/${fileName}.json`
    : `generic-files/${fileName}.json`;

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET!,
      Key: key,
    });

    const response = await s3.send(command);

    if (!response.Body || !(response.Body instanceof Readable)) {
      console.error("Invalid S3 Body");
      throw new Error("S3 response body is not a readable stream");
    }

    const bodyString = await streamToString(response.Body);
    const jsonData = JSON.parse(bodyString);
    return jsonData;
  } catch (err: any) {
    // Handle missing file by creating it
    if (err?.$metadata?.httpStatusCode === 404) {
      console.warn(`File not found in S3: ${key}, creating empty JSON.`);
      const emptyData = {};
      await uploadingJsonFilestoS3(fileName, emptyData, isChat);
      return emptyData;
    }

    console.error(`Error retrieving ${key}:`, err);
    throw new Error("Failed to retrieve JSON from S3");
  }
}
