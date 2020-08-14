#!/usr/bin/env node
import { parse } from '@apidevtools/swagger-parser';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types';

const enums: { [key: string]: Enum } = {};
interface Enum {
  [key: string]: any;
}

export function generate(input: string, output: string) {
  const inputPath = path.isAbsolute(input)
    ? input
    : `${process.cwd()}/${input}`;
  const outputPath = path.isAbsolute(output)
    ? output
    : `${process.cwd()}/${output}`;
  return parse(inputPath).then(
    (r) => {
      debugger;
      let ts = '';
      Object.keys(
        (r as any).definitions as OpenAPIV2.DefinitionsObject,
      ).forEach((key) => {
        ts += printObject({ ...(r as any).definitions[key], title: key });
      });
      ts = `${ts} ${printEnums(enums)}`;

      fs.writeFile(outputPath, ts, (err) => {
        if (err) {
          return console.log(err);
        }
        console.log('The file was saved!');
      });
      return ts;
    },
    (e) => {
      console.log(e);
    },
  );
}

function printEnums(interfaces: { [key: string]: Enum }) {
  return Object.keys(interfaces)
    .map((interfaceKey) => {
      return `\nexport namespace ${interfaceKey} {${Object.keys(
        interfaces[interfaceKey],
      )
        .map((enumkey) => {
          if (typeof interfaces[interfaceKey][enumkey] !== 'string') {
            return `\n\texport type ${camelCase(enumkey)}Enum = ${interfaces[
              interfaceKey
            ][enumkey].map((key: string, index: number, arr: []) => `'${key}'${index !== arr.length - 1 && ' |' || ';'}`).join(' ')}`
          }
          return `\n\texport enum ${camelCase(enumkey)}Enum {${interfaces[
            interfaceKey
          ][enumkey].map((key: string) => `\n\t    ${key} = '${key}'`)}\n\t}`;
        })
        .join('')}\n}`;
    })
    .join('');
}

function printObject(object: OpenAPIV2.SchemaObject) {
  debugger;
  return `export interface ${object.title?.replace(/[^a-z0-9+]+/gi, '')} {${
    object.properties
      ? Object.keys(object.properties)
          .map((propertyKey) => {
            if (object.properties) {
              const property = object.properties[propertyKey];
              return (
                printProperty(property, propertyKey, object.title || '') + ';'
              );
            }
          })
          .join('')
      : ''
  }\n}\n`;
}

function printProperty(
  property: OpenAPIV2.SchemaObject,
  propertyKey: string,
  interfaceName: string,
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
      return `\n    ${propertyKey}?: any`;
    case 'integer':
      return `\n    ${propertyKey}?: number`;
    case 'array':
      if (property.items) {
        if (property.items.type) {
          return `\n    ${propertyKey}?: ${property.items.type}[]`;
        }
        if (property.items.$ref) {
          return `\n    ${propertyKey}?: ${getTypeFromRef(
            property.items.$ref,
          )}[]`;
        }
      }
      return `\n    ${propertyKey}?: any[]`;
    case 'string':
      if (property.enum) {
        enums[interfaceName] = {
          ...(enums[interfaceName] !== undefined ? enums[interfaceName] : {}),
          [propertyKey]: property.enum,
        };
        return `\n    ${propertyKey}?: ${interfaceName}.${camelCase(
          propertyKey,
        )}Enum`;
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
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
