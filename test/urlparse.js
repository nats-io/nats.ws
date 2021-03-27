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
const { wsUrlParseFn } = require("../lib/src/connect.js");

test("url - parse", (t) => {
  const u = [
    { in: "foo", expect: "wss://foo:443/" },
    { in: "foo:100", expect: "wss://foo:100/" },
    { in: "foo/", expect: "wss://foo:443/" },
    { in: "foo/hello", expect: "wss://foo:443/hello" },
    { in: "foo:100/hello", expect: "wss://foo:100/hello" },
    { in: "foo/hello?one=two", expect: "wss://foo:443/hello?one=two" },
    { in: "foo:100/hello?one=two", expect: "wss://foo:100/hello?one=two" },
    { in: "nats://foo", expect: "ws://foo:80/" },
    { in: "tls://foo", expect: "wss://foo:443/" },
    { in: "ws://foo", expect: "ws://foo:80/" },
    { in: "ws://foo:100", expect: "ws://foo:100/" },
    {
      in: "[2001:db8:1f70::999:de8:7648:6e8]",
      expect: "wss://[2001:db8:1f70:0:999:de8:7648:6e8]:443/",
    },
    {
      in: "[2001:db8:1f70::999:de8:7648:6e8]:100",
      expect: "wss://[2001:db8:1f70:0:999:de8:7648:6e8]:100/",
    },
  ];

  t.plan(u.length);

  u.forEach((tc) => {
    const out = wsUrlParseFn(tc.in);
    t.is(out, tc.expect, `test ${tc.in}`);
  });
});
