import crypto from "crypto";

const secretKey = process.env.CRYPTO_SECRET; // 32 bytes for AES-256
const iv = process.env.CRYPTO_IV_KEY;

if (!secretKey) {
  throw new Error("CRYPTO_SECRET environment variable is not set");
}
if (!iv) {
  throw new Error("CRYPTO_IV_KEY environment variable is not set");
}

// Algorithm
const algorithm = "aes-256-cbc";

// Convert to buffers
const defaultKey = Buffer.from(secretKey, "hex");
const defaultIv = Buffer.from(iv, "hex");

// Encrypt function
export function encrypt(text: string) {
  const cipher = crypto.createCipheriv(algorithm, defaultKey, defaultIv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  // Store IV + encrypted text separated by ':'
  return iv + ":" + encrypted;
}

// Decrypt function
export function decrypt(encryptedData: string) {
  const [ivHex, encrypted] = encryptedData.split(":");
  if (!ivHex || !encrypted) throw new Error("Invalid encrypted data");

  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, defaultKey, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
