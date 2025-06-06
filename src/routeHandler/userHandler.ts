import {
  retrieveJsonFilesFromS3,
  uploadingJsonFilestoS3,
} from "./../utils/awsHandlers";
import { SecuredUserModelType, UserModelType } from "./../types/index";
import { decrypt, encrypt } from "./../utils/crypto";

export async function getUsers(): Promise<UserModelType[] | null> {
  try {
    const users = (await retrieveJsonFilesFromS3("users")) as UserModelType[];
    // console.log("API:/get-user", users);
    if (!users || users.length === 0) {
      return [];
    }

    return users;
  } catch (err) {
    console.error("Error in getUsers:", err);
    return null;
  }
}

export async function getSecuredUsers(): Promise<
  SecuredUserModelType[] | null
> {
  try {
    const users: UserModelType[] | null = await getUsers();
    // console.log("API:/get-secured-users", users);

    if (!users || users.length === 0) {
      return [];
    }
    const securedUsers = users.map((user) => {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
      } as SecuredUserModelType;
    });
    return securedUsers;
  } catch (err) {
    console.error("Error in getUsers:", err);
    return null;
  }
}

export async function getUser(id: string): Promise<UserModelType> {
  return {
    id: "1",
    name: "John Doe",
    email: "JohnDoe@chat4647.com",
    password: "encrypted_password", // This should be encrypted
  };
}

export async function addUser(
  userData: Omit<UserModelType, "id">
): Promise<SecuredUserModelType> {
  try {
    const users = (await retrieveJsonFilesFromS3("users")) as UserModelType[];
    const existingUser = users.find(
      (u) => u.email === userData.email || u.name === userData.name
    );
    if (existingUser) {
      throw new Error("User already exists");
    }

    const userId = "USER_" + Math.random().toString(36).substring(2);
    const newUser: UserModelType = {
      id: userId,
      name: userData.name,
      email: userData.email,
      password: encrypt(userData.password),
    };

    console.log("New user data:", newUser);
    // Assuming password is part of userData
    users.push({ ...newUser });
    await uploadingJsonFilestoS3("users", users);

    return { id: userId, name: userData.name, email: userData.email };
  } catch (err) {
    console.error("Error in addUser:", err);
    throw err;
  }
}

export async function checkUser(
  email: string,
  password: string
): Promise<UserModelType | null> {
  try {
    const users: UserModelType[] | null = await getUsers();
    if (!users || users.length === 0) {
      return null;
    }

    const user = users.find((u) => u.email === email);
    // console.log("User found:", user);
    // console.log("decrypted password:", decrypt(user?.password || ""));
    if (!user) {
      return null;
    }
    // Assuming decrypt function is available to decrypt the password
    if (user.password !== encrypt(password)) {
      return null;
    }

    return user;
  } catch (err) {
    console.error("Error in checkUser:", err);
    return null;
  }
}
