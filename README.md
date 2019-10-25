# OpenApi/Swagger to Typescript defenitions!

This tool generates typescript interfaces/Enums  to all entities that you specified on swagger/openapi spec

**Note:** this generates **only** interfaces and Enums

## Installation
```
npm install -g openapi-ts
```

## Generating types
```
openapi-ts -i ./src/api-docs.json -o ./gen.d.ts
```

