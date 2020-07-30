/*
 * Copyright 2018 The NATS Authors
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
import { connect, Payload } from "./nats.mjs";

const test = async function () {
  // if the connection fails an exception is thrown
  const nc = await connect(
    { url: "wss://localhost:9222", payload: Payload.STRING, debug: true },
  );
  document.write("<pre>connected</pre>");

  nc.closed().then((err) => {
    let m = "NATS connection closed";
    document.write(`<pre>${m} ${err ? ":" + err.message : ""}</pre>`);
  });

  // publish a message
  // <subject>, <body of the message>
  nc.publish("hello", "nats");
  document.write("<pre>published hello</pre>");

  // publish a request - need a subscription listening
  // <subject>, <body of the message>, <reply subject>
  nc.publish("hello", "world", { reply: "say.hi" });
  document.write("<pre>published a request for help</pre>");

  // simple subscription
  const sub = nc.subscribe("help");
  (async () => {
    for await (const m of sub) {
      if (m.respond(`I can help ${m.data}`)) {
        document.write("<pre>got a request for help</pre>");
      }
    }
  })().then();

  // subscriptions can be serviced by a member of a queue
  // the options argument can also specify the 'max' number
  // messages before the subscription auto-unsubscribes
  const qsub = nc.subscribe("urgent.help", { queue: "urgent" });
  (async () => {
    for await (const m of qsub) {
      if (m.respond(`I can help ${m.data}`)) {
        document.write("<pre>got an urgent request for help</pre>");
      }
    }
  })().then();

  // simple request
  const msg = await nc.request("help", 1000, "nats request");
  document.write(`<pre>I got a response: ${msg.data}</pre>`);

  const msg2 = await nc.request("urgent.help", 1000, "urgent nats request");
  document.write(
    `<pre>I got a response to my urgent request: ${msg2.data}</pre>`,
  );

  // flushing
  await nc.flush();

  // stop listening for 'help' messages - you optionally specify
  // the number of messages you want before the unsubscribed
  // if the count has passed, the unsubscribe happens immediately
  sub.unsubscribe();
  document.write("<pre>unsubscribed from help</pre>");
  qsub.unsubscribe();
  document.write("<pre>unsubscribed from urgent.help</pre>");

  // close the connection
  await nc.close();
  document.write("<pre>closed connection</pre>");
};

test();
