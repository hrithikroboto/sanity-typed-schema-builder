# sanity-typed-schema-builder

Build [Sanity schemas](https://www.sanity.io/docs/content-modelling) declaratively and get typescript types of schema values for free!

- Typescript types for Sanity Values!
- [Zod](https://zod.dev/) schemas for parsing & transforming values (most notably, `datetime` values into javascript `Date`)!
- Generated [Faker](https://fakerjs.dev/guide/) mock values!
- _ALL_ types are inferred! No messing with generics or awkward casting.

## Install

```bash
npm install sanity-typed-schema-builder
```

## Usage

```typescript
import { s } from "sanity-typed-schema-builder";

const foo = s.document({
  name: "foo",
  fields: [
    {
      name: "foo",
      type: s.string(),
    },
    {
      name: "bar",
      type: s.array({
        of: [s.datetime(), s.number({ readOnly: true })],
      }),
    },
    {
      name: "hello",
      optional: true,
      type: s.object({
        fields: [
          {
            name: "world",
            type: s.number(),
          },
        ],
      }),
    },
  ],
});

// Use schemas in Sanity
export default createSchema({
  name: "default",
  types: [foo.schema()],
});
```

Your sanity client's return values can be typed with `s.infer`:

```typescript
import sanityClient from "@sanity/client";

const client = sanityClient(/* ... */);

// results are automatically typed from the schema!
const result: s.infer<typeof foo> = await client.fetch(`* [_type == "foo"][0]`);

/**
 *  typeof result === {
 *    _createdAt: string;
 *    _id: string;
 *    _rev: string;
 *    _type: "foo";
 *    _updatedAt: string;
 *    bar: (string | number)[];
 *    foo: string;
 *    hello?: {
 *      world: number;
 *    };
 *  };
 **/
```

Because sanity returns JSON values, some values require conversion (ie changing most date strings into `Date`s). This is available with `.parse`:

```typescript
const parsedValue: s.output<typeof foo> = foo.parse(result);

/**
 *  typeof parsedValue === {
 *    _createdAt: Date;
 *    _id: string;
 *    _rev: string;
 *    _type: "foo";
 *    _updatedAt: Date;
 *    bar: (Date | number)[];
 *    foo: string;
 *    hello?: {
 *      world: number;
 *    };
 *  };
 **/
```

Mocks that match your schema can be generated with `.mock`:

```typescript
// Use @faker-js/faker to create mocks for tests!
import { faker } from "@faker-js/faker";

const mock = foo.mock(faker);

/**
 *  Same type as s.infer<typeof foo>
 *
 *  typeof mock === {
 *    _createdAt: string;
 *    _id: string;
 *    _rev: string;
 *    _type: "foo";
 *    _updatedAt: string;
 *    bar: (string | number)[];
 *    foo: string;
 *    hello?: {
 *      world: number;
 *    };
 *  };
 **/
```

## Type Definitions

All methods pass through their corresponding [Schema Type Properties](https://www.sanity.io/docs/schema-types) as-is. For example, `s.string(def)` takes the usual properties of the sanity string type. Sanity's types documentation should "just work" with these types.

The notable difference is between how the sanity schema, the `type` property, and the `name`/`title`/`description` property are defined. The differentiator is that the `s.*` methods replace the `type`s, not the entire field:

```typescript
// This is how schemas are defined in sanity
const schema = {
  type: "document",
  name: "foo",
  fields: [
    {
      name: "bar",
      type: "string",
    },
  ],
};

// This is the corresponding type in sanity-typed-schema-builder
const type = s.document({
  name: "foo",
  fields: [
    {
      name: "bar",
      type: s.string(),
    },
  ],
});

// INVALID!!!
const invalidType = s.document({
  name: "foo",
  fields: [
    // This is invalid. s.string is a type, not an entire field.
    s.string({
      name: "bar",
    }),
  ],
});
```

Exceptions to that are [`s.document`](#document) (because all documents are named and not nested) and [`s.objectNamed`](#object-named) (because named objects have unique behavior from nameless objects).

### Types with Fields

For types with `fields` (ie [`s.document`](#document), [`s.object`](#object), [`s.objectNamed`](#object-named), [`s.file`](#file), and [`s.image`](#image)) there are a few nuances:

#### `fields` are required by default

All `fields` are required by default (rather than sanity's default, which is optional by default). You can set it to optional with `optional: true`. This includes:

- zod parsing
- sanity validation
- Generated zod types.

```typescript
const type = s.object({
  fields: [
    {
      name: "foo",
      type: s.number(),
    },
    {
      name: "bar",
      optional: true,
      type: s.number(),
    },
  ],
});

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   foo: number;
 *   bar?: number;
 * }
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === {
 *   foo: number;
 *   bar?: number;
 * }
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "object",
 *   fields: [
 *     {
 *       name: "foo",
 *       type: "number",
 *       validation: (Rule) => Rule.validation(),
 *     },
 *     {
 *       name: "bar",
 *       type: "number",
 *     },
 *   ],
 * };
 */
```

## Parsing and zod

Due to sanity's transport layer being JSON (and whatever reason `slug` has for being wrapped in an object), some of sanity's return values require some transformation in application logic. Every type includes a `.parse(value)` method that transforms values to a more convenient value.

We accomplish that using [Zod](https://zod.dev/), a powerful schema validation library with full typescript support. A few of the types have default transformations (most notably [`s.datetime`](#datetime) parsing into a javascript `Date` object). The zod types are available for customization, allowing your own transformations.

```typescript
const type = s.document({
  name: "foo",
  // If you dislike the dangling underscore on `_id`, this transforms it to `id`:
  zod: (zod) => zod.transform(({ _id: id, ...doc }) => ({ id, ...doc })),
  fields: [
    {
      name: "aString",
      type: s.string(),
    },
    {
      name: "aStringLength",
      type: s.string({
        // For whatever reason, if you want the length of the string instead of the string itself:
        zod: (zod) => zod.transform((value) => value.length),
      }),
    },
    {
      name: "aDateTime",
      type: s.datetime(),
    },
    {
      name: "aSlug",
      type: s.slug(),
    },
  ],
});

const value: type Value === {
  /* ... */
};

/**
 * This remains the same:
 *
 * typeof value === {
 *   _createdAt: string;
 *   _id: string;
 *   _rev: string;
 *   _type: "foo";
 *   _updatedAt: string;
 *   aString: string;
 *   aStringLength: string;
 *   aDateTime: string;
 *   aSlug: {
 *     _type: "slug";
 *     current: string;
 *   };
 * }
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * Notice the changes:
 *
 * typeof parsedValue === {
 *   _createdAt: string;
 *   _rev: string;
 *   _type: "foo";
 *   _updatedAt: string;
 *   id: string;
 *   aString: string;
 *   aStringLength: number;
 *   aDateTime: Date;
 *   aSlug: string;
 * }
 */
```

## Mocking

Sanity values are used directly in react components or application code that needs to be tested. While tests tend to need mocks that are specific to isolated tests, autogenerated mocks are extremely helpful. Every type includes a `.mock(faker)` method that generates mocks of that type.

We accomplish that using [Faker](https://fakerjs.dev/guide/), a powerful mocking library with full typescript support. All of the types have default mocks. The mock methods are available for customization, allowing your own mocks.

Note: Each type will create it's own instance of `Faker` with a `seed` based on it's path in the document, so mocked values for any field should remain consistent as long as it remains in the same position.

```typescript
import { faker } from "@faker-js/faker";

const type = s.document({
  name: "foo",
  fields: [
    {
      name: "aString",
      type: s.string(),
    },
    {
      name: "aFirstName",
      type: s.string({
        mock: (faker) => faker.name.firstName(),
      }),
    },
  ],
});

const value = type.mock(faker);

/**
 * typeof value === {
 *   _createdAt: string;
 *   _id: string;
 *   _rev: string;
 *   _type: "foo";
 *   _updatedAt: string;
 *   aString: string;
 *   aFirstName: string;
 * }
 *
 * value.aString === "Seamless"
 * value.aFirstName === "Katelynn"
 */
```

## Resolving Mocks

Sanity values often reference something outside of itself, most notably [`s.reference`](#reference) referencing other documents. Applications determine how those resolutions happen (in the case of `s.reference`, usually via groq queries) but tests that require resolved values shouldn't rebuild that logic. Every type includes a `.resolve(value)` method that resolves mocks of that type.

We accomplish that using [Zod](https://zod.dev/), a powerful schema validation library with full typescript support. All of the types have default resolutions. The resolution methods are available for customization, allowing your own resolution.

```typescript
import { faker } from "@faker-js/faker";

const barType = s.document({
  name: "bar",
  fields: [
    {
      name: "value",
      type: s.string(),
    },
  ],
});

const nonSanityMocks: Record<string, NonSanity> = {
  /* ... */
};

const type = s.document({
  name: "foo",
  fields: [
    {
      name: "bar",
      type: s.reference({ to: [barType] }),
    },
    {
      name: "aString",
      type: s.string(),
    },
    {
      name: "nonSanity",
      type: s.string({
        zodResolved: (zod) => zod.transform((value) => nonSanityMocks[value]!),
      }),
    },
  ],
});

const value = type.resolve(type.mock(faker));

/**
 * typeof value === {
 *   _createdAt: Date;
 *   _id: string;
 *   _rev: string;
 *   _type: "foo";
 *   _updatedAt: Date;
 *   bar: {
 *     _createdAt: Date;
 *     _id: string;
 *     _rev: string;
 *     _type: "foo";
 *     _updatedAt: Date;
 *     value: string;
 *   };
 *   aString: string;
 *   nonSanity: NonSanity;
 * }
 */
```

## Types

All methods correspond to a [Schema Type](https://www.sanity.io/docs/schema-types) and pass through their corresponding properties as-is with the exceptions noted in [Type Definitions](#type-definitions).

### Array

All [array type](https://www.sanity.io/docs/array-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

Other exceptions include `min`, `max`, and `length`. These values are used in the zod validations, the sanity validations, and the inferred types.

```typescript
const type = s.array({
  of: [s.boolean(), s.datetime()],
});

type Value = s.infer<typeof type>;

/**
 * type Value === (boolean | string)[];
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === (boolean | Date)[];
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "array",
 *   of: [{ type: "boolean" }, { type: "datetime" }],
 *   ...
 * };
 */
```

```typescript
const type = s.array({
  min: 1,
  of: [s.boolean()],
});

type Value = s.infer<typeof type>;

/**
 * type Value === [boolean, ...boolean[]];
 */
```

```typescript
const type = s.array({
  max: 2,
  of: [s.boolean()],
});

type Value = s.infer<typeof type>;

/**
 * type Value === [] | [boolean] | [boolean, boolean];
 */
```

```typescript
const type = s.array({
  min: 1,
  max: 2,
  of: [s.boolean()],
});

type Value = s.infer<typeof type>;

/**
 * type Value === [boolean] | [boolean, boolean];
 */

const type = s.array({
  length: 3,
  of: [s.boolean()],
});

type Value = s.infer<typeof type>;

/**
 * type Value === [boolean, boolean, boolean];
 */
```

### Block

All [block type](https://www.sanity.io/docs/block-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

```typescript
const type = s.block();

type Value = s.infer<typeof type>;

/**
 * type Value === PortableTextBlock;
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === PortableTextBlock;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "block",
 *   ...
 * };
 */
```

### Boolean

All [boolean type](https://www.sanity.io/docs/boolean-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

```typescript
const type = boolean();

type Value = s.infer<typeof type>;

/**
 * type Value === boolean;
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === boolean;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "boolean",
 *   ...
 * };
 */
```

### Date

All [date type](https://www.sanity.io/docs/date-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

```typescript
const type = date();

type Value = s.infer<typeof type>;

/**
 * type Value === string;
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === string;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "date",
 *   ...
 * };
 */
```

### Datetime

All [datetime type](https://www.sanity.io/docs/datetime-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

Other exceptions include `min` and `max`. These values are used in the zod validations and the sanity validations.

Datetime parses into a javascript `Date`.

```typescript
const type = datetime();

type Value = s.infer<typeof type>;

/**
 * type Value === string;
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === Date;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "datetime",
 *   ...
 * };
 */
```

### Document

All [document type](https://www.sanity.io/docs/document-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

```typescript
const type = document({
  name: "foo",
  fields: [
    {
      name: "foo",
      type: s.number(),
    },
    {
      name: "bar",
      optional: true,
      type: s.number(),
    },
  ],
});

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   _createdAt: string;
 *   _id: string;
 *   _rev: string;
 *   _type: "foo";
 *   _updatedAt: string;
 *   foo: number;
 *   bar?: number;
 * };
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === {
 *   _createdAt: Date;
 *   _id: string;
 *   _rev: string;
 *   _type: "foo";
 *   _updatedAt: Date;
 *   foo: number;
 *   bar?: number;
 * };
 */

const schema = type.schema();

/**
 * const schema = {
 *   name: "foo",
 *   type: "document",
 *   fields: [...],
 *   ...
 * };
 */
```

### File

All [file type](https://www.sanity.io/docs/file-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

```typescript
const type = file({
  fields: [
    {
      name: "foo",
      type: s.number(),
    },
    {
      name: "bar",
      optional: true,
      type: s.number(),
    },
  ],
});

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   _type: "file";
 *   asset: {
 *     _type: "reference";
 *     _ref: string;
 *   };
 *   foo: number;
 *   bar?: number;
 * };
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === {
 *   _type: "file";
 *   asset: {
 *     _type: "reference";
 *     _ref: string;
 *   };
 *   foo: number;
 *   bar?: number;
 * };
 */

const schema = type.schema();

/**
 * const schema = {
 *   name: "foo",
 *   type: "file",
 *   fields: [...],
 *   ...
 * };
 */
```

### Geopoint

All [geopoint type](https://www.sanity.io/docs/geopoint-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

```typescript
const type = geopoint();

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   _type: "geopoint";
 *   alt: number;
 *   lat: number;
 *   lng: number;
 * };
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === {
 *   _type: "geopoint";
 *   alt: number;
 *   lat: number;
 *   lng: number;
 * };
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "geopoint",
 *   ...
 * };
 */
```

### Image

All [image type](https://www.sanity.io/docs/image-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

Othe exceptions include `hotspot`. Including `hotspot: true` adds the `crop` and `hotspot` properties in the infer types.

```typescript
const type = image({
  fields: [
    {
      name: "foo",
      type: s.number(),
    },
    {
      name: "bar",
      optional: true,
      type: s.number(),
    },
  ],
});

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   _type: "image";
 *   asset: {
 *     _type: "reference";
 *     _ref: string;
 *   };
 *   foo: number;
 *   bar?: number;
 * };
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === {
 *   _type: "image";
 *   asset: {
 *     _type: "reference";
 *     _ref: string;
 *   };
 *   foo: number;
 *   bar?: number;
 * };
 */

const schema = type.schema();

/**
 * const schema = {
 *   name: "foo",
 *   type: "image",
 *   fields: [...],
 *   ...
 * };
 */
```

### Number

All [number type](https://www.sanity.io/docs/number-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

Other exceptions include `greaterThan`, `integer`, `lessThan`, `max`, `min`, `negative`, `positive`, and `precision`. These values are used in the zod validations and the sanity validations.

```typescript
const type = number();

type Value = s.infer<typeof type>;

/**
 * type Value === number;
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === number;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "number",
 *   ...
 * };
 */
```

### Object

All [object type](https://www.sanity.io/docs/object-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

```typescript
const type = object({
  fields: [
    {
      name: "foo",
      type: s.number(),
    },
    {
      name: "bar",
      optional: true,
      type: s.number(),
    },
  ],
});

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   foo: number;
 *   bar?: number;
 * };
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === {
 *   foo: number;
 *   bar?: number;
 * };
 */

const schema = type.schema();

/**
 * const schema = {
 *   name: "foo",
 *   type: "object",
 *   fields: [...],
 *   ...
 * };
 */
```

### Object (Named)

All [object type](https://www.sanity.io/docs/object-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

This is separate from [`s.object`](#object) because, when objects are named in sanity, there are significant differences:

- The value has a `_type` field equal to the object's name.
- They can be used directly in schemas (like any other schema).
- They can also be registered as a top level object and simply referenced by type within another schema.

```typescript
const type = objectNamed({
  name: "aNamedObject",
  fields: [
    {
      name: "foo",
      type: s.number(),
    },
    {
      name: "bar",
      optional: true,
      type: s.number(),
    },
  ],
});

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   _type: "aNamedObject";
 *   foo: number;
 *   bar?: number;
 * };
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === {
 *   _type: "aNamedObject";
 *   foo: number;
 *   bar?: number;
 * };
 */

const schema = type.schema();

/**
 * const schema = {
 *   name: "foo",
 *   type: "object",
 *   fields: [...],
 *   ...
 * };
 */
```

```typescript
// Use `.ref()` to reference it in another schema.
const someOtherType = array({ of: [type.ref()] });

// The reference value is used directly.
type SomeOtherValue = s.infer<typeof someOtherType>;

/**
 * type SomeOtherValue = [{
 *   _type: "aNamedObject";
 *   foo: number;
 *   bar?: number;
 * }];
 */

// The schema is made within the referencing schema
const someOtherTypeSchema = someOtherType.schema();

/**
 * const someOtherTypeSchema = {
 *   type: "array",
 *   of: [{ type: "" }],
 *   ...
 * };
 */

createSchema({
  name: "default",
  types: [type.schema(), someOtherType.schema()],
});
```

### Reference

All [reference type](https://www.sanity.io/docs/reference-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

Reference resolves into the [referenced document's mock](#resolving-mocks).

```typescript
const type = reference({
  to: [someDocumentType, someOtherDocumentType],
});

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   _ref: string;
 *   _type: "reference";
 *   _weak?: boolean;
 * };
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === {
 *   _ref: string;
 *   _type: "reference";
 *   _weak?: boolean;
 * };
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "reference",
 *   to: [...],
 *   ...
 * };
 */
```

### Slug

All [slug type](https://www.sanity.io/docs/slug-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

Slug parses into a string.

```typescript
const type = slug();

type Value = s.infer<typeof type>;

/**
 * type Value === {
 *   _type: "slug";
 *   current: string;
 * };
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === string;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "slug",
 *   ...
 * };
 */
```

### String

All [string type](https://www.sanity.io/docs/string-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

Other exceptions include `min`, `max`, and `length`. These values are used in the zod validations and the sanity validations.

```typescript
const type = string();

type Value = s.infer<typeof type>;

/**
 * type Value === string;
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === string;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "string",
 *   ...
 * };
 */
```

### Text

All [text type](https://www.sanity.io/docs/text-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

Other exceptions include `min`, `max`, and `length`. These values are used in the zod validations and the sanity validations.

```typescript
const type = text();

type Value = s.infer<typeof type>;

/**
 * type Value === string;
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === string;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "text",
 *   ...
 * };
 */
```

### URL

All [url type](https://www.sanity.io/docs/url-type) properties pass through with the exceptions noted in [Type Definitions](#type-definitions).

```typescript
const type = url();

type Value = s.infer<typeof type>;

/**
 * type Value === string;
 */

const parsedValue: s.output<typeof type> = type.parse(value);

/**
 * typeof parsedValue === string;
 */

const schema = type.schema();

/**
 * const schema = {
 *   type: "url",
 *   ...
 * };
 */
```
