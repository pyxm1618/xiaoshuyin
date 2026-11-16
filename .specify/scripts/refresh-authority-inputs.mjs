#!/usr/bin/env node
import process from "node:process";
import {
  AUTHORITY_SNAPSHOT_PATH,
  writeAuthoritySnapshot,
} from "./authority-inputs.mjs";

writeAuthoritySnapshot(process.cwd());
console.log(`Refreshed ${AUTHORITY_SNAPSHOT_PATH} from the four authoritative Docs inputs`);
