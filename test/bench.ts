import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import test from "ava";
import {connect} from "../src/nats";
import {Lock} from "./helpers/latch";


test.before(async (t) => {
    let server = await startServer();
    t.context = {server: server};
});

test.after.always((t) => {
    //@ts-ignore
    stopServer(t.context.server);
});

let max = 10000;
test(`pubsub`, async (t) => {
    t.plan(1);
    let lock = new Lock(max);
    let count = 0;
    let start = 0;
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let sub = await nc.subscribe("foo", (msg) => {
        lock.unlock();
        count++;
        if (count >= max) {
            let time = Date.now() - start;
            t.log(time + "ms");
            t.log(((max * 2) / (time / 1000)) + ' msgs/sec');
            t.pass();
        }
    }, {max: max});

    nc.flush();
    start = Date.now();
    let data = 0;
    let flushes = 0;
    for (let i = 0; i < max; i++) {
        nc.publish('foo');
        if (i % 2000 === 0) {
            data += nc.protocol.outbound.size();
            flushes++;
            await nc.flush();
        }
    }
    t.log(`flushes: ${flushes} bytes: ${data} ${data / flushes}`);
    return lock.latch;
});


test(`pub`, async (t) => {
    t.plan(1);
    let lock = new Lock(max);
    let count = 0;
    let start = 0;
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    nc.flush();
    start = Date.now();
    let data = 0;
    let flushes = 0;
    for (let i = 0; i < max; i++) {
        nc.publish('foo');
        if (i % 1000 === 0) {
            data += nc.protocol.outbound.size();
            flushes++;
            await nc.flush();
        }
        lock.unlock();
    }
    await lock.latch;
    await nc.flush();
    let time = Date.now() - start;
    t.log(time + "ms");
    t.log((max / (time / 1000)) + ' msgs/sec');
    t.pass();

    t.log(`flushes: ${flushes} bytes: ${data} ${data / flushes}`);
    nc.flush()
});