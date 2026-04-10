/**
 * index.ts — App entry point.
 *
 * IMPORTANT: polyfills MUST be imported before App so they run before
 * @stomp/stompjs is loaded (Metro bundler processes imports in order).
 */
import "./src/polyfills"; // ← MUST be first import

import { registerRootComponent } from "expo";
import App from "./src/App";

registerRootComponent(App);
