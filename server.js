// CivGen relay server — Bun
// Serves the game at / and the phone remote at /remote.
// Relays commands from the phone (controller) to the MacBook game (host) via WebSocket.
//
// Usage: bun server.js

const hosts = new Set();
const controllers = new Set();

const server = Bun.serve({
  port: 4321,
  hostname: "0.0.0.0",

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const role = url.searchParams.get("role") || "controller";
      if (server.upgrade(req, { data: { role } })) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/remote") {
      return new Response(Bun.file("./remote.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(Bun.file("./index.html"), {
      headers: { "Content-Type": "text/html" },
    });
  },

  websocket: {
    open(ws) {
      if (ws.data.role === "host") {
        hosts.add(ws);
        console.log(`[host connected] total hosts: ${hosts.size}`);
        // Tell all controllers a host came online
        const msg = JSON.stringify({ type: "hosts", count: hosts.size });
        for (const c of controllers) { try { c.send(msg); } catch {} }
      } else {
        controllers.add(ws);
        console.log(`[controller connected] total controllers: ${controllers.size}`);
        ws.send(JSON.stringify({ type: "hosts", count: hosts.size }));
      }
    },

    message(ws, msg) {
      if (ws.data.role === "host") {
        // State snapshot from game → forward to all phone controllers
        for (const c of controllers) { try { c.send(msg); } catch {} }
      } else {
        // Command from phone → forward to all game hosts
        for (const h of hosts) { try { h.send(msg); } catch {} }
      }
    },

    close(ws) {
      hosts.delete(ws);
      controllers.delete(ws);
      if (ws.data.role === "host") {
        console.log(`[host disconnected] total hosts: ${hosts.size}`);
        const msg = JSON.stringify({ type: "hosts", count: hosts.size });
        for (const c of controllers) { try { c.send(msg); } catch {} }
      } else {
        console.log(`[controller disconnected] total controllers: ${controllers.size}`);
      }
    },
  },
});

// Detect local IP for easy copy-paste
const { networkInterfaces } = await import("os");
const nets = networkInterfaces();
let localIP = "localhost";
outer: for (const ifaces of Object.values(nets)) {
  for (const iface of ifaces) {
    if (iface.family === "IPv4" && !iface.internal) {
      localIP = iface.address;
      break outer;
    }
  }
}

console.log(`\nCivGen server running`);
console.log(`  Game   → http://${localIP}:${server.port}/`);
console.log(`  Remote → http://${localIP}:${server.port}/remote`);
console.log(`\nOpen the Remote URL on your phone (same WiFi).\n`);
