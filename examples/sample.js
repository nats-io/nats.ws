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

async function test() {
    // if the connection fails an exception is thrown
    let nc = await nats.connect({url: "{{WSURL}}", payload: nats.Payload.STRING});

    // if the server returns an error, lets learn about it
    nc.addEventListener('error', (ex) => {
        console.log('server sent error: ', ex);
    });

    // if we disconnect from the server lets learn about it
    nc.addEventListener('close', () => {
        console.log('the connection closed');
    });

    // publish a message
    // <subject>, <body of the message>
    nc.publish('hello', 'nats');


    // publish a request - need a subscription listening
    // <subject>, <body of the message>, <reply subject>
    nc.publish('hello', 'world', 'say.hi');


    // simple subscription
    let sub = await nc.subscribe('help', (msg) => {
        if (msg.reply) {
            nc.publish(msg.reply, `I can help ${msg.data}`);
        }
    });

    // subscriptions can be serviced by a member of a queue
    // the options argument can also specify the 'max' number
    // messages before the subscription auto-unsubscribes
    let qsub = await nc.subscribe('urgent.help', (msg) => {
        if (msg.reply) {
            nc.publish(msg.reply, `I can help ${msg.data}`);
        }
    }, {queue: "urgent"});

    // simple request
    let msg = await nc.request('help', 1000, 'nats request');
    console.log(`I got a response: ${msg.data}`);

    // flushing
    await nc.flush();

    // stop listening for 'help' messages - you optionally specify
    // the number of messages you want before the unsubscribed
    // if the count has passed, the unsubscribe happens immediately
    sub.unsubscribe();
    qsub.unsubscribe();

    // close the connection
    nc.close();
}

test();