import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

type SwaggerProp = SchemaObject & { optional?: boolean };

/** Builds an OpenAPI object schema from a flat prop map; fields are required unless `optional: true` is set. */
export function objectSchema(props: Record<string, SwaggerProp>): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];
  for (const [key, spec] of Object.entries(props)) {
    const { optional, ...rest } = spec;
    properties[key] = rest;
    if (!optional) required.push(key);
  }
  return required.length ? { type: 'object', properties, required } : { type: 'object', properties };
}

/** Builds an OpenAPI array-of-objects schema from a flat prop map (same shorthand as objectSchema). */
export function arraySchema(props: Record<string, SwaggerProp>): SchemaObject {
  return { type: 'array', items: objectSchema(props) };
}
