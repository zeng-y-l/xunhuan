// biome-ignore lint/correctness/noUnusedImports: for jsdoc link
import type * as X from '.'
import type { IdxIter, Iter, Maybe } from './base'

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
 */
export const moveNext: {
  (self: Iter<unknown>): void
} = self => {
  self.k(false)
  self.i?.()
  self.n()
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
  self.i?.()
  return self.l()
}
