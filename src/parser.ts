import { OpenAPIV2, OpenAPIV3 } from 'openapi-types';
import { Defenition, Property, Options } from '.';
import { removeUnsupportedChars, getTypeFromRef, camelCase } from './utils';

type ArrayOrObject =
  | OpenAPIV3.ArraySchemaObject
  | OpenAPIV3.NonArraySchemaObject;

export function parseSpec(output: string, options: Options) {
  return (r: any): Array<Defenition> => {
    let defenitions:
      | OpenAPIV2.DefinitionsObject
      | OpenAPIV3.ComponentsObject
      | undefined;
    if ((r as OpenAPIV3.Document).openapi) {
      const schemas = (r as OpenAPIV3.Document).components?.schemas;
      const interfaces: Defenition[] | undefined =
        schemas &&
        Object.keys(schemas).map((key) => {
          const name = removeUnsupportedChars(key);
          const schema = schemas[key];
          if ((schema as ArrayOrObject).allOf) {
            return {
              name,
              properties: parseSchema(key, schema),
              parents: (schema as ArrayOrObject).allOf!.map((item) => {
                const ref = (item as OpenAPIV3.ReferenceObject).$ref;
                if (ref) {
                  return getTypeFromRef(ref);
                }
                return ''
              }),
            };
          }
        
          return {
            name,
            properties: parseSchema(key, schema),
          };
        });
      return interfaces === undefined ? [] : interfaces;
    } else if ((r as OpenAPIV2.Document).swagger === '2.0') {
      defenitions = (r as OpenAPIV2.Document).definitions;
      throw new Error('Not yet supported supported!!');
    } else {
      throw new Error('Your api spec version is not supported!!');
    }
  };
}

function parseSchema(
  name: string,
  schema: OpenAPIV3.ReferenceObject | ArrayOrObject,
): Array<Property> {
  if ((schema as OpenAPIV3.ReferenceObject).$ref) {
    // possibly dont do nothing here
    return [parseRef(name, schema as OpenAPIV3.ReferenceObject)];
  } else if ((schema as any).type && (schema as any).type !== 'array') {
    const properties = (schema as OpenAPIV3.NonArraySchemaObject).properties;
    if (properties) {
      return Object.keys(properties).map((key) => {
        const property = properties[key];
        const name = removeUnsupportedChars(key);

        if ((property as OpenAPIV3.ReferenceObject).$ref) {
          return parseRef(key, property as OpenAPIV3.ReferenceObject);
        }
        const p = property as ArrayOrObject;
        if (p.oneOf || p.anyOf) {
          return parseOfRelations(name, p);
        }

        return parsePrimitiveTypes(name, property as ArrayOrObject);
      });
    }
    return [];
  }
  return [];
}

function parseOfRelations(name: string, property: ArrayOrObject): Property {
  if (property.allOf) {
    const types = property.allOf || [];
    return {
      name,
      type: types.reduce((acc, curr) => {
        const separator = (acc.length && ' | ') || '';
        if ((curr as OpenAPIV3.ReferenceObject).$ref) {
          return (
            acc +
            separator +
            parseRef(name, curr as OpenAPIV3.ReferenceObject).type
          );
        } else if ((curr as OpenAPIV3.ArraySchemaObject).type === 'array') {
          return (
            acc +
            separator +
            parseArray(name, curr as OpenAPIV3.ArraySchemaObject).type
          );
        } else if (
          (curr as ArrayOrObject).anyOf ||
          (curr as ArrayOrObject).oneOf ||
          (curr as ArrayOrObject).allOf
        ) {
          return (
            acc + separator + parseOfRelations(name, curr as ArrayOrObject).type
          );
        } else {
          return (
            acc +
            separator +
            parsePrimitiveTypes(name, curr as ArrayOrObject).type
          );
        }
      }, ''),
    };
  } else if (property.anyOf) {
    const types = property.anyOf || [];
    return {
      name,
      type: types.reduce((acc, curr) => {
        const separator = (acc.length && ' | ') || '';
        if ((curr as OpenAPIV3.ReferenceObject).$ref) {
          return (
            acc +
            separator +
            parseRef(name, curr as OpenAPIV3.ReferenceObject).type
          );
        } else if ((curr as OpenAPIV3.ArraySchemaObject).type === 'array') {
          return (
            acc +
            separator +
            parseArray(name, curr as OpenAPIV3.ArraySchemaObject).type
          );
        } else if (
          (curr as ArrayOrObject).anyOf ||
          (curr as ArrayOrObject).oneOf ||
          (curr as ArrayOrObject).allOf
        ) {
          return (
            acc + separator + parseOfRelations(name, curr as ArrayOrObject).type
          );
        } else {
          return (
            acc +
            separator +
            parsePrimitiveTypes(name, curr as ArrayOrObject).type
          );
        }
      }, ''),
    };
  } else if (property.oneOf) {
    const types = property.oneOf || [];
    return {
      name,
      type: types.reduce((acc, curr) => {
        const separator = (acc.length && ' | ') || '';
        if ((curr as OpenAPIV3.ReferenceObject).$ref) {
          return (
            acc +
            separator +
            parseRef(name, curr as OpenAPIV3.ReferenceObject).type
          );
        } else if ((curr as OpenAPIV3.ArraySchemaObject).type === 'array') {
          return (
            acc +
            separator +
            parseArray(name, curr as OpenAPIV3.ArraySchemaObject).type
          );
        } else if (
          (curr as ArrayOrObject).anyOf ||
          (curr as ArrayOrObject).oneOf ||
          (curr as ArrayOrObject).allOf
        ) {
          return (
            acc + separator + parseOfRelations(name, curr as ArrayOrObject).type
          );
        } else {
          return (
            acc +
            separator +
            parsePrimitiveTypes(name, curr as ArrayOrObject).type
          );
        }
      }, ''),
    };
  }
  return {
    name,
    type: 'any',
  };
}

function parsePrimitiveTypes(name: string, property: ArrayOrObject) {
  switch (property.type) {
    case 'array':
      return parseArray(name, property as OpenAPIV3.ArraySchemaObject);
    case 'number':
      return parseNumber(name, property as OpenAPIV3.NonArraySchemaObject);
    case 'boolean':
      return parseBoolean(name, property as OpenAPIV3.NonArraySchemaObject);
    case 'integer':
      return parseInteger(name, property as OpenAPIV3.NonArraySchemaObject);
    case 'object':
      return parseObject(name, property as OpenAPIV3.NonArraySchemaObject);
    case 'string':
      return parseString(name, property as OpenAPIV3.NonArraySchemaObject);
    default:
      console.error(
        'Coulnt find a type for this property inside of ' + name,
        property,
      );
      return {
        name,
        type: 'any',
      };
  }
}

function parseRef(name: string, schema: OpenAPIV3.ReferenceObject): Property {
  return {
    name,
    type: getTypeFromRef(schema.$ref),
  };
}

function parseArray(
  name: string,
  schema: OpenAPIV3.ArraySchemaObject,
): Property {
  const ref = schema.items && (schema.items as OpenAPIV3.ReferenceObject).$ref;
  if (ref) {
    return {
      name,
      type: removeUnsupportedChars(getTypeFromRef(ref)) + '[]',
    };
  } else if (schema.items && (schema.items as ArrayOrObject).type) {
    const type = (schema.items as OpenAPIV3.SchemaObject).type;
    return {
      name,
      type: (type === 'object' ? 'any' : type) + '[]',
    };
  } else if (schema.items && Array.isArray(schema.items)) {
    const items = schema.items as OpenAPIV3.NonArraySchemaObject;

    return {
      name,
      type: schema.items
        .map((i) => {
          if (i.$ref) {
            return getTypeFromRef(i.$ref);
          }
          return parsePrimitiveTypes(name, i);
        })
        .join(' | '),
    };

  } else if (schema.items && !Array.isArray(schema.items)) {
    if ((schema.items as ArrayOrObject).anyOf) {
      return {
        name,
        type:
          (schema.items as ArrayOrObject).anyOf
            ?.map((item) =>
              getTypeFromRef((item as OpenAPIV3.ReferenceObject).$ref),
            )
            .join(' | ') || '',
      };
    } else if ((schema.items as ArrayOrObject).oneOf) {
      return {
        name,
        type:
          (schema.items as ArrayOrObject).oneOf
            ?.map((item) =>
              getTypeFromRef((item as OpenAPIV3.ReferenceObject).$ref),
            )
            .join(' | ') || '',
      };
    }

    return {
      name,
      type: 'asdasd',
    };
  } else if (schema.anyOf) {
    const anyOf = (schema as OpenAPIV3.ArraySchemaObject).anyOf;
    if (anyOf) {
      return {
        name,
        type: anyOf
          .map((a) => {
            if ((a as OpenAPIV3.ReferenceObject).$ref) {
              return getTypeFromRef((a as OpenAPIV3.ReferenceObject).$ref);
            }
        
            return 'stupid';
          })
          .join(' | '),
      };
    }
    return {
      name,
      type: 'asdasd',
    };
  } else if (schema.allOf) {
    const allOf = (schema as OpenAPIV3.ArraySchemaObject).allOf;
    if (allOf) {
      return {
        name,
        type: allOf
          .map((a) => {
            if ((a as OpenAPIV3.ReferenceObject).$ref) {
              return getTypeFromRef((a as OpenAPIV3.ReferenceObject).$ref);
            }
        
            return 'stupid';
          })
          .join(' | '),
      };
    }
    return {
      name,
      type: 'asdasd',
    };
  } else if (
    schema.items &&
    (schema.items as OpenAPIV3.NonArraySchemaObject).oneOf
  ) {
    const oneOf = (schema.items as OpenAPIV3.NonArraySchemaObject).oneOf;
    if (Array.isArray(oneOf)) {
      return {
        name,
        type: oneOf
          .map((a) => {
            if ((a as OpenAPIV3.ReferenceObject).$ref) {
              return getTypeFromRef((a as OpenAPIV3.ReferenceObject).$ref);
            }
        
            return 'stupid';
          })
          .join(' | '),
      };
    }

    return {
      name,
      type: 'stupid 2 ',
    };
  }

  return {
    name,
    type: 'stupid 4 ',
  };
}

function parseNumber(
  name: string,
  property: OpenAPIV3.NonArraySchemaObject,
): Property {
  return {
    name,
    type: 'number',
    nullable: property.nullable,
  };
}

function parseBoolean(
  name: string,
  property: OpenAPIV3.NonArraySchemaObject,
): Property {
  return {
    name,
    type: 'boolean',
    nullable: property.nullable,
  };
}

function parseInteger(
  name: string,
  property: OpenAPIV3.NonArraySchemaObject,
): Property {
  return {
    name,
    type: 'number',
    nullable: property.nullable,
  };
}

function parseObject(
  name: string,
  property: OpenAPIV3.NonArraySchemaObject,
): Property {
  return {
    name,
    type: 'any',
    nullable: property.nullable,
  };
}

function parseString(
  name: string,
  property: OpenAPIV3.NonArraySchemaObject,
): Property {
  if (property.enum) {
    const type = camelCase(name) + 'Enum';
    return {
      name,
      type,
      nullable: property.nullable,
      enums: {
        name: type,
        options: property.enum,
        namespace: name,
      },
    };
  }
  return {
    name,
    type: 'string',
    nullable: property.nullable,
  };
}
