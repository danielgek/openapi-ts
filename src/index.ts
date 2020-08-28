#!/usr/bin/env node
import { parse } from '@apidevtools/swagger-parser';
import * as fs from 'fs';
import { OpenAPIV2, OpenAPIV3} from 'openapi-types';
export enum IdentationOptions {
  TABS = 'TABS',
  SPACES = 'SPACES'
}

interface Options {
  identation: IdentationOptions
}

interface Enum {
  name: string
  options: string[]
  namespace: string
}

interface Property{
  name: string;
  type: string;
  nullable?: boolean;
  enums?: Enum
}

interface Defenition {
  name: string,
  properties: Array<Property>
}


export function generate(input: string | string[], output: string, options: Options = { identation: IdentationOptions.TABS }) {
  if (Array.isArray(input)) {
    return Promise.all(input.map(i => parse(i))).then(documents => {
      savetoFile(
        documents.map(parseSpec(output, options)).map(spec => printSpec(spec, options)).join(''),
        output
      );
    })
  } else {
    return parse(input).then(parseSpec(output, options)).then(spec => savetoFile(printSpec(spec, options), output));
  }
  
}

function printSpec(defenitions: Array<Defenition>, { identation }: Options){
  const enumsList: { enum: Enum; interfaceName: string }[] = [];
  return defenitions.map(({name, properties}) => {
    return `\nexport interface ${name} {${
      properties.map(({name: propertyName, type, nullable, enums}) => {
          if(enums) {
            enumsList.push({enum: enums, interfaceName: name});
            return `\n${ident(identation)}${propertyName}${nullable && '?' || ''}: ${name}.${type};`;
          }
          return `\n${ident(identation)}${propertyName}${nullable && '?' || ''}: ${type};`;
        }).join('')
    }\n}\n`;
  }).join('') + printEnums(enumsList, {identation });
}

function printEnums(enums: { enum: Enum; interfaceName: string }[], { identation }: Options) {
  return enums.reduce((acc, curr) => {
    return acc += `\nexport namespace ${curr.interfaceName} {` +
      `\n${ident(identation)}export enum ${curr.enum.name} {${
        curr.enum.options.map(option =>  (`\n${ident(identation) + ident(identation)}${option} = '${option}'`)).join(',')
      }\n${ident(identation)}}\n}\n`
  }, '')

}


function savetoFile(content: string, path: any) {
  fs.writeFile(path, content, (err) => {
    if(err) {
        return console.log(err);
    }
    console.log("The file was saved!");
  });
}

function parseSpec(output: string, options: Options) {
  return (r: any): Array<Defenition> => {
      let defenitions: OpenAPIV2.DefinitionsObject | OpenAPIV3.ComponentsObject | undefined;
      if((r as OpenAPIV3.Document).openapi) {
        const schemas = (r as OpenAPIV3.Document).components?.schemas
        const interfaces = schemas && Object.keys(schemas).map((key) => {
            const name = removeUnsupportedChars(key);
            return {
              name,
              properties: parseSchema(key, schemas[key])
            }
        });
        return interfaces === undefined ? [] : interfaces;
      } else if ((r as OpenAPIV2.Document).swagger === '2.0') {
        defenitions = (r as OpenAPIV2.Document).definitions
        throw new Error('Not yet supported supported!!')
      } else {
        throw new Error('Your api spec version is not supported!!')
      }
    }
  
}

function parseSchema(name: string, schema: OpenAPIV3.ReferenceObject | OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject): Array<Property> {
  if((schema as OpenAPIV3.ReferenceObject).$ref) {
    // possibly dont do nothing here
    return [parseRef(name, schema as OpenAPIV3.ReferenceObject)];
  } else if((schema as any).type && (schema as any).type !== 'array') {
    const properties = (schema as OpenAPIV3.NonArraySchemaObject).properties
    if(properties) {
       return Object.keys(properties).map(key => {
         const property = properties[key]
         const name = removeUnsupportedChars(key);

        if((property as OpenAPIV3.ReferenceObject).$ref) {
          return parseRef(key, property as OpenAPIV3.ReferenceObject)
        }
        const p = property as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject;
        if(p.oneOf || p.anyOf || p.allOf) {
          return parseOfRelations(name, p);
        }
        
        return parsePrimitiveTypes(name, property as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject)

      })

    }
    return []
  }
  return []
}

function parseOfRelations(name: string, property: OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject): Property {
  if(property.allOf) {
    const types = property.allOf || [];
    return {
      name,
      type: types.reduce((acc, curr) => {
        const separator = acc.length && ' | ' || ''
        if((curr as OpenAPIV3.ReferenceObject).$ref) {
          return acc + separator + parseRef(name, curr as OpenAPIV3.ReferenceObject).type
        }else if((curr as OpenAPIV3.ArraySchemaObject).type === 'array') {
          return acc + separator + parseArray(name, curr as OpenAPIV3.ArraySchemaObject).type
        } else if(
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).anyOf ||
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).oneOf ||
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).allOf) {
            return acc + separator + parseOfRelations(name, curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).type
        } else {
          return acc + separator + parsePrimitiveTypes(name, curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).type
        }
      }, '') 
    }
  } else if(property.anyOf) {
    const types = property.anyOf || []
    return {
      name,
      type: types.reduce((acc, curr) => {
        const separator = acc.length && ' | ' || ''
        if((curr as OpenAPIV3.ReferenceObject).$ref) {
          return acc + separator + parseRef(name, curr as OpenAPIV3.ReferenceObject).type
        }else if((curr as OpenAPIV3.ArraySchemaObject).type === 'array') {
          return acc + separator + parseArray(name, curr as OpenAPIV3.ArraySchemaObject).type
        }else if(
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).anyOf ||
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).oneOf ||
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).allOf) {
            return acc + separator + parseOfRelations(name, curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).type
        }else {
          return acc + separator + parsePrimitiveTypes(name, curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).type
        }
      }, '') 
    }
  } else if(property.oneOf) {
    const types = property.oneOf || []
    return {
      name,
      type: types.reduce((acc, curr) => {
        const separator = acc.length && ' | ' || ''
        if((curr as OpenAPIV3.ReferenceObject).$ref) {
          return acc + separator + parseRef(name, curr as OpenAPIV3.ReferenceObject).type
        }else if((curr as OpenAPIV3.ArraySchemaObject).type === 'array') {
          return acc + separator + parseArray(name, curr as OpenAPIV3.ArraySchemaObject).type
        }else if(
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).anyOf ||
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).oneOf ||
          (curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).allOf) {
            return acc + separator + parseOfRelations(name, curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).type
        }else {
          return acc + separator + parsePrimitiveTypes(name, curr as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject).type
        }
      }, '') 
    }
  }
  return {
    name,
    type: 'any',
  } 
}

function parsePrimitiveTypes(name: string, property: OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject) {
  switch (property.type) {
    case 'array': return parseArray(name, property as OpenAPIV3.ArraySchemaObject);
    case 'number': return parseNumber(name, property as OpenAPIV3.NonArraySchemaObject);
    case 'boolean': return parseBoolean(name, property as OpenAPIV3.NonArraySchemaObject);
    case 'integer': return parseInteger(name, property as OpenAPIV3.NonArraySchemaObject);
    case 'object': return parseObject(name, property as OpenAPIV3.NonArraySchemaObject);
    case 'string': return parseString(name, property as OpenAPIV3.NonArraySchemaObject);
    default:
      console.error('Coulnt find a type for this property inside of ' + name, property)
      return {
        name,
        type: 'any',
      }
  }
}

function parseRef(name: string, schema: OpenAPIV3.ReferenceObject): Property {
  return {
    name,
    type: getTypeFromRef(schema.$ref),
  }
}

function parseArray(name: string, schema: OpenAPIV3.ArraySchemaObject): Property {
  const ref = (schema.items as OpenAPIV3.ReferenceObject).$ref;
  if (ref) {
    return {
      name,
      type: removeUnsupportedChars(getTypeFromRef(ref)) + '[]'
    }
  } else {
    const type = (schema.items as OpenAPIV3.SchemaObject).type

    return {
      name,
      type: (type === 'object' ? 'any' : type) + '[]'
    }
  }
}

function parseNumber(name: string, property: OpenAPIV3.NonArraySchemaObject): Property {
  return {
    name,
    type: 'number',
    nullable: property.nullable
  }
}

function parseBoolean(name: string, property: OpenAPIV3.NonArraySchemaObject): Property {
  return {
    name,
    type: 'boolean',
    nullable: property.nullable
  }
}

function parseInteger(name: string, property: OpenAPIV3.NonArraySchemaObject): Property {
  return {
    name,
    type: 'number',
    nullable: property.nullable
  }
}

function parseObject(name: string, property: OpenAPIV3.NonArraySchemaObject): Property {
  return {
    name,
    type: 'any',
    nullable: property.nullable
  }
}

function parseString(name: string, property: OpenAPIV3.NonArraySchemaObject): Property {
  if (property.enum) {
    const type = camelCase(name) + "Enum"
    return {
      name,
      type,
      nullable: property.nullable,
      enums: {
          name: type,
          options: property.enum,
          namespace: name
        }
      }
  }
  return {
    name,
    type: 'string',
    nullable: property.nullable
  }
}

function getTypeFromRef(ref: string): string {
  return removeUnsupportedChars(ref
    .split('')
    .reverse()
    .join('')
    .split('/')[0]
    .split('')
    .reverse()
    .join(''));
}

function camelCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function ident(identation: IdentationOptions) {
  return identation === IdentationOptions.TABS ? '\t' : '  ';
}

function removeUnsupportedChars(s?: string) {
  return s && s.replace(/[^a-z0-9+]+/gi, '') || '';
}
