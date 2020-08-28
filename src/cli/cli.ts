#!/usr/bin/env node
import * as program from 'commander';
import { generate } from '..';
import * as path from 'path';
program.version('0.3.3');

program.option('-i, --input <file>', 'Json file with spec');
program.option('-o, --output <file>', 'Json file with spec');
program.option('-s, --spacing <type>', 'tabs or spaces');
program.parse(process.argv);
const inputPath = path.isAbsolute(program.input)
    ? program.input
    : `${process.cwd()}/${program.input}`;
const outputPath = path.isAbsolute(program.output)
    ? program.output
    : `${process.cwd()}/${program.output}`;
generate(inputPath, outputPath)
