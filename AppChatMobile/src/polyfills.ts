/**
 * polyfills.ts
 *
 * MUST be imported first in index.ts (before App and @stomp/stompjs).
 *
 * @stomp/stompjs v7+ requires TextEncoder/TextDecoder.
 * React Native Hermes may already provide them, but some older versions don't.
 * We patch conservatively only if missing.
 */

// --- TextEncoder ---
if (typeof (global as any).TextEncoder === "undefined") {
  (global as any).TextEncoder = class TextEncoder {
    encoding = "utf-8";
    encode(input: string = ""): Uint8Array {
      const utf8: number[] = [];
      for (let i = 0; i < input.length; i++) {
        let charcode = input.charCodeAt(i);
        if (charcode < 0x80) {
          utf8.push(charcode);
        } else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(
            0xe0 | (charcode >> 12),
            0x80 | ((charcode >> 6) & 0x3f),
            0x80 | (charcode & 0x3f)
          );
        } else {
          // Surrogate pair
          i++;
          const c2 = input.charCodeAt(i);
          const cp = 0x10000 + (((charcode & 0x3ff) << 10) | (c2 & 0x3ff));
          utf8.push(
            0xf0 | (cp >> 18),
            0x80 | ((cp >> 12) & 0x3f),
            0x80 | ((cp >> 6) & 0x3f),
            0x80 | (cp & 0x3f)
          );
        }
      }
      return new Uint8Array(utf8);
    }
  };
  console.log("[Polyfill] TextEncoder patched.");
}

// --- TextDecoder ---
if (typeof (global as any).TextDecoder === "undefined") {
  (global as any).TextDecoder = class TextDecoder {
    encoding: string;
    constructor(encoding = "utf-8") {
      this.encoding = encoding;
    }
    decode(input?: BufferSource | null): string {
      if (!input) return "";
      const bytes =
        input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBuffer);
      let result = "";
      let i = 0;
      while (i < bytes.length) {
        const byte = bytes[i];
        if (byte < 0x80) {
          result += String.fromCharCode(byte);
          i++;
        } else if ((byte & 0xe0) === 0xc0) {
          result += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
          i += 2;
        } else if ((byte & 0xf0) === 0xe0) {
          result += String.fromCharCode(
            ((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
          );
          i += 3;
        } else {
          i += 4; // skip 4-byte sequences (emoji etc) for simplicity
        }
      }
      return result;
    }
  };
  console.log("[Polyfill] TextDecoder patched.");
}

// --- location.protocol (some versions of @stomp/stompjs check this) ---
if (typeof (global as any).location === "undefined") {
  (global as any).location = { protocol: "http:" };
  console.log("[Polyfill] location.protocol patched.");
}
