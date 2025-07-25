// biome-ignore lint/correctness/noUnusedImports: for jsdoc link
import type * as X from '.'
import type { BidiIter, IdxIter, Iter, Maybe } from './base'

/**
 * 获取当前值。
 *
 * 方法，不消耗，返回输入迭代器的当前值。若已结束则返回 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * const iter = X.ofArr('ab')
 * expect(X.current(iter)).toEqual('a')
 * X.moveNext(iter)
 * expect(X.current(iter)).toEqual('b')
 * X.moveNext(iter)
 * expect(X.current(iter)).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.first}
 * @see {@linkcode X.moveNext}
 * @see {@linkcode X.rCurrent}
 */
export const current: {
  <T>(self: Iter<T>): Maybe<T>
} = self => {
  self.k(false)
  self.i?.()
  return self.g()?.v
}

/**
 * 步进迭代器。
 *
 * 方法，不消耗，只步进输入迭代器。
 *
 * @example
 * ```ts @import.meta.vitest
 * const iter = X.ofArr('ab')
 * expect(X.current(iter)).toEqual('a')
 * X.moveNext(iter)
 * expect(X.current(iter)).toEqual('b')
 * X.moveNext(iter)
 * expect(X.current(iter)).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.current}
 * @see {@linkcode X.rMoveNext}
 */
export const moveNext: {
  (self: Iter<unknown>): void
} = self => {
  self.k(false)
  self.i?.()
  self.n()
}

/**
 * 获取右侧当前值。
 *
 * 方法，不消耗，返回输入迭代器的最后一个值。若已结束则返回 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * const iter = X.ofArr('ab')
 * expect(X.rCurrent(iter)).toEqual('b')
 * X.rMoveNext(iter)
 * expect(X.rCurrent(iter)).toEqual('a')
 * X.rMoveNext(iter)
 * expect(X.rCurrent(iter)).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.last}
 * @see {@linkcode X.rMoveNext}
 * @see {@linkcode X.current}
 */
export const rCurrent: {
  <T>(self: BidiIter<T>): Maybe<T>
} = self => {
  self.k(false)
  self.j?.()
  return self.t()?.v
}

/**
 * 从右侧步进迭代器。
 *
 * 方法，不消耗，只步进输入迭代器。
 *
 * @example
 * ```ts @import.meta.vitest
 * const iter = X.ofArr('ab')
 * expect(X.rCurrent(iter)).toEqual('b')
 * X.rMoveNext(iter)
 * expect(X.rCurrent(iter)).toEqual('a')
 * X.rMoveNext(iter)
 * expect(X.rCurrent(iter)).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.rCurrent}
 * @see {@linkcode X.moveNext}
 */
export const rMoveNext: {
  (self: BidiIter<unknown>): void
} = self => {
  self.k(false)
  self.j?.()
  self.x()
}

/**
 * 获取长度。
 *
 * 方法，不消耗，返回输入迭代器的剩余长度。无限长则为 `Infinity`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.length(X.ofArr([1, 2, 3]))).toEqual(3)
 * expect(X.length(X.range())).toEqual(Infinity)
 * ```
 *
 * @see {@linkcode X.count}
 */
export const length: {
  (self: IdxIter<unknown>): number
} = self => {
  self.k(false)
  return self.l()
}

/**
 * 获取第 i 个值。
 *
 * @param i 自然数。要获取的位置，当前值为 0。
 *
 * @returns 方法，不消耗，返回输入迭代器的第 i 个值，没有则返回 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(X.nth(1))).toEqual(2)
 * expect(X.empty().c(X.nth(1))).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.count}
 */
export const nth: {
  (i: number): <T>(self: IdxIter<T>) => T | undefined
} = i => self => {
  self.k(false)
  self.i?.()
  return self.d(i)?.v
}

/**
 * 获取分区点。
 *
 * 分区点是第一个满足条件的值的索引，且分区点后面的都满足条件。若都不满足条件，则分区点为迭代器长度。
 *
 * 要求输入迭代器存在分区点，且长度有限。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 *
 * @returns 方法，不消耗，返回输入迭代器的分区点。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.range(500).c(
 *   X.partitionPoint(x => x >= 200),
 * )).toEqual(200)
 * expect(X.range(10).c(
 *   X.partitionPoint(() => true),
 * )).toEqual(0)
 * expect(X.range(10).c(
 *   X.partitionPoint(() => false),
 * )).toEqual(10)
 * ```
 */
export const partitionPoint: {
  <T, K>(pred: (v: T, k: K) => boolean): (self: IdxIter<T, K>) => number
} = pred => self => {
  self.k(false)
  self.i?.()
  let low = 0
  let high = self.l()
  while (low < high) {
    let mid = (low + high) >> 1
    let { v, k } = self.d(mid)!
    if (pred(v, k)) {
      high = mid
    } else {
      low = mid + 1
    }
  }
  return low
}

/**
 * 按照函数二分查找。
 *
 * 要求输入迭代器在 `cmp` 下升序排列，且长度有限。
 *
 * @param cmp 比较函数。参数为值和键，返回值小于 0 表示太小，等于 0 表示正好，大于 0 表示太大。
 *
 * @returns 方法，不消耗，返回第一个正好的值的索引。若没有正好的值则返回 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.range(500).c(
 *   X.binarySearchBy(x => x - 200),
 * )).toEqual(200)
 * expect(X.range(10).c(
 *   X.binarySearchBy(() => 0),
 * )).toEqual(0)
 * expect(X.range(10).c(
 *   X.binarySearchBy(() => -1),
 * )).toEqual(undefined)
 * ```
 */
export const binarySearchBy: {
  <T, K>(cmp: (v: T, k: K) => number): (self: IdxIter<T, K>) => Maybe<number>
} = cmp => self => {
  let idx = self.c(partitionPoint((v, k) => cmp(v, k) >= 0))
  let step = self.d(idx)
  return step && cmp(step.v, step.k) === 0 ? idx : undefined
}

/**
 * 按照键二分查找。
 *
 * 要求输入迭代器的键升序排列，且长度有限。
 *
 * @param x 要查找的键。
 *
 * @returns 方法，不消耗，返回第一个与要查找的键相同的索引。若没有则返回 `undefined`。
 *
 * @example
 * ```ts
 * expect(X.range(500).c(
 *   X.binarySearchK(200),
 * )).toEqual(200)
 * expect(X.range(10).c(
 *   X.binarySearchK(0),
 * )).toEqual(0)
 * expect(X.range(10).c(
 *   X.binarySearchK(-1),
 * )).toEqual(undefined)
 * ```
 */
export const binarySearchK: {
  <K>(k: K): (self: IdxIter<unknown, K>) => Maybe<number>
} = x =>
  // biome-ignore lint/suspicious/noSelfCompare:
  binarySearchBy((_, k) => +(k > x || k !== k) - +(k < x || x !== x))
