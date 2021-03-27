/*
 * Copyright 2018-2020 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const test = require("ava");
const { NatsServer, wsConfig } = require("./helpers/launcher");
const {
  createInbox,
  Events,
  ErrorCode,
  deferred,
  DebugEvents,
} = require("../lib/nats-base-client/internal_mod");
const { Lock } = require("./helpers/lock");
const {
  connect,
} = require("./index");

test("reconnect - should receive when some servers are invalid", async (t) => {
  const ns = await NatsServer.start(wsConfig());

  const servers = ["ws://127.0.0.1:7", `ws://127.0.0.1:${ns.websocket}`];
  const nc = await connect({ servers: servers, noRandomize: true });

  const lock = Lock(1);
  const subj = createInbox();
  await nc.subscribe(subj, {
    callback: () => {
      lock.unlock();
    },
  });
  nc.publish(subj);
  await lock;
  await nc.close();
  await ns.stop();

  // @ts-ignore
  const a = nc.protocol.servers.getServers();
  t.is(a.length, 1);
  t.true(a[0].didConnect);
});

test("reconnect - events", async (t) => {
  const ns = await NatsServer.start(wsConfig());

  let nc = await connect({
    servers: `ws://127.0.0.1:${ns.websocket}`,
    waitOnFirstConnect: true,
    reconnectTimeWait: 100,
    maxReconnectAttempts: 10,
  });

  let disconnects = 0;
  let reconnecting = 0;

  const status = nc.status();
  (async () => {
    for await (const e of status) {
      switch (e.type) {
        case "disconnect":
          disconnects++;
          break;
        case "reconnecting":
          reconnecting++;
          break;
        default:
          t.log(e);
      }
    }
  })().then();
  await ns.stop();
  try {
    await nc.closed();
  } catch (err) {
    t.is(err.code, ErrorCode.ConnectionRefused);
  }
  t.is(disconnects, 1, "disconnects");
  t.is(reconnecting, 10, "reconnecting");
});

test("reconnect - reconnect not emitted if suppressed", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  let nc = await connect({
    servers: `ws://127.0.0.1:${ns.websocket}`,
    reconnect: false,
  });

  let disconnects = 0;
  (async () => {
    for await (const e of nc.status()) {
      switch (e.type) {
        case Events.Disconnect:
          disconnects++;
          break;
        case DebugEvents.Reconnecting:
          t.fail("shouldn't have emitted reconnecting");
          break;
      }
    }
  })().then();

  await ns.stop();
  await nc.closed();
  t.pass();
});

test("reconnect - reconnecting after proper delay", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  let nc = await connect({
    servers: `ws://127.0.0.1:${ns.websocket}`,
    reconnectTimeWait: 500,
    maxReconnectAttempts: 1,
  });
  // @ts-ignore
  const serverLastConnect = nc.protocol.servers.getCurrentServer().lastConnect;

  const dt = deferred();
  const _ = (async () => {
    for await (const e of nc.status()) {
      switch (e.type) {
        case DebugEvents.Reconnecting:
          const elapsed = Date.now() - serverLastConnect;
          dt.resolve(elapsed);
          break;
      }
    }
  })();
  await ns.stop();
  const elapsed = await dt;
  t.true(elapsed >= 500 && elapsed <= 700, `elapsed was ${elapsed}`);
  await nc.closed();
});

test("reconnect - indefinite reconnects", async (t) => {
  let ns = await NatsServer.start(wsConfig());
  let nc = await connect({
    servers: `ws://127.0.0.1:${ns.websocket}`,
    reconnectTimeWait: 100,
    maxReconnectAttempts: -1,
  });

  let disconnects = 0;
  let reconnects = 0;
  let reconnect = false;
  (async () => {
    for await (const e of nc.status()) {
      switch (e.type) {
        case Events.Disconnect:
          disconnects++;
          break;
        case Events.Reconnect:
          reconnect = true;
          nc.close();
          break;
        case DebugEvents.Reconnecting:
          reconnects++;
          break;
      }
    }
  })().then();

  await ns.stop();

  const lock = Lock(1);
  setTimeout(async (t) => {
    ns = await ns.restart();
    lock.unlock();
  }, 1000);

  await nc.closed();
  await ns.stop();
  await lock;
  await ns.stop();
  t.true(reconnects > 5);
  t.true(reconnect);
  t.is(disconnects, 1);
});

test("reconnect - jitter", async (t) => {
  let ns = await NatsServer.start(wsConfig());

  let called = false;
  const h = () => {
    called = true;
    return 15;
  };

  let hasDefaultFn;
  let dc = await connect({
    servers: `ws://127.0.0.1:${ns.websocket}`,
    reconnect: false,
  });
  hasDefaultFn = typeof dc.options.reconnectDelayHandler === "function";

  let nc = await connect({
    servers: `ws://127.0.0.1:${ns.websocket}`,
    maxReconnectAttempts: 1,
    reconnectDelayHandler: h,
  });

  await ns.stop();
  await nc.closed();
  await dc.closed();
  t.true(called);
  t.true(hasDefaultFn);
});

test("reconnect - internal disconnect forces reconnect", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({
    servers: `ws://127.0.0.1:${ns.websocket}`,
    reconnect: true,
    reconnectTimeWait: 200,
  });

  let stale = false;
  let disconnect = false;
  const lock = Lock();
  (async () => {
    for await (const e of nc.status()) {
      switch (e.type) {
        case DebugEvents.StaleConnection:
          stale = true;
          break;
        case Events.Disconnect:
          disconnect = true;
          break;
        case Events.Reconnect:
          lock.unlock();
          break;
      }
    }
  })().then();

  nc.protocol.disconnect();
  await lock;

  t.true(disconnect, "disconnect");
  t.true(stale, "stale");

  await nc.close();
  await ns.stop();
});
