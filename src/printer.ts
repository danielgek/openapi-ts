import { Defenition, Enum, Options } from '.';
import { ident } from './utils';

export function printSpec(
  defenitions: Array<Defenition>,
  { identation }: Options,
) {
  const enumsList: { enum: Enum; interfaceName: string }[] = [];

  return (
    defenitions
      .map(({ name, properties, parents }) => {
        const filteredParents = (parents || []).filter(p => !!p) ;
        return `\nexport interface ${name} ${filteredParents.length ? `extends ${filteredParents.join(',')}` : ''} {${properties
          .map(({ name: propertyName, type, nullable, enums }) => {
            if (enums) {
              enumsList.push({ enum: enums, interfaceName: name });
              return `\n${ident(identation)}${propertyName}${
                (nullable && '?') || ''
              }: ${name}.${type};`;
            }
            return `\n${ident(identation)}${propertyName}${
              (nullable && '?') || ''
            }: ${type};`;
          })
          .join('')}\n}\n`;
      })
      .join('') + printEnums(enumsList, { identation })
  );
}

export function printEnums(
  enums: { enum: Enum; interfaceName: string }[],
  { identation }: Options,
) {
  return enums.reduce((acc, curr) => {
    return (acc +=
      `\nexport namespace ${curr.interfaceName} {` +
      `\n${ident(identation)}export enum ${
        curr.enum.name
      } {${curr.enum.options
        .map(
          (option) =>
            `\n${ident(identation) + ident(identation)}${option} = '${option}'`,
        )
        .join(',')}\n${ident(identation)}}\n}\n`);
  }, '');
}
