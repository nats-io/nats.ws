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
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let sub = await nc.subscribe("foo", (msg) => {
        lock.unlock();
        count++;
        if (count >= max) {
            t.pass();
        }
    }, {max: max});

    nc.flush();
    for (let i = 0; i < max; i++) {
        nc.publish('foo');
    }
    return lock.latch;
});


test(`pub`, async (t) => {
    t.plan(1);
    let lock = new Lock(max);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    nc.flush();
    for (let i = 0; i < max; i++) {
        nc.publish('foo');
        lock.unlock();
    }
    await lock.latch;
    await nc.flush();
    t.pass();
});