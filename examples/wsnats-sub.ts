import {NatsConnection} from '../src/nats';

const browserEnv = require('browser-env');


browserEnv();

async function start() {
    let nc = await NatsConnection.connect({url: "ws://localhost:8080"});
    let sub = await nc.subscribe(">", (msg) => {
        console.log(`> ${msg.subject}: ${msg.data}`);
    });

    await new Promise((a, r) => {
    });
}

start();





