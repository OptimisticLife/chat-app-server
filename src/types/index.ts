export type UserModelType = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export type SecuredUserModelType = Omit<UserModelType, "password">;
export type RegisterUserDataType = Omit<UserModelType, "id">;
export type LoginUserDataType = Omit<UserModelType, "name" | "id">;
export type UserPresenceType = {
  users: string[];
};

export type ChatMessageType = {
  toUserId?: string;
  data: string;
  fromUserId?: string;
};

export type websocketMessageType = {
  type: "chat" | "presenceStatus";
  chatMessage?: ChatMessageType;
  userPresence?: UserPresenceType;
  timestamp?: string;
};
