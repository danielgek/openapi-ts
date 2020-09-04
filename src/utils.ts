import { IdentationOptions } from ".";

export function getTypeFromRef(ref: string): string {
  return removeUnsupportedChars(
    ref.split('').reverse().join('').split('/')[0].split('').reverse().join(''),
  );
}

export function camelCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function ident(identation: IdentationOptions) {
  return identation === IdentationOptions.TABS ? '\t' : '  ';
}

export function removeUnsupportedChars(s?: string) {
  return (s && s.replace(/[^a-z0-9+]+/gi, '')) || '';
}
