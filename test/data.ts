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

import test from "ava";
import {DataBuffer} from "../src/databuffer";


test('empty', (t) => {
    t.plan(4);

    let buf = new DataBuffer();
    //@ts-ignore
    buf.fill(undefined);

    t.is(0, buf.length());
    t.is(0, buf.size());
    t.is(0, buf.drain(1000).byteLength);
    t.is(0, buf.peek().byteLength);

});


test('simple', (t) => {
    t.plan(6);

    let buf = new DataBuffer();
    buf.fill(DataBuffer.fromAscii("Hello"));
    buf.fill(DataBuffer.fromAscii(" "));
    buf.fill(DataBuffer.fromAscii("World"));
    t.is(3, buf.length());
    t.is(11, buf.size());
    let p = buf.peek();
    t.is(11, p.byteLength);
    t.is("Hello World", DataBuffer.toAscii(p));
    let d = buf.drain();
    t.is(11, d.byteLength);
    t.is("Hello World", DataBuffer.toAscii(d));
});

test('from empty', (t) => {
    t.plan(1);
    //@ts-ignore
    let a = DataBuffer.fromAscii(undefined);
    t.is(0, a.byteLength);
});