import { describe, expect, it } from 'vitest';

import { extractTypeInstructionDocument } from './typescript.js';

describe('extractTypeInstructionDocument', () => {
  it('turns exported interfaces into retrieval-friendly instruction text', () => {
    const document = extractTypeInstructionDocument(`
      /**
       * Advanced column data schema model.
       * Used for passing data to renderers.
       */
      export interface ColumnDataSchemaModel {
        /**
         * Column prop used for mapping value.
         */
        prop: ColumnProp;
        /**
         * Row data object.
         */
        model: DataType;
      }
    `);

    expect(document.title).toBe('ColumnDataSchemaModel');
    expect(document.symbols).toContain('ColumnDataSchemaModel');
    expect(document.body).toContain('Interface ColumnDataSchemaModel');
    expect(document.body).toContain('- prop: ColumnProp. Column prop used for mapping value.');
    expect(document.body).toContain('- model: DataType. Row data object.');
  });

  it('captures exported type aliases as symbols and guidance', () => {
    const document = extractTypeInstructionDocument(`
      /**
       * Determines whether a cell is read-only.
       */
      export type ReadOnlyFormat =
        | boolean
        | ((params: ColumnDataSchemaModel) => boolean);
    `);

    expect(document.title).toBe('ReadOnlyFormat');
    expect(document.symbols).toEqual(['ReadOnlyFormat']);
    expect(document.body).toContain('Type ReadOnlyFormat');
    expect(document.summary).toContain('Determines whether a cell is read-only.');
  });
});
