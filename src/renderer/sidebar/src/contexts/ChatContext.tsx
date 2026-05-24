/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface TextContentPart {
  type: "text";
  text: string;
}

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;

  // Chat actions
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;
}

const ChatContext = createContext<ChatContextType | null>(null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTextContentPart = (value: unknown): value is TextContentPart =>
  isRecord(value) && value.type === "text" && typeof value.text === "string";

const getMessageContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.find(isTextContentPart)?.text || "";
  }

  return "";
};

const toMessage = (message: unknown, index: number): Message => {
  const role =
    isRecord(message) && message.role === "user" ? "user" : "assistant";

  return {
    id: `msg-${index}`,
    role,
    content: isRecord(message) ? getMessageContent(message.content) : "",
    timestamp: Date.now(),
    isStreaming: false,
  };
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load initial messages from main process
  useEffect(() => {
    const loadMessages = async (): Promise<void> => {
      try {
        const storedMessages = await window.sidebarAPI.getMessages();
        if (storedMessages && storedMessages.length > 0) {
          // Convert CoreMessage format to our frontend Message format
          const convertedMessages = storedMessages.map(toMessage);
          setMessages(convertedMessages);
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };
    loadMessages();
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);

    try {
      const messageId = Date.now().toString();

      // Send message to main process (which will handle context)
      await window.sidebarAPI.sendChatMessage({
        message: content,
        messageId: messageId,
      });

      // Messages will be updated via the chat-messages-updated event
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearChat = useCallback(async () => {
    try {
      await window.sidebarAPI.clearChat();
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  }, []);

  const getPageContent = useCallback(async () => {
    try {
      return await window.sidebarAPI.getPageContent();
    } catch (error) {
      console.error("Failed to get page content:", error);
      return null;
    }
  }, []);

  const getPageText = useCallback(async () => {
    try {
      return await window.sidebarAPI.getPageText();
    } catch (error) {
      console.error("Failed to get page text:", error);
      return null;
    }
  }, []);

  const getCurrentUrl = useCallback(async () => {
    try {
      return await window.sidebarAPI.getCurrentUrl();
    } catch (error) {
      console.error("Failed to get current URL:", error);
      return null;
    }
  }, []);

  // Set up message listeners
  useEffect(() => {
    // Listen for streaming response updates
    const handleChatResponse = (data: {
      messageId: string;
      content: string;
      isComplete: boolean;
    }): void => {
      if (data.isComplete) {
        setIsLoading(false);
      }
    };

    // Listen for message updates from main process
    const handleMessagesUpdated = (updatedMessages: unknown[]): void => {
      // Convert CoreMessage format to our frontend Message format
      const convertedMessages = updatedMessages.map(toMessage);
      setMessages(convertedMessages);
    };

    window.sidebarAPI.onChatResponse(handleChatResponse);
    window.sidebarAPI.onMessagesUpdated(handleMessagesUpdated);

    return () => {
      window.sidebarAPI.removeChatResponseListener();
      window.sidebarAPI.removeMessagesUpdatedListener();
    };
  }, []);

  const value: ChatContextType = {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    getPageContent,
    getPageText,
    getCurrentUrl,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
