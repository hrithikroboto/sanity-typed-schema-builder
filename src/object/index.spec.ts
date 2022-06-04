import { describe, expect, it } from "@jest/globals";

import { boolean } from "../boolean";
import { mockRule } from "../test-utils";

import { object } from ".";

import type { ValidateShape } from "../test-utils";
import type { InferInput, InferOutput } from "../types";

describe("object", () => {
  it("builds a sanity config", () =>
    expect(object().schema()).toEqual({
      type: "object",
      fields: [],
    }));

  it("passes through schema values", () =>
    expect(object({ hidden: false }).schema()).toHaveProperty("hidden", false));

  it("parses into an object", () => {
    const type = object();

    const value: ValidateShape<
      InferInput<typeof type>,
      Record<never, never>
    > = {};
    const parsedValue: ValidateShape<
      InferOutput<typeof type>,
      Record<never, never>
    > = type.parse(value);

    expect(parsedValue).toEqual(value);
  });

  it("adds fields", () => {
    const type = object().field({
      name: "foo",
      type: boolean(),
    });

    const schema = type.schema();

    expect(schema).toHaveProperty("fields", [
      {
        name: "foo",
        type: "boolean",
        validation: expect.any(Function),
      },
    ]);

    const required = mockRule();

    const rule = {
      ...mockRule(),
      required: () => required,
    };

    expect(schema.fields[0]?.validation?.(rule)).toEqual(required);

    const value: ValidateShape<InferInput<typeof type>, { foo: boolean }> = {
      foo: true,
    };
    const parsedValue: ValidateShape<
      InferOutput<typeof type>,
      { foo: boolean }
    > = type.parse(value);

    expect(parsedValue).toEqual(value);
  });

  it("allows optional fields", () => {
    const type = object().field({
      name: "foo",
      optional: true,
      type: boolean(),
    });

    const schema = type.schema();

    expect(schema).toHaveProperty("fields", [
      {
        name: "foo",
        type: "boolean",
        validation: expect.any(Function),
      },
    ]);

    const required = mockRule();

    const rule = {
      ...mockRule(),
      required: () => required,
    };

    expect(schema.fields[0]?.validation?.(rule)).not.toEqual(required);

    const value: ValidateShape<InferInput<typeof type>, { foo?: boolean }> = {};
    const parsedValue: ValidateShape<
      InferOutput<typeof type>,
      { foo?: boolean }
    > = type.parse(value);

    expect(parsedValue).toEqual(value);
  });
});