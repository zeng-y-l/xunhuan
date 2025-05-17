// biome-ignore lint/correctness/noUnusedImports: for jsdoc link
import type * as X from '.'

export type Maybe<T> = T | undefined

export type Yield<out T, out K> = Readonly<{ v: T; k: K }>

export type YieldOf<I extends Iter<unknown>> = NonNullable<ReturnType<I['g']>>
export type ValOf<I extends Iter<unknown>> = YieldOf<I>['v']
export type KeyOf<I extends Iter<unknown>> = YieldOf<I>['k']

type Fns<T, U extends unknown[]> = U extends [infer U, ...infer Us]
  ? [(v: T) => U, ...Fns<U, Us>]
  : []

type CheckFns<T, Fs extends unknown[], Fs_ = Fs> = Fs extends []
  ? Fs_
  : Fs extends [(v: T) => infer T, ...infer Fs]
    ? CheckFns<T, Fs, Fs_>
    : never

/**
 * 长度固定、支持随机访问的迭代器。
 *
 * @see {X.Iter}
 */
export type IdxIter<T, K = unknown> = Iter<T, K, never>

/**
 * 迭代器。惰性求值、不可变，支持无限长。
 *
 * 与 {@linkcode Iterator} 类似，但只支持发出值，不支持接收值和返回值。
 * 此外，还支持同时发出键和值，无需用元组等方式模拟键值对。若不关心键，留空类型参数 `K` 即可。
 *
 * 类不自带任何方法，所有操作迭代器的方法都是全局函数，请使用 {@linkcode Iter.c} 实现链式调用。
 *
 * 迭代器结束后就不会再生成值。
 *
 * 迭代器只能用一次，否则会报错，哪怕只获取了第一个值。这是为了防止内部状态错误。若需要更灵活的控制，可以用 {@linkcode X.toIter} 转换为原生迭代器。
 *
 * @example
 * ```ts @import.meta.vitest
 * // 惰性求值，支持无限长
 * expect(X.repeat(42).c(
 *   X.take(3),
 *   X.toArr,
 * )).toEqual([42, 42, 42])
 *
 * // 不可多次使用
 * expect(() => {
 *   const iter = X.ofArr([1, 2, 3])
 *   X.first(iter)
 *   X.first(iter)
 * }).toThrow('used')
 * ```
 *
 * @see {X.IdxIter}
 */
export class Iter<out T, out K = unknown, out Index extends undefined = undefined> {
  /**
   * @internal
   * init
   */
  declare readonly i: Maybe<() => void>

  /**
   * @internal
   * get
   *
   * 调用前，应调用过 {@linkcode i}。
   *
   * @returns 当前的一项。
   */
  declare readonly g: () => Maybe<Yield<T, K>>

  /**
   * @internal
   * next
   *
   * 调用前，应调用过 {@linkcode i}。
   */
  declare readonly n: () => void

  /**
   * @internal
   * each
   *
   * 调用后，不应再调用其他方法。
   *
   * @param f 函数。每个值调用一次。若停止，则返回 `false`。
   *
   * @returns 若是停止的，则返回 `false`。
   */
  declare readonly e: (f: (v: T, k: K) => boolean) => boolean

  /**
   * @internal
   * slice
   *
   * 调用后，不应再调用其他方法。
   *
   * @param from 自然数。
   * @param to 自然数。不小于 `from`。
   *
   * @returns 迭代器。
   */
  declare readonly s: ((from: number, to: number) => Iter<T, K, Index>) | Index

  /**
   * @internal
   * length
   *
   * 调用前，应调用过 {@linkcode i}。
   *
   * @returns 长度。自然数或无穷大。
   */
  declare readonly l: (() => number) | Index

  /**
   * @internal
   * index
   *
   * 调用前，应调用过 {@linkcode i}。
   *
   * @param i 自然数。
   *
   * @returns 所在项。
   */
  declare readonly d: ((i: number) => Maybe<Yield<T, K>>) | Index

  /**
   * @internal
   * used
   */
  declare u: boolean

  /**
   * @internal
   */
  constructor(
    get: typeof this.g,
    next: typeof this.n,
    each: typeof this.e,
    init: typeof this.i,
    slice: typeof this.s,
    length: typeof this.l,
    index: typeof this.d,
  ) {
    this.i = init
    this.g = get
    this.n = next
    this.e = each
    this.s = slice
    this.l = length
    this.d = index

    this.u = false
  }

  /**
   * @internal
   * check
   */
  k() {
    if (this.u) throw new Error('used')
    this.u = true
  }

  /**
   * 链式调用。
   *
   * `iter.c(f, g)` 等价于 `g(f(iter))`。
   */
  c(): this
  c<O>(...f: Fns<this, [O]>): O
  c<A, O>(...f: Fns<this, [A, O]>): O
  c<A, B, O>(...f: Fns<this, [A, B, O]>): O
  c<A, B, C, O>(...f: Fns<this, [A, B, C, O]>): O
  c<A, B, C, D, O>(...f: Fns<this, [A, B, C, D, O]>): O
  c<A, B, C, D, E, O>(...f: Fns<this, [A, B, C, D, E, O]>): O
  c<A, B, C, D, E, F, O>(...f: Fns<this, [A, B, C, D, E, F, O]>): O
  c<A, B, C, D, E, F, G, O>(...f: Fns<this, [A, B, C, D, E, F, G, O]>): O
  c<A, B, C, D, E, F, G, H, O>(...f: Fns<this, [A, B, C, D, E, F, G, H, O]>): O
  c<F extends ((v: any) => any)[], Z, O>(...f: CheckFns<this, [...F, (v: Z) => O]>): O
  c(...f: ((v: any) => any)[]) {
    return f.reduce((v, f) => f(v), this)
  }
}

export const newIter = <T, K>(
  get: Iter<T, K>['g'],
  next: Iter<T, K>['n'],
  each: Iter<T, K>['e'],
  init?: Iter<T, K>['i'],
  slice?: Iter<T, K>['s'],
  length?: Iter<T, K>['l'],
  index?: Iter<T, K>['d'],
): Iter<T, K> => new Iter<T, K>(get, next, each, init, slice, length, index)

export const newIdxIter: {
  <T, K>(
    get: IdxIter<T, K>['g'],
    next: IdxIter<T, K>['n'],
    each: IdxIter<T, K>['e'],
    init: IdxIter<T, K>['i'],
    slice: IdxIter<T, K>['s'],
    length: IdxIter<T, K>['l'],
    index: IdxIter<T, K>['d'],
  ): IdxIter<T, K>
} = newIter as any

export const cInit = <B extends Maybe<() => void>>(a: Maybe<() => void>, b: B) => {
  if (!a) return b
  if (!b) return a
  return () => {
    a()
    b()
  }
}
