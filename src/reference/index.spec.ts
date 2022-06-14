import { describe, expect, it } from "@jest/globals";

import { boolean } from "../boolean";
import { document } from "../document";
import { mockRule } from "../test-utils";

import { reference } from ".";

import type { ValidateShape } from "../test-utils";
import type { InferInput, InferOutput } from "../types";
import type { PartialDeep } from "type-fest";

interface SanityReference {
  _ref: string;
  _type: "reference";
  _weak?: boolean | undefined;
}

describe("reference", () => {
  it("builds a sanity config", () =>
    expect(
      reference({
        to: [
          document({
            name: "foo",
            fields: [
              {
                name: "foo",
                type: boolean(),
              },
            ],
          }),
        ],
      }).schema()
    ).toEqual({
      type: "reference",
      to: [{ type: "foo" }],
    }));

  it("passes through schema values", () =>
    expect(
      reference({
        to: [
          document({
            name: "foo",
            fields: [
              {
                name: "foo",
                type: boolean(),
              },
            ],
          }),
        ],
        hidden: false,
      }).schema()
    ).toHaveProperty("hidden", false));

  it("parses into a reference", () => {
    const type = reference({
      to: [
        document({
          name: "foo",
          fields: [
            {
              name: "foo",
              type: boolean(),
            },
          ],
        }),
      ],
    });

    const value: ValidateShape<InferInput<typeof type>, SanityReference> = {
      _type: "reference",
      _ref: "somereference",
    };
    const parsedValue: ValidateShape<
      InferOutput<typeof type>,
      SanityReference
    > = type.parse(value);

    expect(parsedValue).toEqual(value);
  });

  it("mocks a reference", () =>
    expect(
      reference({
        to: [
          document({
            name: "foo",
            fields: [
              {
                name: "foo",
                type: boolean(),
              },
            ],
          }),
        ],
      }).mock()
    ).toEqual({
      _ref: expect.any(String),
      _type: "reference",
    }));

  it("allows defining the mocks", () =>
    expect([
      {
        _ref: "ffda9bed-b959-4100-abeb-9f1e241e9445",
        _type: "reference",
      },
      {
        _ref: "93f3af18-337a-4df7-a8de-fbaa6609fd0a",
        _type: "reference",
        _weak: true,
      },
    ]).toContainEqual(
      reference({
        to: [
          document({
            name: "foo",
            fields: [
              {
                name: "foo",
                type: boolean(),
              },
            ],
          }),
        ],
        mock: (faker) =>
          faker.helpers.arrayElement([
            {
              _ref: "ffda9bed-b959-4100-abeb-9f1e241e9445",
              _type: "reference",
            },
            {
              _ref: "93f3af18-337a-4df7-a8de-fbaa6609fd0a",
              _type: "reference",
              _weak: true,
            },
          ]),
      }).mock()
    ));

  it("allows defining the zod", () => {
    const type = reference({
      to: [
        document({
          name: "foo",
          fields: [
            {
              name: "foo",
              type: boolean(),
            },
          ],
        }),
      ],
      zod: (zod) => zod.transform(({ _ref }) => _ref),
    });

    const parsedValue: ValidateShape<
      InferOutput<typeof type>,
      string
    > = type.parse({
      _ref: "ffda9bed-b959-4100-abeb-9f1e241e9445",
      _type: "reference",
    });

    expect(parsedValue).toEqual("ffda9bed-b959-4100-abeb-9f1e241e9445");
  });

  it("types custom validation", () => {
    const type = reference({
      to: [
        document({
          name: "foo",
          fields: [
            {
              name: "foo",
              type: boolean(),
            },
          ],
        }),
      ],
      validation: (Rule) =>
        Rule.custom((value) => {
          const {
            _ref,
          }: ValidateShape<typeof value, PartialDeep<SanityReference>> = value;

          return (_ref?.length ?? 0) > 50 || "Needs to be 50 characters";
        }),
    });

    const rule = mockRule();

    type.schema().validation?.(rule);

    expect(rule.custom).toHaveBeenCalledWith(expect.any(Function));
  });
});
