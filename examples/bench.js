/*
 * Copyright 2020 The NATS Authors
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

import { connect, Empty } from "../nats.mjs";

function getString(id) {
  return document.getElementById(id).value;
}

function isChecked(id) {
  return document.getElementById(id).checked;
}

function getTestChoice() {
  if (isChecked("pubsub")) {
    return "pubsub";
  } else if (isChecked("pub")) {
    return "pub";
  } else if (isChecked("sub")) {
    return "sub";
  } else if (isChecked("reqrep")) {
    return "reqrep";
  }
}

function getNumber(id) {
  const v = getString(id);
  if (!isNaN(v)) {
    return parseInt(v, 10);
  }
  return -1;
}

function setResults(s) {
  document.getElementById("results").innerHTML = s;
}

async function run() {
  const test = getTestChoice();
  switch (test) {
    case "pub":
      pub();
      break;
    case "sub":
      sub();
      break;
    case "pubsub":
      pubsub();
      break;
    case "reqrep":
      reqrep();
      break;
  }
}

window.benchapp = {
  run: run,
};

function getOpts() {
  return {
    server: getString("server"),
    ws: isChecked("ws"),
    subject: getString("subject"),
    count: getNumber("count"),
    start: 0,
    end: 0,
    payload: getPayload(),
    debug: true,
  };
}

function getPayload() {
  const size = getNumber("payload");
  if (size) {
    const ba = new Uint8Array(size);
    window.crypto.getRandomValues(ba);
    return ba;
  }
  return undefined;
}

function formatReport(test, opts) {
  const time = opts.end - opts.start;
  const count = Number(opts.count).toLocaleString();
  const times = Number(time).toLocaleString();
  const rps = parseInt(opts.count / (time / 1000), 10);
  const rate = Number(rps).toLocaleString();

  return `${test} ${count} msgs in ${times} ms (${rate} msgs/sec)`;
}

async function pub() {
  const opts = getOpts();
  try {
    debugger;
    setResults("working...");
    const nc = await connect({ servers: opts.server, ws: opts.ws });
    nc.closed()
      .then((err) => {
        if (err) {
          console.error(err);
        }
      });
    opts.start = Date.now();
    for (let i = 0; i < opts.count; i++) {
      nc.publish(opts.subject, opts.payload);
    }
    await nc.flush();
    opts.end = Date.now();
    nc.close();
    setResults(formatReport("pub", opts));
  } catch (ex) {
    setResults(ex);
  }
}

async function sub() {
  const opts = getOpts();
  try {
    const nc = await connect({ servers: opts.server, ws: opts.ws });
    nc.closed()
      .then((err) => {
        if (err) {
          console.error(err);
        }
      });

    let received = 0;
    const sub = nc.subscribe(opts.subject, { max: opts.count });
    setResults("waiting for messages...");

    const _ = (async () => {
      opts.start = Date.now();
      setResults("working...");

      for await (const m of sub) {
        received++;
      }
      opts.end = Date.now();
      nc.close();
      setResults(formatReport("sub", opts));
    })();
    await nc.flush();
  } catch (ex) {
    setResults(ex);
  }
}

async function pubsub() {
  const opts = getOpts();
  try {
    setResults("working...");
    const nc = await connect({ servers: opts.server, ws: opts.ws });

    let received = 0;
    const sub = nc.subscribe(opts.subject, { max: opts.count });
    nc.closed()
      .then((err) => {
        if (err) {
          console.error(err);
        }
      });

    const _ = (async () => {
      opts.start = Date.now();
      setResults("working...");

      for await (const m of sub) {
        received++;
      }
      opts.end = Date.now();
      nc.close();
      setResults(formatReport("pubsub", opts));
    })();

    nc.flush();
    opts.start = Date.now();
    for (let i = 0; i < opts.count; i++) {
      nc.publish(opts.subject, opts.payload);
    }
  } catch (ex) {
    setResults(ex);
  }
}

async function reqrep() {
  const opts = getOpts();
  try {
    setResults("working...");
    console.log(`ws? ${opts.ws}`);
    const nc = await connect({ servers: opts.server, ws: opts.ws });
    nc.closed()
      .then((err) => {
        if (err) {
          console.error(err);
        }
      });

    const sub = nc.subscribe(opts.subject, { max: opts.count });
    const _ = (async () => {
      for await (const m of sub) {
        m.respond();
      }
    })();
    await nc.flush();

    const futures = [];
    opts.start = Date.now();
    for (let i = 0; i < opts.count; i++) {
      const f = nc.request(opts.subject, Empty, { timeout: 200000 });
      futures.push(f);
    }
    await Promise.all(futures);
    opts.end = Date.now();
    setResults(formatReport("reqrep", opts));
  } catch (ex) {
    setResults(ex);
  }
}
