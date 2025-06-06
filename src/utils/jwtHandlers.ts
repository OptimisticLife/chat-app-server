// Create JWT
import jwt from "jsonwebtoken";
import { UserModelType } from "types";
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}
const JWT_SECRET = SECRET as string;

export function createToken(user: UserModelType) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// Verify JWT (middleware example)
export function verifyToken(cookie: string | undefined): boolean {
  console.log("is cookie present", cookie);
  try {
    if (!cookie) {
      return false; // no token, unauthorized
    }

    // Parse cookie string to find token (assuming token stored as "token=...")
    const cookies = cookie
      .split(";")
      .reduce<Record<string, string>>((acc, cookie) => {
        const [key, value] = cookie.trim().split("=");
        acc[key] = value;
        return acc;
      }, {});

    const token = cookies.token; // Adjust 'token' if you named it differently
    if (!token) {
      return false;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    return !!decoded;
  } catch (err) {
    return false;
  }
}
