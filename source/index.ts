#!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../package.json';

const program = new Command();

program
  .name('sentient')
  .description('Sentient CLI')
  .version(version);

program
  .command('hello')
  .description('Print a greeting')
  .option('-n, --name <name>', 'Your name', 'world')
  .action((opts: { name: string }) => {
    console.log(`Hello, ${opts.name}!`);
  });

program.parseAsync();
