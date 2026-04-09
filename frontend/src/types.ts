export type EncryptionMode = "NONE" | "STARTTLS" | "SSL_TLS";

export type ProtocolEvent = {
  t: string;
  type: "client" | "server" | "info" | "error";
  line: string;
};

export type TestStatus = "idle" | "running" | "success" | "error";
