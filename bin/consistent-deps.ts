/*
 * Copyright 2021 The NATS Authors
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
import {
  extname,
  join,
  resolve,
} from "https://deno.land/std@0.74.0/path/mod.ts";

const importers = new Map<string, string[]>();

async function getInternalReferences(fn: string): Promise<string[]> {
  const found: string[] = [];

  const data = await Deno.readFile(fn);
  const txt = new TextDecoder().decode(data);
  const matches = txt.matchAll(
    /("https:\/\/raw.githubusercontent.com\/nats-io\/nats.deno\/(\S+)\/nats-base-client\/internal_mod.ts")/g,
  );
  for (const m of matches) {
    found.push(m[0]);
  }
  return found;
}

async function check(dir: string) {
  const r = resolve(dir);
  await Deno.lstat(r)
    .catch((err) => {
      console.error(`${r} was not found`);
      Deno.exit(1);
    });

  // find all files in the directory
  const files: string[] = [];
  for await (const fn of Deno.readDir(r)) {
    const ext = extname(fn.name);
    if (ext === ".ts" || ext === ".js") {
      files.push(join(r, fn.name));
    }
  }

  // check for the import in source files
  for (const fn of files) {
    const data = await Deno.readFile(fn);
    const txt = new TextDecoder().decode(data);
    const matches = txt.matchAll(
      /("https:\/\/raw.githubusercontent.com\/nats-io\/nats.deno\/(\S+)\/nats-base-client\/internal_mod.ts")/g,
    );
    const lines = await getInternalReferences(fn);
    if (lines.length > 0) {
      importers.set(fn, lines);
    }
  }
}

await check("./src");
await check("./test");

// process the results looking for mismatches
if (importers.size === 0) {
  console.error(`nats-base-client imports not found`);
  Deno.exit(1);
}

// expected lib
const expected = await getInternalReferences(
  resolve("./src/nats-base-client.ts"),
);
if (expected.length === 0) {
  console.error(`nats-base-client imports not found`);
  Deno.exit(1);
}

const errs: string[] = [];
let first = "";
importers.forEach((v, k) => {
  v.forEach((vv) => {
    if (vv !== expected[0]) {
      errs.push(`${k}: ${vv}`);
    }
  });
});

if (errs.length > 0) {
  console.error(`[ERROR] expected all nbc imports to be ${expected[0]}:`);
  console.error(errs.join("\n"));
  Deno.exit(1);
} else {
  console.info(`[OK] all nbc imports match ${expected[0]}:`);
}
