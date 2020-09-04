# NATS - Websocket Javascript Client for the Browser


A websocket client for the [NATS messaging system](https://nats.io).

[![License](https://img.shields.io/badge/Licence-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/dm/nats.ws.svg)](https://www.npmjs.com/package/nats.ws)


## Installation

>** :warning: NATS.ws is a preview** you can get the current development version by:

```bash
npm install nats.ws
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

## Documentation

NATS.ws shares all client API and examples with 
[nats.deno repo](https://github.com/nats-io/nats.deno)


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
    { servers: "localhost:9222", ws: true },
  );

  // connects via wss://
  const wssConn = await connect(
    { servers: "localhost:9222"}
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


