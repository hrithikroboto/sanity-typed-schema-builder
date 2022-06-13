import { z } from "zod";

import { preview } from "../field";
import { createType } from "../types";

import type {
  FieldOptionKeys,
  FieldsType,
  InferFieldsZod,
  Preview,
} from "../field";
import type { SanityType, TypeValidation } from "../types";
import type { Faker } from "@faker-js/faker";
import type { Schema } from "@sanity/types";

type ZodObjectNamed<
  ObjectNames extends string,
  Fields extends FieldsType<any, any>
> = InferFieldsZod<Fields> extends z.ZodObject<infer T, any, any, any, any>
  ? z.ZodObject<z.extendShape<T, { _type: z.ZodLiteral<ObjectNames> }>>
  : never;

interface ObjectNamedType<
  ObjectNames extends string,
  Fields extends FieldsType<any, any>,
  Zod extends ZodObjectNamed<ObjectNames, Fields>
> extends SanityType<
    TypeValidation<Schema.ObjectDefinition, z.input<Zod>> & {
      name: ObjectNames;
    },
    Zod
  > {
  ref: () => SanityType<
    Omit<Schema.TypeReference<any>, FieldOptionKeys> & { type: ObjectNames },
    Zod
  >;
}

export const objectNamed = <
  ObjectNames extends string,
  Fields extends FieldsType<any, any>,
  // eslint-disable-next-line @typescript-eslint/ban-types -- All other values assume keys
  Select extends Record<string, string> = {}
>({
  name,
  preview: previewDef,
  fields: { schema: fieldsSchema, mock: fieldsMock, zod: fieldsZod },
  mock = (faker, path) => ({
    ...(fieldsMock(path) as z.input<InferFieldsZod<Fields>>),
    _type: name,
  }),
  ...def
}: Omit<
  TypeValidation<
    Schema.ObjectDefinition,
    z.input<ZodObjectNamed<ObjectNames, Fields>>
  >,
  "fields" | "name" | "preview" | "type"
> & {
  fields: Fields;
  mock?: (
    faker: Faker,
    path: string
  ) => z.input<ZodObjectNamed<ObjectNames, Fields>>;
  name: ObjectNames;
  preview?: Preview<z.input<ZodObjectNamed<ObjectNames, Fields>>, Select>;
}): ObjectNamedType<
  ObjectNames,
  Fields,
  ZodObjectNamed<ObjectNames, Fields>
> => {
  const zod = (fieldsZod as InferFieldsZod<Fields>).extend({
    _type: z.literal(name),
  }) as unknown as ZodObjectNamed<ObjectNames, Fields>;

  return {
    ...createType({
      mock,
      zod,
      schema: () => {
        const schemaForFields = fieldsSchema();

        return {
          ...def,
          name,
          type: "object",
          fields: schemaForFields,
          preview: preview(previewDef, schemaForFields),
        };
      },
    }),
    ref: () =>
      createType({
        mock,
        zod,
        schema: () => ({ type: name }),
      }),
  };
};
