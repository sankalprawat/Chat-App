// 1. User & Authentication Types

export interface User {
    _id: string;
    fullName: string;
    email: string;
    profilePic?: string;
    googleId?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface AuthResponse {
    message?: string;
    data: {
        token?: string;
        user: User;
    };
}

// 2. Chat & Direct Messages Types

export interface Message {
    _id: string;
    senderId: string;
    receiverId: string;
    text?: string;
    imageUrl?: string[];
    videoUrl?: string[];
    audioUrl?: string[];
    createdAt: string;
    updatedAt?: string;
}

// 3. Group & Group Messages types

export interface Group {
    _id: string;
    groupName: string;
    description?: string;
    groupPic?: string;
    admin: string | User;
    members: (string | User)[];
    createdAt?: string;
    updatedAt?: string;
}

export interface GroupMessage {
    _id: string;
    groupId: string;
    senderId: string | User;
    text?: string;
    imageUrl?: string[];
    videoUrl?: string[];
    audioUrl?: string[];
    createdAt: string;
    updatedAt?: string;
}

// 4. File upload and Media Preveiw Types

export type MediaType = "image" | "video" | "audio";

export interface FilePreview {
    file: File;
    previewUrl: string;
    type: MediaType;
}