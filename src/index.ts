#!/usr/bin/env node
import { parse } from 'swagger-parser';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types';
import * as program from 'commander';
program.version('0.0.1');

program.option('-i, --input <file>', 'Json file with spec');
program.option('-o, --output <file>', 'Json file with spec');
program.parse(process.argv);

run(program.input, program.output)

const enums: Enum = {};
interface Enum {
  [key: string]: string[];
}

function run(input: string, output: string) {
  const inputPath = path.isAbsolute(input) ? input : `${process.cwd()}/${input}`
  const outputPath = path.isAbsolute(output) ? output : `${process.cwd()}/${output}`
  parse(inputPath).then(
    r => {
      let ts = '';
      Object.values((r as any)
        .definitions as OpenAPIV2.DefinitionsObject).forEach(entity => {
        ts += printObject(entity);
      });
      ts = `${ts} ${printEnums(enums)}`;

      fs.writeFile(outputPath, ts, (err) => {
        if (err) {
          return console.log(err);
        }
        console.log('The file was saved!');
      })
    },
    e => {
      console.log(e);
    },
  );
}
function printEnums(enums: Enum) {
  return Object.keys(enums).map(enumkey => {
    return `\nexport enum ${camelCase(enumkey)}Enum {${
      enums[enumkey].map(key => (`\n    ${key} = '${key}'`))
    }\n}`;
  }).join('');
}
function printObject(object: OpenAPIV2.SchemaObject) {
  return `export interface ${object.title} {${
    object.properties ?
      Object.keys(object.properties).map(propertyKey => {
        if (object.properties) {
          const property = object.properties[propertyKey];
          return printProperty(property, propertyKey) + ';';
        }
      }).join('')
      : ''
    }\n}\n`;
}

function printProperty(
  property: OpenAPIV2.SchemaObject,
  propertyKey: string,
): string {
  switch (property.type) {
    case 'object':
      if (property.additionalProperties) {
        const ref = (property.additionalProperties as OpenAPIV3.ReferenceObject)
          .$ref;
        if (ref) {
          return `\n    ${propertyKey}?: ${getTypeFromRef(ref)}`;
        }
      }
      return `\n    ${propertyKey}?: any`
    case 'integer':
      return `\n    ${propertyKey}?: number`;
    case 'array':
      if (property.items) {
        if (property.items.type) {
          return `\n    ${propertyKey}?: ${property.items.type}[]`;
        }
        if (property.items.$ref) {
          return `\n    ${propertyKey}?: ${getTypeFromRef(property.items.$ref)}[]`;
        }
      }
      return `\n    ${propertyKey}?: any[]`
    case 'string':
      if (property.enum) {
        enums[propertyKey] = property.enum;
        return `\n    ${propertyKey}?: ${camelCase(propertyKey)}Enum`;
      } else {
        return `\n    ${propertyKey}?: ${property.type}`;
      }
    default:
      if (property.$ref) {
        return `\n    ${propertyKey}?: ${getTypeFromRef(property.$ref)}`;
      } else {
        return `\n    ${propertyKey}?: ${property.type}`;
      }
  }
}

function getTypeFromRef(ref: string): string {
  return ref
    .split('')
    .reverse()
    .join('')
    .split('/')[0]
    .split('')
    .reverse()
    .join('');
}

function camelCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

