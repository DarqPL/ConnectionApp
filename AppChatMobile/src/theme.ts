// Đồng bộ màu với web app (index.css)
// Web: --primary: 271 79% 47% (violet), --primary-glow: 320 100% 70% (pink)
export const COLORS = {
  // Primary gradient (matches web's bg-gradient-primary)
  gradientStart: "#7c3aed", // violet-600
  gradientEnd: "#db2777",   // pink-600
  gradient: ["#7c3aed", "#db2777"] as [string, string],

  // Primary color
  primary: "#7c3aed",

  // Chat bubbles (matches web's chat-bubble-sent / received)
  bubbleSent: "#7c3aed",         // primary purple
  bubbleSentLight: "#ede9fe",    // violet-100
  bubbleSentText: "#ffffff",
  bubbleReceived: "#f1f5f9",     // slate-100
  bubbleReceivedText: "#1e293b", // slate-800

  // Background
  background: "#ffffff",
  backgroundMuted: "#f8fafc", // slate-50
  backgroundChat: "#f1f0f8",  // slight purple-tint for chat screen

  // Text
  text: "#1e293b",        // slate-800
  textMuted: "#64748b",   // slate-500
  textLight: "#94a3b8",   // slate-400

  // Border
  border: "#e2e8f0",      // slate-200

  // Status
  online: "#22c55e",      // green-500
  offline: "#94a3b8",     // slate-400

  // Destructive
  destructive: "#ef4444",  // red-500
};
