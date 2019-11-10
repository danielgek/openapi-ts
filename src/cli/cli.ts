import * as program from 'commander';
import { generate } from '..';
program.version('0.2.3');

program.option('-i, --input <file>', 'Json file with spec');
program.option('-o, --output <file>', 'Json file with spec');
program.parse(process.argv);

generate(program.input, program.output)
