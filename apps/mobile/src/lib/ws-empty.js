// React Native fallback shim for packages that import `ws`.
// Keep CommonJS + named/default export shapes compatible with `ws`.
const WebSocketImpl = global.WebSocket || class WebSocket {};

module.exports = WebSocketImpl;
module.exports.WebSocket = WebSocketImpl;
module.exports.default = WebSocketImpl;
