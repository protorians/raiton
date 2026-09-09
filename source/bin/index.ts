#!/usr/bin/env bun
import "reflect-metadata"
import CLI from "./cli.ts";
import bootstrapper from "./bootstrapper.ts";

bootstrapper(CLI)