import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import test from "ava";
import {connect} from "../src/nats";
import {Lock} from "./helpers/latch";
import {ParserState} from "../src/protocol";


test.beforeEach(async (t) => {
    let server = await startServer();
    t.context = {server: server};
});

test.after.always((t) => {
    stopServer((t.context as SC).server);
});


test('close handler is called on close', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.addEventListener('close', () => {
        t.pass();
        lock.unlock();
    });

    stopServer((t.context as SC).server);
    return lock.latch;
});

test('close process inbound ignores', async (t) => {
    t.plan(2);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.addEventListener('close', () => {
        t.pass();
        t.is(ParserState.CLOSED, nc.protocol.state);
        lock.unlock();
    });

    stopServer((t.context as SC).server);
    return lock.latch;
});