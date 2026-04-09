export type EncryptionMode = "NONE" | "STARTTLS" | "SSL_TLS";

export type SmtpTestRequest = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  encryption: EncryptionMode;
  clientName?: string;
  timeoutMs?: number;
};

export type ProtocolEvent = {
  t: string;
  type: "client" | "server" | "info" | "error";
  line: string;
};
