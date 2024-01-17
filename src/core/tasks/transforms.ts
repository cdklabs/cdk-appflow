/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Field } from './field';
import { IOperation, OperationBase } from './operation';
import { Task } from './tasks';

const OP_NOOP = 'NO_OP';

/**
 * A representation of a transform operation, that is an operation modifying source fields
 */
export interface ITransform extends IOperation { }

/**
 * A representation of a transform operation, that is an operation modifying source fields
 */
export class Transform extends OperationBase implements ITransform {

  /**
   * Truncates the field to a specified length
   * @param field a source field to truncate
   * @param length the maximum length after truncation
   * @returns a @see Transform instance
   */
  public static truncate(field: string | Field, length: number): ITransform {

    if (!Number.isInteger(length)) {
      throw new Error('length has to be an integer value');
    }

    if (length <= 0) {
      throw new Error('length has to be a positive integer value');
    }

    return new Transform([
      new Task(
        'Truncate',
        [typeof field === 'string' ? field : field.name],
        { operation: OP_NOOP },
        [{ key: 'TRUNCATE_LENGTH', value: `${length}` }]),
    ]);
  }

  /**
   * Masks the field with a specified mask
   * @param field a source field to mask
   * @param mask a mask character. @default '*'
   * @returns a @see Transform instance
   */
  public static mask(field: string | Field, mask: string = '*'): ITransform {
    if (mask && mask.length !== 1) {
      throw new Error('The mask has to be a single character');

    }
    return new Transform([
      new Task(
        'Mask',
        [typeof field === 'string' ? field : field.name],
        { operation: 'MASK_ALL' },
        [{
          // TODO: test this. The AWS Console generated transform has length, but what for?
          key: 'MASK_LENGTH', value: '5',
        },
        { key: 'MASK_VALUE', value: mask ?? '*' }],
      ),
    ]);
  }

  public static maskStart(field: string | Field, length: number, mask?: string): ITransform {
    if (!Number.isInteger(length)) {
      throw new Error('length has to be an integer value');
    }

    if (length <= 0) {
      throw new Error('length has to be a positive integer value');
    }

    if (mask && mask.length !== 1) {
      throw new Error('The mask has to be a single character');
    }

    return new Transform([
      new Task(
        'Mask',
        [typeof field === 'string' ? field : field.name],
        { operation: 'MASK_FIRST_N' },
        [
          { key: 'MASK_LENGTH', value: `${length}` },
          { key: 'MASK_VALUE', value: mask ?? '*' },
        ],
      ),
    ]);
  }

  public static maskEnd(field: string | Field, length: number, mask?: string): ITransform {

    if (!Number.isInteger(length)) {
      throw new Error('length has to be an integer value');
    }

    if (length <= 0) {
      throw new Error('length has to be a positive integer value');
    }

    if (mask && mask.length !== 1) {
      throw new Error('The mask has to be a single character');

    }
    return new Transform([
      new Task(
        'Mask',
        [typeof field === 'string' ? field : field.name],
        { operation: 'MASK_LAST_N' },
        [
          { key: 'MASK_LENGTH', value: `${length}` },
          { key: 'MASK_VALUE', value: mask ?? '*' },
        ],
      ),
    ]);
  }
}