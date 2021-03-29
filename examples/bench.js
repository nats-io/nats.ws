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

import { Bench, connect, Metric } from "../nats.js";

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
  } else if (isChecked("req")) {
    return "req";
  }
}

function getNumber(id) {
  const v = getString(id);
  if (!isNaN(v)) {
    return parseInt(v, 10);
  }
  return -1;
}

function updateResults(s) {
  const p = document.createElement("pre");
  p.appendChild(document.createTextNode(s));
  document.getElementById("results").appendChild(p);
}

async function run() {
  const server = getString("server");
  const ws = isChecked("ws");
  const nc = await connect(
    {
      servers: `${ws ? "ws://" : "wss://"}${server}`,
      pendingLimit: 8192,
    },
  );
  nc.closed()
    .then((err) => {
      if (err) {
        console.error(err);
      }
    });

  const kind = getTestChoice();
  const t = {};
  t.callbacks = isChecked("callbacks");
  t.msgs = getNumber("count");
  t.size = getNumber("payload");
  t.subject = getString("subject");
  t.pub = kind === "pub" || kind === "pubsub";
  t.sub = kind === "sub" || kind === "pubsub";
  t.req = kind === "req";

  const bench = new Bench(nc, t);
  const m = await bench.run();
  const metrics = [];
  metrics.push(...m);
  await nc.close();

  const pubsub = metrics.filter((m) => m.name === "pubsub").reduce(
    reducer,
    new Metric("pubsub", 0),
  );
  const pub = metrics.filter((m) => m.name === "pub").reduce(
    reducer,
    new Metric("pub", 0),
  );
  const sub = metrics.filter((m) => m.name === "sub").reduce(
    reducer,
    new Metric("sub", 0),
  );
  const req = metrics.filter((m) => m.name === "req").reduce(
    reducer,
    new Metric("req", 0),
  );

  const report = [];

  if (pubsub && pubsub.msgs) {
    report.push(pubsub.toString());
  }
  if (pub && pub.msgs) {
    report.push(pub.toString());
  }
  if (sub && sub.msgs) {
    report.push(sub.toString());
  }
  if (req && req.msgs) {
    report.push(req.toString());
  }
  updateResults(report.join("\n"));
}

const reducer = (a, m) => {
  if (a) {
    a.name = m.name;
    a.payload = m.payload;
    a.bytes += m.bytes;
    a.duration += m.duration;
    a.msgs += m.msgs;
    a.lang = m.lang;
    a.version = m.version;
    a.async = m.async;

    a.max = Math.max((a.max === undefined ? 0 : a.max), m.duration);
    a.min = Math.min((a.min === undefined ? m.duration : a.max), m.duration);
  }
  return a;
};

window.benchapp = {
  run: run,
};
