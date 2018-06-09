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

test ('from empty', (t) => {
    t.plan(1);
    //@ts-ignore
    let a = DataBuffer.fromAscii(undefined);
    t.is(0, a.byteLength);
});