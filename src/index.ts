#!/usr/bin/env node
import { parse } from '@apidevtools/swagger-parser';
import * as fs from 'fs';
import { parseSpec } from './parser';

import { printSpec } from './printer';

export enum IdentationOptions {
  TABS = 'TABS',
  SPACES = 'SPACES'
}

export interface Options {
  identation: IdentationOptions
}

export interface Enum {
  name: string
  options: string[]
  namespace: string
}

export interface Property{
  name: string;
  type: string;
  nullable?: boolean;
  enums?: Enum
}

export interface Defenition {
  name: string,
  properties: Array<Property>
  parents?: string[];
}


export function generate(input: string | string[], output: string, options: Options = { identation: IdentationOptions.TABS }) {
  if (Array.isArray(input)) {
    return Promise.all(input.map(i => parse(i))).then(documents => {
      const interfaces = documents.map(parseSpec(output, options)).map(spec => printSpec(spec, options)).join('');
      savetoFile(
        interfaces,
        output
      );
    })
  } else {
    return parse(input).then(parseSpec(output, options)).then(spec => savetoFile(printSpec(spec, options), output));
  }
  
}


function savetoFile(content: string, path: any) {
  fs.writeFile(path, content, (err) => {
    if(err) {
        return console.log(err);
    }
    console.log("The file was saved!");
  });
}



