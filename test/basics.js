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
 */

const test = require("ava");
const { connect, ErrorCode, createInbox, StringCodec, Empty } = require(
  "./index",
);
const { deferred, delay } = require(
  "../lib/nats-base-client/internal_mod",
);
const { Lock } = require("./helpers/lock");
const { NatsServer, wsConfig, tlsConfig } = require("./helpers/launcher");

test("basics - connect", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  await nc.flush();
  await nc.close();
  await ns.stop();
  t.pass();
});

test("basics - tls connect", async (t) => {
  const conf = {
    websocket: {
      port: -1,
      tls: tlsConfig(),
    },
  };
  const ns = await NatsServer.start(conf);
  const nc = await connect({ port: ns.websocket });
  await nc.flush();
  await nc.close();
  await ns.stop();
  t.pass();
});

test("basics - publish", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  nc.publish(createInbox());
  await nc.flush();
  await nc.close();
  await ns.stop();
  t.pass();
});

test("basics - no publish without subject", async (t) => {
  t.plan(1);
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  try {
    nc.publish("");
    fail("should not be able to publish without a subject");
  } catch (err) {
    t.is(err.code, ErrorCode.BadSubject);
  } finally {
    await nc.close();
    await ns.stop();
  }
});

test("basics - pubsub", async (t) => {
  t.plan(1);
  const ns = await NatsServer.start(wsConfig());
  const subj = createInbox();
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  const sub = nc.subscribe(subj);
  const iter = (async () => {
    for await (const m of sub) {
      break;
    }
  })();

  nc.publish(subj);
  await iter;
  t.is(sub.getProcessed(), 1);
  await nc.close();
  await ns.stop();
});

test("basics - subscribe and unsubscribe", async (t) => {
  t.plan(12);
  const ns = await NatsServer.start(wsConfig());
  const subj = createInbox();
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  const sub = nc.subscribe(subj, { max: 1000, queue: "aaa" });

  // check the subscription
  t.is(nc.protocol.subscriptions.size(), 1);
  let s = nc.protocol.subscriptions.get(1);
  t.truthy(s);
  t.is(s.getReceived(), 0);
  t.is(s.subject, subj);
  t.truthy(s.callback);
  t.is(s.max, 1000);
  t.is(s.queue, "aaa");

  // modify the subscription
  sub.unsubscribe(10);
  s = nc.protocol.subscriptions.get(1);
  t.truthy(s);
  t.is(s.max, 10);

  // verify subscription updates on message
  nc.publish(subj);
  await nc.flush();
  s = nc.protocol.subscriptions.get(1);
  t.truthy(s);
  t.is(s.getReceived(), 1);

  // verify cleanup
  sub.unsubscribe();
  t.is(nc.protocol.subscriptions.size(), 0);
  await nc.close();
  await ns.stop();
});

test("basics - subscriptions iterate", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const lock = Lock();
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  const subj = createInbox();
  const sub = nc.subscribe(subj);
  const _ = (async () => {
    for await (const m of sub) {
      lock.unlock();
    }
  })();
  nc.publish(subj);
  await nc.flush();
  await lock;
  await nc.close();
  await ns.stop();
  t.pass();
});

test("basics - subscriptions pass exact subject to cb", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const s = createInbox();
  const subj = `${s}.foo.bar.baz`;
  const sub = nc.subscribe(`${s}.*.*.*`);
  const sp = deferred();
  const _ = (async () => {
    for await (const m of sub) {
      sp.resolve(m.subject);
      break;
    }
  })();
  nc.publish(subj);
  await nc.flush();

  t.is(await sp, subj);
  await nc.close();
  await ns.stop();
});

test("basics - subscribe returns Subscription", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const subj = createInbox();
  const sub = nc.subscribe(subj);
  t.is(sub.sid, 1);
  t.is(typeof sub.getReceived, "function");
  t.is(typeof sub.drain, "function");
  t.is(typeof sub.isClosed, "function");
  t.is(typeof sub.callback, "function");
  t.is(typeof sub.getSubject, "function");
  t.is(typeof sub.getID, "function");
  t.is(typeof sub.getMax, "function");
  await nc.close();
  await ns.stop();
});

test("basics - wildcard subscriptions", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const single = 3;
  const partial = 2;
  const full = 5;

  const s = createInbox();
  const sub = nc.subscribe(`${s}.*`);
  const sub2 = nc.subscribe(`${s}.foo.bar.*`);
  const sub3 = nc.subscribe(`${s}.foo.>`);

  nc.publish(`${s}.bar`);
  nc.publish(`${s}.baz`);
  nc.publish(`${s}.foo.bar.1`);
  nc.publish(`${s}.foo.bar.2`);
  nc.publish(`${s}.foo.baz.3`);
  nc.publish(`${s}.foo.baz.foo`);
  nc.publish(`${s}.foo.baz`);
  nc.publish(`${s}.foo`);

  await nc.drain();
  t.is(sub.getReceived(), single, "single");
  t.is(sub2.getReceived(), partial, "partial");
  t.is(sub3.getReceived(), full, "full");

  await ns.stop();
});

test("basics - correct data in message", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const sc = StringCodec();
  const subj = createInbox();
  const mp = deferred();
  const sub = nc.subscribe(subj);
  const _ = (async () => {
    for await (const m of sub) {
      mp.resolve(m);
      break;
    }
  })();

  nc.publish(subj, sc.encode(subj));
  const m = await mp;
  t.is(m.subject, subj);
  t.is(sc.decode(m.data), subj);
  t.is(m.reply, "");
  await nc.close();
  await ns.stop();
});

test("basics - correct reply in message", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const s = createInbox();
  const r = createInbox();

  const rp = deferred();
  const sub = nc.subscribe(s);
  const _ = (async () => {
    for await (const m of sub) {
      rp.resolve(m.reply);
      break;
    }
  })();
  nc.publish(s, Empty, { reply: r });
  t.is(await rp, r);
  await nc.close();
  await ns.stop();
});

test("basics - respond returns false if no reply subject set", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  let s = createInbox();
  const dr = deferred();
  const sub = nc.subscribe(s);
  const _ = (async () => {
    for await (const m of sub) {
      dr.resolve(m.respond());
      break;
    }
  })();
  nc.publish(s);
  const responded = await dr;
  t.false(responded);
  await nc.close();
  await ns.stop();
});

test("basics - closed cannot subscribe", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  await nc.close();
  await ns.stop();

  let failed = false;
  try {
    nc.subscribe(createInbox());
    t.fail("should have not been able to subscribe");
  } catch (err) {
    failed = true;
  }
  t.true(failed);
});

test("basics - close cannot request", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  await nc.close();
  await ns.stop();

  let failed = false;
  try {
    await nc.request(createInbox());
    t.fail("should have not been able to request");
  } catch (err) {
    failed = true;
  }
  t.true(failed);
});

test("basics - flush returns promise", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  let p = nc.flush();
  if (!p) {
    t.fail("should have returned a promise");
  }
  await p;
  t.pass();
  await nc.close();
  await ns.stop();
});

test("basics - unsubscribe after close", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  let sub = nc.subscribe(createInbox());
  await nc.close();
  sub.unsubscribe();

  await ns.stop();
  t.pass();
});

test("basics - unsubscribe stops messages", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const subj = createInbox();
  // in this case we use a callback otherwise messages are buffered.
  const sub = nc.subscribe(subj, {
    callback: () => {
      sub.unsubscribe();
    },
  });
  nc.publish(subj);
  nc.publish(subj);
  nc.publish(subj);
  nc.publish(subj);

  await nc.flush();
  t.is(sub.getReceived(), 1);
  await nc.close();
  await ns.stop();
});

test("basics - request", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const sc = StringCodec();
  const s = createInbox();
  const sub = nc.subscribe(s);
  const _ = (async () => {
    for await (const m of sub) {
      m.respond(sc.encode("foo"));
    }
  })();
  const msg = await nc.request(s);
  await nc.close();
  t.is(sc.decode(msg.data), "foo");
  await ns.stop();
});

test("basics - request timeout", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const s = createInbox();
  const lock = Lock();

  nc.request(s, Empty, { timeout: 100 })
    .then(() => {
      fail();
    })
    .catch((err) => {
      t.true(
        err.code === ErrorCode.Timeout || err.code === ErrorCode.NoResponders,
      );
      lock.unlock();
    });

  await lock;
  await nc.close();
  await ns.stop();
});

test("basics - request cancel rejects", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const s = createInbox();
  const lock = Lock();

  nc.request(s, Empty, { timeout: 1000 })
    .then(() => {
      t.fail();
    })
    .catch((err) => {
      t.is(err.code, ErrorCode.Cancelled);
      lock.unlock();
    });

  nc.protocol.muxSubscriptions.reqs.forEach((v) => {
    v.cancel();
  });
  await lock;
  await nc.close();
  await ns.stop();
});

test("basics - subscription with timeout", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const lock = Lock(1);
  const sub = nc.subscribe(createInbox(), { max: 1, timeout: 250 });
  (async () => {
    for await (const m of sub) {}
  })().catch((err) => {
    t.is(err.code, ErrorCode.Timeout);
    lock.unlock();
  });
  await lock;
  await nc.close();
  await ns.stop();
});

test("basics - subscription expecting 2 doesn't fire timeout", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const subj = createInbox();
  const sub = nc.subscribe(subj, { max: 2, timeout: 500 });
  (async () => {
    for await (const m of sub) {}
  })().catch((err) => {
    t.fail(err);
  });

  nc.publish(subj);
  await nc.flush();
  await delay(1000);

  t.is(sub.getReceived(), 1);
  await nc.close();
  await ns.stop();
});

test("basics - subscription timeout auto cancels", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const subj = createInbox();
  let c = 0;
  const sub = nc.subscribe(subj, { max: 2, timeout: 300 });
  (async () => {
    for await (const m of sub) {
      c++;
    }
  })().catch((err) => {
    t.fail(err);
  });

  nc.publish(subj);
  nc.publish(subj);
  await delay(500);
  t.is(c, 2);
  await nc.close();
  await ns.stop();
});

test("basics - no mux requests create normal subs", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const _ = nc.request(createInbox(), Empty, { timeout: 1000, noMux: true });
  t.is(nc.protocol.subscriptions.size(), 1);
  t.is(nc.protocol.muxSubscriptions.size(), 0);
  const sub = nc.protocol.subscriptions.get(1);
  t.truthy(sub);
  t.is(sub.max, 1);
  sub.unsubscribe();
  t.is(nc.protocol.subscriptions.size(), 0);
  await nc.close();
  await ns.stop();
});

test("basics - no mux requests timeout", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const lock = Lock();
  nc.request(createInbox(), Empty, { timeout: 250, noMux: true })
    .catch((err) => {
      t.true(
        err.code === ErrorCode.Timeout || err.code === ErrorCode.NoResponders,
      );
      lock.unlock();
    });
  await lock;
  await nc.close();
  await ns.stop();
});

test("basics - no mux requests", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const subj = createInbox();
  const sub = nc.subscribe(subj);
  const data = Uint8Array.from([1234]);
  (async () => {
    for await (const m of sub) {
      m.respond(data);
    }
  })().then();

  const m = await nc.request(subj, Empty, { timeout: 1000, noMux: true });
  t.deepEqual(Uint8Array.from(m.data), data);
  await nc.close();
  await ns.stop();
});

test("basics - no max_payload messages", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  t.truthy(nc.protocol.info.max_payload);
  const big = new Uint8Array(nc.protocol.info.max_payload + 1);

  const subj = createInbox();
  try {
    nc.publish(subj, big);
    t.fail();
  } catch (err) {
    t.is(err.code, ErrorCode.MaxPayloadExceeded);
  }

  try {
    const _ = await nc.request(subj, big);
    t.fail();
  } catch (err) {
    t.is(err.code, ErrorCode.MaxPayloadExceeded);
  }

  const sub = nc.subscribe(subj);
  (async () => {
    for await (const m of sub) {
      m.respond(big);
      t.fail();
    }
  })().catch((err) => {
    t.is(err.code, ErrorCode.MaxPayloadExceeded);
  });

  await nc.request(subj).then(() => {
    t.fail();
  }).catch((err) => {
    t.is(err.code, ErrorCode.Timeout);
  });

  await nc.close();
  await ns.stop();
});

test("basics - empty message", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const subj = createInbox();
  const mp = deferred();
  const sub = nc.subscribe(subj);
  const _ = (async () => {
    for await (const m of sub) {
      mp.resolve(m);
      break;
    }
  })();

  nc.publish(subj);
  const m = await mp;
  t.is(m.subject, subj);
  t.is(m.data.length, 0);
  await nc.close();
  await ns.stop();
});

test("basics - subject is required", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  t.plan(2);
  t.throws(() => {
    nc.publish();
  }, { code: ErrorCode.BadSubject });

  await nc.request().catch((err) => {
    t.is(err.code, ErrorCode.BadSubject);
  });

  await nc.close();
  await ns.stop();
});

test("basics - payload is only Uint8Array", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  t.throws(() => {
    nc.publish(createInbox(), "s");
  }, { code: ErrorCode.BadPayload });

  await nc.close();
  await ns.stop();
});

test("basics - disconnect reconnects", async (t) => {
  const ns = await NatsServer.start(wsConfig());
  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const lock = new Lock();
  const status = nc.status();
  (async () => {
    for await (const s of status) {
      switch (s.type) {
        case "reconnect":
          lock.unlock();
          break;
        default:
      }
    }
  })().then();

  nc.protocol.transport.disconnect();
  await lock;
  await nc.close();
  await ns.stop();
  t.pass();
});

test("basics - wss connection", async (t) => {
  const conf = {
    websocket: {
      port: -1,
      tls: tlsConfig(),
    },
  };

  const ns = await NatsServer.start(conf);
  const nc = await connect({ servers: `wss://127.0.0.1:${ns.websocket}` });
  await nc.flush();
  await nc.close();
  await ns.stop();
  t.pass();
});

test("basics - wsnats doesn't support tls options", async (t) => {
  const conf = {
    websocket: {
      port: -1,
      tls: tlsConfig(),
    },
  };
  const ns = await NatsServer.start(conf);
  try {
    await connect({ servers: `wss://127.0.0.1:${ns.websocket}`, tls: {} });
    t.fail(`should have failed with ${ErrorCode.InvalidOption}`);
  } catch (err) {
    t.is(err.code, ErrorCode.InvalidOption);
  }
  await ns.stop();
  t.pass();
});

test("basics - drain connection publisher", async (t) => {
  const ns = await NatsServer.start(wsConfig());

  const nc = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });
  const nc2 = await connect({ servers: `ws://127.0.0.1:${ns.websocket}` });

  const subj = createInbox();

  const lock = new Lock(5);
  nc2.subscribe(subj, {
    callback: (err, m) => {
      lock.unlock();
    },
  });
  await nc2.flush();

  for (let i = 0; i < 5; i++) {
    nc.publish(subj);
  }
  await nc.drain();
  await lock;
  await nc.close();
  t.pass();
});

test("basics - default connection", async (t) => {
  t.plan(1);
  if (process.env.GITHUB_ACTIONS) {
    t.log("skipping on github actions");
    t.pass();
    return;
  }

  const ns = await NatsServer.start(
    {
      websocket: {
        port: 443,
        tls: tlsConfig(),
      },
    },
  );
  const nc = await connect();
  try {
    const subj = createInbox();
    await nc.request(subj);
    t.fail("expected request to fail");
  } catch (err) {
    t.is(err.code, ErrorCode.NoResponders);
  }
  await nc.close();
  await ns.stop();
});
