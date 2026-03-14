import { Buffer } from "buffer";

// Ensure Buffer is available before any SDK module runs
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
