import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import test from "ava";
import {Nuid} from 'js-nuid/src/nuid'
import {BINARY_PAYLOAD, connect, JSON_PAYLOAD, Msg, STRING_PAYLOAD} from "../src/nats";
import {Lock} from "./helpers/latch";
import {DataBuffer} from "../src/databuffer";

const nuid = new Nuid();


test.before(async (t) => {
    let server = await startServer();
    t.context = {server: server};
});

test.after.always((t) => {
    //@ts-ignore
    stopServer(t.context.server);
});

test('json types', async (t) => {
    t.plan(2);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, payload: JSON_PAYLOAD});
    let subj = nuid.next();
    nc.subscribe(subj, (msg: Msg) => {
        t.is(typeof msg.data, 'number');
        t.is(msg.data, 6691);
        lock.unlock();
    }, {max: 1});

    nc.publish(subj, 6691);
    nc.flush();
    return lock.latch;
});

test('string types', async (t) => {
    t.plan(2);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, payload: STRING_PAYLOAD});
    let subj = nuid.next();
    nc.subscribe(subj, (msg: Msg) => {
        t.is(typeof msg.data, "string");
        t.is(msg.data, "hello world");
        lock.unlock();
    }, {max: 1});

    nc.publish(subj, DataBuffer.fromAscii('hello world'));
    nc.flush();
    return lock.latch;
});

test('binary types', async (t) => {
    t.plan(2);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, payload: BINARY_PAYLOAD});
    let subj = nuid.next();
    nc.subscribe(subj, (msg: Msg) => {
        t.truthy(msg.data instanceof ArrayBuffer);
        t.is(DataBuffer.toAscii(msg.data), "hello world");
        lock.unlock();
    }, {max: 1});

    nc.publish(subj, DataBuffer.fromAscii('hello world'));
    nc.flush();
    return lock.latch;
});

test('binary encoded per client', async (t) => {
    t.plan(4);
    let lock = new Lock(2);

    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws, payload: BINARY_PAYLOAD});
    let nc2 = await connect({url: sc.server.ws, payload: STRING_PAYLOAD});
    let subj = nuid.next();
    nc1.subscribe(subj, (msg: Msg) => {
        t.truthy(msg.data instanceof ArrayBuffer);
        t.is(DataBuffer.toAscii(msg.data), "hello world");
        lock.unlock();
    }, {max: 1});

    nc2.subscribe(subj, (msg: Msg) => {
        t.is(typeof msg.data, "string");
        t.is(msg.data, "hello world");
        lock.unlock();
    }, {max: 1});
    await nc1.flush();
    await nc2.flush();

    nc2.publish(subj, 'hello world');
    return lock.latch;
});

test('binary client gets binary', async (t) => {
    t.plan(2);
    let lock = new Lock();

    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws, payload: BINARY_PAYLOAD});
    let subj = nuid.next();
    nc1.subscribe(subj, (msg: Msg) => {
        t.truthy(msg.data instanceof ArrayBuffer);
        t.is(DataBuffer.toAscii(msg.data), "hello world");
        lock.unlock();
    }, {max: 1});

    nc1.publish(subj, 'hello world');
    await nc1.flush();
    return lock.latch;
});