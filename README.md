# OpenApi/Swagger to TypeScript definitions!

This tool generates TypeScript interfaces/Enums to all entities that you specified on swagger/openapi spec.

**Note:** this generates **only** interfaces and Enums

## Installation

```
npm install --save-dev openapi-ts
```

## Generating types (CLI)

```bash
npx openapi-ts -i ./src/api-docs.json -o ./gen.d.ts
```

## Generating types (javascript module)

```javascript
const { generate } = require('openapi-ts');

generate(openAPISpecPath, outputPath);
```
