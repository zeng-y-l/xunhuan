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

// 测试用
declare const V: Maybe<typeof import('vitest')>

/**
 * 长度固定、支持随机访问的迭代器。
 *
 * @see {@linkcode X.Iter}
 */
export type IdxIter<T, K = unknown> = Iter<T, K, never>

/**
 * 长度固定且有限、支持随机访问、双端访问的迭代器。
 *
 * @see {@linkcode X.Iter}
 */
export type BidiIter<T, K = unknown> = Iter<T, K, never, never>

/**
 * 迭代器。惰性求值、不可修改，支持无限长。{@linkcode X.IdxIter} 支持类型安全的随机访问，{@linkcode X.BidiIter} 支持双端访问。
 *
 * 与 {@linkcode Iterator} 类似，但只支持发出值，不支持接收值和返回值。
 * 此外，还支持同时发出键和值，无需用元组等方式模拟键值对。若不关心键，留空类型参数 `K` 即可。
 *
 * 类不自带任何方法，所有操作迭代器的方法都是全局函数，请使用 {@linkcode Iter.c} 实现链式调用。
 *
 * 迭代器结束后就不会再生成值。
 *
 * 大部分方法会消耗迭代器，若不消耗则有标注。消耗的迭代器不能再用，以防内部状态错误。
 *
 * 若要随机访问，则需长度固定；若要双端迭代，则还需长度有限。
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
 *
 * // 随机访问，不会计算其他部分
 * const effect = []
 * const iter = X.ofArr([1, 2, 3]).c(
 *   X.map(x => effect.push(x))
 * )
 * expect(iter.c(X.nth(2))).toEqual(1)
 * expect(iter.c(X.nth(1))).toEqual(2)
 * expect(effect).toEqual([3, 2])
 *
 * // 双端迭代
 * expect(X.ofArr([1, 2, 3, 4]).c(
 *   X.skip(1),
 *   X.rev,
 *   X.toArr,
 * )).toEqual([4, 3, 2])
 * ```
 */
export class Iter<
  out T,
  out K = unknown,
  out Index extends undefined = undefined,
  out Bidi extends undefined = undefined,
> {
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
   * @returns 第一项（当前的）。
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
   * right init
   */
  declare readonly j: Maybe<() => void>

  /**
   * @internal
   * right get
   *
   * 调用前，应调用过 {@linkcode j}。
   *
   * @returns 最后一项（当前的）。
   */
  declare readonly t: (() => Maybe<Yield<T, K>>) | Index | Bidi

  /**
   * @internal
   * right next
   *
   * 调用前，应调用过 {@linkcode j}。
   */
  declare readonly x: (() => void) | Index | Bidi

  /**
   * @internal
   * right each
   *
   * 调用后，不应再调用其他方法。
   *
   * @param f 函数。每个值调用一次，从右到左。若停止，则返回 `false`。
   *
   * @returns 若是停止的，则返回 `false`。
   */
  declare readonly h: ((f: (v: T, k: K) => boolean) => boolean) | Index | Bidi

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
  declare readonly s: ((from: number, to: number) => Iter<T, K, Index, Bidi>) | Index

  /**
   * @internal
   * length
   *
   * 调用前，应调用过 {@linkcode i} 或 {@linkcode j}。
   *
   * @returns 长度。自然数或无穷大。若支持双向迭代，则必须有限。
   */
  declare readonly l: (() => number) | Index

  /**
   * @internal
   * index
   *
   * 调用前，应调用过 {@linkcode i} 或 {@linkcode j}。
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
  private declare u: boolean

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
    rinit: typeof this.j,
    rget: typeof this.t,
    rnext: typeof this.x,
    reach: typeof this.h,
  ) {
    this.i = init
    this.g = get
    this.n = next
    this.e = each
    this.s = slice
    this.l = length
    this.d = index
    this.j = rinit
    this.t = rget
    this.x = rnext
    this.h = reach

    this.u = false

    if (V) {
      let ready = !init
      let rightReady = !rinit
      let used = false
      let end = false
      this.i =
        init &&
        (() => {
          ready = true
          return init()
        })
      this.g = () => {
        V.expect(ready).toBe(true)
        V.expect(used).toBe(false)
        const r = get()
        if (end) V.expect(r).toBeUndefined()
        else end = !r
        return r
      }
      this.n = () => {
        V.expect(ready).toBe(true)
        V.expect(used).toBe(false)
        return next()
      }
      this.e = f => {
        V.expect(used).toBe(false)
        used = true
        let cont = true
        const r = each((v, k) => {
          V.expect(cont).toBe(true)
          cont = f(v, k)
          return cont
        })
        V.expect(r).toBe(cont)
        return r
      }
      this.s =
        slice &&
        ((from, to) => {
          V.expect(used).toBe(false)
          used = true
          V.expect(from).toBeGreaterThanOrEqual(0)
          V.expect(from % 1).toBe(0)
          V.expect(to).toBeGreaterThanOrEqual(0)
          V.expect(to === Infinity || to % 1 === 0).toBe(true)
          V.expect(to).toBeGreaterThanOrEqual(from)
          return slice(from, to)
        })
      this.l =
        length &&
        (() => {
          V.expect(ready || rightReady).toBe(true)
          V.expect(used).toBe(false)
          const r = length()
          V.expect(r).toBeGreaterThanOrEqual(0)
          V.expect(r === Infinity || r % 1 === 0).toBe(true)
          return r
        })
      this.d =
        index &&
        (i => {
          V.expect(ready || rightReady).toBe(true)
          V.expect(used).toBe(false)
          V.expect(i).toBeGreaterThanOrEqual(0)
          V.expect(i % 1).toBe(0)
          const r = index(i)
          if (end) V.expect(r).toBeUndefined()
          return r
        })
      this.j =
        rinit &&
        (() => {
          rightReady = true
          return rinit()
        })
      this.t =
        rget &&
        (() => {
          V.expect(rightReady).toBe(true)
          V.expect(used).toBe(false)
          const r = rget()
          if (end) V.expect(r).toBeUndefined()
          else end = !r
          return r
        })
      this.x =
        rnext &&
        (() => {
          V.expect(rightReady).toBe(true)
          V.expect(used).toBe(false)
          return rnext()
        })
      this.h =
        reach &&
        (f => {
          V.expect(used).toBe(false)
          used = true
          let cont = true
          const r = reach((v, k) => {
            V.expect(cont).toBe(true)
            cont = f(v, k)
            return cont
          })
          V.expect(r).toBe(cont)
          return r
        })
    }
  }

  /**
   * @internal
   * check
   */
  k(then = true) {
    if (this.u) throw new Error('used')
    this.u = then
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

export const newIter: {
  <T, K, Index extends undefined, Bidi extends undefined>(
    get: Iter<T, K, Index, Bidi>['g'],
    next: Iter<T, K, Index, Bidi>['n'],
    each: Iter<T, K, Index, Bidi>['e'],
    init: Iter<T, K, Index, Bidi>['i'],
    slice: Iter<T, K, Index, Bidi>['s'],
    length: Iter<T, K, Index, Bidi>['l'],
    index: Iter<T, K, Index, Bidi>['d'],
    rinit: Iter<T, K, Index, Bidi>['j'],
    rget: Iter<T, K, Index, Bidi>['t'],
    rnext: Iter<T, K, Index, Bidi>['x'],
    reach: Iter<T, K, Index, Bidi>['h'],
  ): Iter<T, K, Index, Bidi>

  <T, K, Index extends undefined>(
    get: Iter<T, K, Index>['g'],
    next: Iter<T, K, Index>['n'],
    each: Iter<T, K, Index>['e'],
    init: Iter<T, K, Index>['i'],
    slice: Iter<T, K, Index>['s'],
    length: Iter<T, K, Index>['l'],
    index: Iter<T, K, Index>['d'],
    rinit?: Iter<T, K, Index>['j'],
    rget?: Iter<T, K, Index>['t'],
    rnext?: Iter<T, K, Index>['x'],
    reach?: Iter<T, K, Index>['h'],
  ): Iter<T, K, Index>

  <T, K>(
    get: Iter<T, K>['g'],
    next: Iter<T, K>['n'],
    each: Iter<T, K>['e'],
    init?: Iter<T, K>['i'],
    slice?: Iter<T, K>['s'],
    length?: Iter<T, K>['l'],
    index?: Iter<T, K>['d'],
    rinit?: Iter<T, K>['j'],
    rget?: Iter<T, K>['t'],
    rnext?: Iter<T, K>['x'],
    reach?: Iter<T, K>['h'],
  ): Iter<T, K>
} = ((get, next, each, init, slice, length, index, rinit, rget, rnext, reach) =>
  new Iter(get, next, each, init, slice, length, index, rinit, rget, rnext, reach)) satisfies <
  T,
  K,
>(
  ...args: ConstructorParameters<typeof Iter<T, K>>
) => Iter<T, K>

export const cInit = <B extends Maybe<() => void>>(a: Maybe<() => void>, b: B) => {
  if (!a) return b
  if (!b) return a
  return () => {
    a()
    b()
  }
}
