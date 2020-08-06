# NATS - Websocket Javascript Client for the Browser


A websocket client for the [NATS messaging system](https://nats.io).

[![License](https://img.shields.io/badge/Licence-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/dm/nats.ws.svg)](https://www.npmjs.com/package/nats.ws)


## Changes since original preview

> :warning: The API for the NATS.ws library has evolved since its initial preview.
> The current changes modify how the library delivers messages and notifications, so if you had
> developed with the initial preview, you'll need to update your code.

 - Packaging is now an ES Module
 - `subscribe()` returns a Subscription
 - Subscription objects are async iterators, callbacks are no longer supported.
 - Lifecycle notifications are via async iterator `status()`
 - Close notification is now in the form of a promise provided by `closed()`
 - Message payloads are always `Uint8Arrays`, to encode/decode to strings or JSON use `StringCodec` or `JSONCodec`, alternatively use `TextEncoder/Decoder`
 - Publisher signatures have changed to `publish(subject: string, data?: Uint8Array, options?: {reply?: string, headers?: MsgHdrs})`
 - [Request signatures have changed to `request(subject: string, data?: Uint8Array, options?: {timeout: number, headers?: MsgHdrs})`
 - `addEventListener()` for getting lifecycle events has been removed. The async iterator `status()` is the mechanism for receiving connection change updates.
 - `closed(): Promise<void|Error>` returns a promise that resolves when the client closes. If the promise _resolves_ to an error, the error is the reason for the close.

## Installation

>** :warning: NATS.ws is a preview** you can get the current development version by:

```bash
npm install nats.ws@beta2
```

Getting started with NATS.ws requires a little of preparation:

- You'll need a recent NATS server that supports websockets
- An HTTP server to serve HTML and the nats library

To make it easy, the nats.ws github repo aids you with this setup, however you'll need a few simple requirements installed.
If you are on windows, you'll need to look at the package.json for hints on what to do.

Here are the steps:


```bash
# clone the nats.ws repository:
git clone https://github.com/nats-io/nats.ws.git

# install [deno](https://deno.land):
npm run setup

# build the library
npm run build

# install the master of nats-server, if you have 
# [Go](https://golang.org/doc/install) installed,
# you can easily clone and build the latest from
# master:
npm run install-ns

# start the built nats-server:
npm run start-nats

# start an http server to serve the content in
# the examples directory:
npm run start-http

# point your browser to: http://localhost:4507/examples
# click on one of the HTML files

```


## Importing the Module
nats.ws is an async nats client. The model a standard ES Module. Copy the nats.mjs 
module from node_modules (if you didn't build it yourself), and place it where you 
can reference it from your code:

```html
<script type="module">
  // load the library
  import { connect } from './nats.mjs'
  // do something with it...
</script>
```

After this initial step, all the documentation on how to use the client
is shared with the [nats.deno repo](https://github.com/nats-io/nats.deno).

## Connection Options Specific to nats.ws

By default, the nats-server will serve WSS connections only.
The current architecture of nats.deno and nats.ws will soon be
removing the `url` connection field in favor of `servers`.

There are two reasons for this change. First, URL embedded authentication
credentials are not globally supported in non HTTP/S protocols.

Secondly, connection protocols are not gossiped on cluster information. 
To specify a `ws://`  connection, the connection option `ws` must be set to `true`.
Otherwise the client will always attempt to connect via `wss://`


```typescript
  // connects via ws://
  const conn = await connect(
    { url: "localhost:9222", ws: true },
  );

  // connects via wss://
  const wssConn = await connect(
    { url: "localhost:9222"}
  )
```

## Web Application Examples

For various examples of using NATS in the browser, checkout [examples](examples).

## Contributing

NATS.ws uses [deno](https://deno.land) to build and package the ES Module for the library.
The library shares client functionality with [NATS.deno](https://github.com/nats-io/nats.deno).
This means that both the NATS.deno and NATS.ws use the same exact code base, only differing
on the implementation of the `Transport`. This strategy greatly reduces the amount of work 
required to develop and maintain the clients.

Currently, the base client implementation is the deno implementation. You can take
a look at it [here](https://github.com/nats-io/nats.deno/tree/main/nats-base-client).


