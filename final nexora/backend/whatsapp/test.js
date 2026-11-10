const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

// Exercise the real bridge handlers with disposable files and a fake WhatsApp socket.
function bridge(t, authGate = Promise.resolve(), saveGate = Promise.resolve()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nexora-wa-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const routes = {};
  const sockets = [];
  const timers = [];
  let authCalls = 0;
  let onListening;
  const app = {
    use() {}, param() {},
    listen(port, host, callback) { onListening = callback; },
    get(route, handler) { routes[`GET ${route}`] = handler; },
    post(route, handler) { routes[`POST ${route}`] = handler; },
  };
  const express = Object.assign(() => app, { json: () => null });
  const baileys = {
    DisconnectReason: { loggedOut: 401 },
    async useMultiFileAuthState(folder) {
      authCalls++;
      await authGate;
      return { state: {}, saveCreds: async () => {
        await saveGate;
        await fs.promises.writeFile(path.join(folder, "creds.json"), "{}");
      } };
    },
    default() {
      let onClose;
      const closed = new Promise(resolve => { onClose = resolve; });
      const socket = {
        closed,
        ev: new EventEmitter(),
        async sendMessage() { return {}; },
        end() {
          this.ended = true;
          onClose();
          this.ev.emit("connection.update", { connection: "close" });
        },
      };
      sockets.push(socket);
      return socket;
    },
  };
  const context = vm.createContext({
    __dirname: directory,
    process: { env: {} },
    Buffer,
    console: { log() {}, warn() {}, error() {} },
    setTimeout(fn) { const timer = { fn, cleared: false }; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer) timer.cleared = true; },
    fetch: async () => { throw new Error("Network disabled in tests"); },
    require(name) {
      if (name === "express") return express;
      if (name === "@whiskeysockets/baileys") return baileys;
      if (name === "qrcode") return { toDataURL: async () => "data:image/png;base64,test" };
      return require(name);
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "index.js"), "utf8"), context);
  return {
    sockets, timers, routes,
    folder: (id) => path.join(directory, "sessions", id),
    authCalls: () => authCalls,
    resumeSaved: () => onListening(),
    start: (id) => context.startSession(id),
    async api(method, route, id, body = {}) {
      const handler = routes[`${method} ${route}`];
      assert.ok(handler, `${method} ${route} must exist`);
      const result = { code: 200 };
      const response = {
        status(code) { result.code = code; return this; },
        json(body) { result.body = body; return this; },
      };
      await handler({ params: { tid: id }, body }, response);
      return result;
    },
  };
}

test("checking status never creates a session or folder", async (t) => {
  const h = bridge(t);
  const result = await h.api("GET", "/wa/:tid/status", "12");
  assert.equal(result.body.status, "DISCONNECTED");
  assert.equal(h.authCalls(), 0);
  assert.equal(fs.existsSync(h.folder("12")), false);
});

test("sending while disconnected reports the problem without starting WhatsApp", async (t) => {
  const h = bridge(t);
  const result = await h.api("POST", "/wa/:tid/send", "12", { phone: "8801700000000", text: "Hello" });
  assert.equal(result.code, 409);
  assert.equal(result.body.ok, false);
  assert.equal(h.authCalls(), 0);
  assert.equal(fs.existsSync(h.folder("12")), false);
});

test("startup restores saved credentials and ignores empty session folders", async (t) => {
  const h = bridge(t);
  fs.mkdirSync(h.folder("12"), { recursive: true });
  fs.writeFileSync(path.join(h.folder("12"), "creds.json"), "{}");
  fs.mkdirSync(h.folder("13"), { recursive: true });
  h.resumeSaved();
  assert.equal(h.authCalls(), 1);
  await h.start("12");
  const empty = await h.api("GET", "/wa/:tid/status", "13");
  assert.equal(empty.body.status, "DISCONNECTED");
});

test("explicit connect starts once and exposes a QR code", async (t) => {
  const h = bridge(t);
  await h.api("POST", "/wa/:tid/connect", "12");
  await h.api("POST", "/wa/:tid/connect", "12");
  assert.equal(h.authCalls(), 1);
  h.sockets[0].ev.emit("connection.update", { qr: "test-qr" });
  const status = await h.api("GET", "/wa/:tid/status", "12");
  assert.equal(status.body.status, "QR_READY");
  assert.match(status.body.qr, /^data:image\/png/);
});

test("removal forgets credentials and cancels even an already queued reconnect", async (t) => {
  const h = bridge(t);
  await h.start("12");
  await h.sockets[0].ev.listeners("creds.update")[0]();
  h.sockets[0].ev.emit("connection.update", { connection: "close" });
  const pending = h.timers[0];
  assert.ok(pending);
  const result = await h.api("POST", "/wa/:tid/remove", "12");
  assert.equal(result.body.ok, true);
  await pending.fn();
  assert.equal(pending.cleared, true);
  assert.equal(h.authCalls(), 1);
  assert.equal(fs.existsSync(h.folder("12")), false);
});

test("removal waits for an in-flight start and prevents a late socket", async (t) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = bridge(t, gate);
  assert.ok(h.routes["POST /wa/:tid/remove"]);
  const starting = h.start("12");
  const stopping = h.api("POST", "/wa/:tid/remove", "12");
  release();
  await Promise.all([starting, stopping]);
  assert.equal(h.sockets.length, 0);
  assert.equal(fs.existsSync(h.folder("12")), false);
});

test("late events from an old socket cannot revive or close its replacement", async (t) => {
  const h = bridge(t);
  await h.start("12");
  const old = h.sockets[0];
  await h.api("POST", "/wa/:tid/remove", "12");
  await h.api("POST", "/wa/:tid/connect", "12");
  h.sockets[1].ev.emit("connection.update", { connection: "open" });
  old.ev.emit("connection.update", { connection: "close" });
  await old.ev.listeners("creds.update")[0]();
  const status = await h.api("GET", "/wa/:tid/status", "12");
  assert.equal(status.body.status, "CONNECTED");
  assert.equal(fs.existsSync(path.join(h.folder("12"), "creds.json")), false);
});

test("removal during reset leaves no replacement socket or session files", async (t) => {
  let releaseSave;
  const saveGate = new Promise(resolve => { releaseSave = resolve; });
  const h = bridge(t, Promise.resolve(), saveGate);
  await h.start("12");
  const old = h.sockets[0];
  const saving = old.ev.listeners("creds.update")[0]();
  await Promise.resolve(); // Let the credential write enter its deferred save.
  const resetting = h.api("POST", "/wa/:tid/reset", "12");
  await old.closed;
  old.ev.emit("creds.update");
  const removing = h.api("POST", "/wa/:tid/remove", "12");
  releaseSave();
  const [, reset, remove] = await Promise.all([saving, resetting, removing]);
  assert.equal(reset.body.ok, true);
  assert.equal(remove.body.ok, true);
  const status = await h.api("GET", "/wa/:tid/status", "12");
  assert.equal(status.body.status, "DISCONNECTED");
  assert.ok(h.sockets.every(socket => socket.ended));
  assert.equal(fs.existsSync(h.folder("12")), false);
});
