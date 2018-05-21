import test from "ava";
import {ClientHandlers, ProtocolHandler, Sub} from "../src/protocol";
import {NatsConnectionOptions} from "../src/nats";

test('split messages correctly', (t) => {
    return new Promise((resolve) => {
        t.plan(4);
        let expected = 3;
        let processed = 0;

        let protocol = new ProtocolHandler({} as NatsConnectionOptions, {} as ClientHandlers);
        protocol.infoReceived = true;
        let data = 'MSG test.foo 1 11\r\nHello World\r\nMSG test.bar 1 11\r\nHello World\r\nMSG test.baz 1 11\r\nHello World\r\nPONG\r\n';
        protocol.inbound.fill(data);

        let s = {} as Sub;
        s.sid = 1;
        s.subject = "test.*";
        s.callback = (msg => {
            processed++;
            t.is(msg.data, "Hello World");
            if (processed === expected) {
                t.pass();
                resolve();
            }
        });

        protocol.subscriptions.add(s);
        protocol.processInbound();
    });
});