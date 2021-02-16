/*
 * Copyright 2020-2021 The NATS Authors
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
import { parse } from "https://deno.land/std@0.74.0/flags/mod.ts";
import { join, resolve } from "https://deno.land/std@0.74.0/path/mod.ts";

const argv = parse(
  Deno.args,
  {
    default: {
      lib: "./src/nats-base-client.ts",
      dir: "./.deps",
    },
    string: ["mod", "dir"],
  },
);

// resolve the nats-base-client version used by the library so we can clone the project
const lib = resolve(argv.lib);
const dir = resolve(argv.dir);

await Deno.lstat(lib)
  .catch((err) => {
    console.error(`${lib} was not found`);
    Deno.exit(1);
  });

await Deno.lstat(dir)
  .then(async () => {
    await Deno.remove(join(dir, "nats.deno"), { recursive: true });
  })
  .catch(async () => {
    Deno.mkdir(dir)
      .catch((err) => {
        console.error(`error creating ${dir}: ${err.message}`);
        Deno.exit(1);
      });
  });

const data = await Deno.readFile(lib);
const txt = new TextDecoder().decode(data);
const m = txt.match(
  /(export \* from\s+"https:\/\/raw.githubusercontent.com\/nats-io\/nats.deno\/(\S+)\/nats-base-client\/internal_mod.ts")/m,
);
if (!m) {
  console.error(`nats-base-client import not found in ${lib}`);
  Deno.exit(1);
}

console.log(`matched branch ${m[2]}`);

const git = Deno.run({
  cwd: dir,
  cmd: [
    "git",
    "clone",
    `--branch=${m[2]}`,
    "https://github.com/nats-io/nats.deno.git",
  ],
});

git.status()
  .then(() => {
    console.log("OK");
  })
  .catch((err: Error) => {
    console.error(`cloning nats.deno on branch ${m[2]} failed: ${err.message}`);
    Deno.exit(1);
  });
