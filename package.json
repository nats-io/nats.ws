{
  "name": "nats.ws",
  "version": "1.0.0-110",
  "description": "WebSocket NATS client",
  "main": "nats.mjs",
  "types": "nats.d.ts",
  "files": [
    "examples/",
    "OWNERS.md",
    "CODE-OF-CONDUCT.md",
    "LICENSE",
    "nats.d.ts"
  ],
  "scripts": {
    "setup": "curl -fsSL https://deno.land/x/install/install.sh | sh",
    "build": "deno run --allow-all --unstable --reload src/mod.ts && deno bundle --unstable src/mod.ts ./nats.mjs",
    "prepack": "npm run build",
    "fmt": "deno fmt src/*.ts examples/*.js test/*.js test/*/*.js",
    "start-tls-nats": "cd examples && ../nats-server -DV -c tls.conf",
    "start-nats": "cd examples && ../nats-server -c nontls.conf",
    "start-http": "deno run --allow-all --unstable https://raw.githubusercontent.com/denoland/deno/master/std/http/file_server.ts .",
    "start-https": "deno run --allow-all --unstable https://raw.githubusercontent.com/denoland/deno/master/std/http/file_server.ts --port 4607 --cert ./certs/cert.pem --key ./certs/key.pem --host localhost .",
    "install-certs": "env CAROOT=./certs mkcert -cert-file ./certs/cert.pem -key-file ./certs/key.pem -install localhost 127.0.0.1 ::1",
    "install-ns": "mkdir -p ./.deps && cd ./.deps && git clone --branch=master https://github.com/nats-io/nats-server.git && cd nats-server && go build && mv nats-server ../../",
    "clone-nbc": "deno run --allow-all bin/clone-nd.ts",
    "cjs-nbc": "deno run --allow-all ./bin/cjs-fix-imports.ts -o nats-base-client/ ./.deps/nats.deno/nats-base-client/",
    "cjs-wst": "deno run --allow-all ./bin/cjs-fix-imports.ts -o wst/ ./src",
    "build-cjs": "tsc",
    "clean": "rm -Rf ./nats.mjs ./build ./.deps ./nats-base-client ./cjs-wst",
    "stage": "npm run clean && npm run clone-nbc && npm run cjs-nbc && npm run cjs-wst && rm -Rf ./.deps/ && npm run build-cjs && rm -Rf ./wst",
    "ava": "nyc ava --verbose -T 60000",
    "test": "npm run stage && npm run ava",
    "debug-test": "node node_modules/.bin/ava --verbose -T 6500000 --match"
  },
  "devDependencies": {
    "@types/node": "^14.6.0",
    "ava": "^3.11.1",
    "browser-env": "^3.3.0",
    "minimist": "^1.2.5",
    "nkeys.js": "^1.0.0-5",
    "nyc": "^15.1.0",
    "tslint": "^6.1.3",
    "typescript": "^3.9.7"
  },
  "ava": {
    "failFast": true,
    "files": [
      "./test/**/*.js",
      "!./test/index.d.ts",
      "!./test/index.js",
      "!./test/helpers/**/*.js",
      "!./test/migrate/**/*.js"
    ],
    "require": [
      "./test/helpers/setup-browser-env.js"
    ]
  },
  "nyc": {
    "extension": [
      ".ts",
      ".js"
    ],
    "include": [
      "src/**/*.ts",
      "build/**/*.js",
      "nats-base-client/**/*.ts"
    ],
    "exclude": [
      "nats-base-client/bench.ts",
      "nats-base-client/codec.ts",
      "nats-base-client/databuffer.ts",
      "nats-base-client/denobuffer.ts",
      "nats-base-client/headers.ts",
      "nats-base-client/muxsubscription.ts",
      "nats-base-client/nkeys.ts",
      "nats-base-client/nuid.ts",
      "nats-base-client/parser.ts",
      "nats-base-client/queued_iterator.ts",
      "nats-base-client/servers.ts",
      "nats-base-client/transport.ts",
      "nats-base-client/util.ts",
      "test/**",
      "examples/**"
    ],
    "sourceMap": true,
    "all": true
  },
  "repository": {
    "type": "git",
    "url": "git@github.com:nats-io/nats.ws.git"
  },
  "bugs": {
    "url": "https://github.com/nats-io/nats.ws/issues"
  },
  "keywords": [
    "NATS",
    "websockets"
  ],
  "author": {
    "name": "The NATS Authors"
  },
  "license": "Apache-2.0"
}
