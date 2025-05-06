// biome-ignore lint/correctness/noUnusedImports: for jsdoc link
import type * as X from '.'
import {
  Iter,
  type KeyOf,
  type Maybe,
  type ValOf,
  type Yield,
  type YieldOf,
  cInit,
} from './base'

/**
 * 取迭代器的一段。长度不够则忽略。
 *
 * 一般需要一个个访问开头被跳过的值。但许多迭代器（如 {@linkcode X.ofArr}）有优化，使时间复杂度与 `from` 无关。
 *
 * @param from 自然数。取的第一个值所在位置。
 * @param to 自然数。要取到的位置（不含）。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3, 4]
 * expect(X.ofArr(arr).c(
 *   X.slice(1, 3),
 *   X.toArr,
 * )).toEqual([2, 3])
 * expect(X.ofArr(arr).c(
 *   X.slice(2, 100),
 *   X.toArr,
 * )).toEqual([3, 4])
 * expect(X.empty().c(
 *   X.slice(Infinity, Infinity),
 *   X.first,
 * )).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.take}
 * @see {@linkcode X.skip}
 */
export const slice: {
  (from: number, to: number): <T, K>(self: Iter<T, K>) => Iter<T, K>
} = (from, to) => self => {
  self.k()
  let { i: init, g: get, n: next, e: each, s: slice_ } = self
  if (slice_) return slice_(from, to)
  let i = 0
  return new Iter(
    () => (i < to ? get() : undefined),
    () => {
      i++
      next()
    },
    f => {
      let ok = true
      each((v, k) => {
        if (i++ < from) return true
        if (i > to) return false
        ok = f(v, k)
        return ok
      })
      return ok
    },
    cInit(init, () => {
      for (; i < from; i++) {
        next()
        if (!get()) break
      }
    }),
    (from_, to_) => {
      let remains = from - i
      self.u = false
      return slice(from_ + remains, Math.min(to - i, to_ + remains))(self)
    },
  )
}

/**
 * 取迭代器的前几个值。长度不够则忽略。
 *
 * @param n 自然数。要取的个数。
 *
 * @returns 方法，返回的迭代器生成 `self` 的前 `n` 个值。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3]
 * expect(X.ofArr(arr).c(
 *   X.take(2),
 *   X.toArr,
 * )).toEqual([1, 2])
 * expect(X.ofArr(arr).c(
 *   X.take(100),
 *   X.toArr,
 * )).toEqual([1, 2, 3])
 * ```
 *
 * @see {@linkcode X.slice}
 * @see {@linkcode X.takeWhile}
 */
export const take: {
  (n: number): <T, K>(self: Iter<T, K>) => Iter<T, K>
} = n => slice(0, n)

/**
 * 跳过迭代器的开头。长度不够则忽略。
 *
 * 一般需要一个个访问开头被跳过的值。但许多迭代器（如 {@linkcode X.ofArr}）有优化，使时间复杂度与 `from` 无关。
 *
 * 效果等同于 `X.slice(n, Infinity)`。若迭代器没有优化，则在 `n` 很小时可能更快。
 *
 * @param n 自然数。要跳过的长度。
 *
 * @returns 方法，返回的迭代器跳过 `self` 的前 `n` 个值。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3, 4]
 * expect(X.ofArr(arr).c(
 *   X.skip(2),
 *   X.toArr,
 * )).toEqual([3, 4])
 * expect(X.ofArr(arr).c(
 *   X.skip(100),
 *   X.toArr,
 * )).toEqual([])
 * ```
 *
 * @see {@linkcode X.slice}
 * @see {@linkcode X.skipWhile}
 */
export const skip: {
  (n: number): <T, K>(self: Iter<T, K>) => Iter<T, K>
} = n => self => {
  self.k()
  let { i: init, g: get, n: next, e: each, s: slice } = self
  if (slice) return slice(n, Infinity)
  let i = 0
  let init_ = cInit(init, () => {
    for (; i < n; i++) {
      next()
      if (!get()) break
    }
  })
  return new Iter(
    get,
    next,
    f => {
      init_()
      return each(f)
    },
    init_,
  )
}

/**
 * 把键设为递增的整数。
 *
 * 效果等同于 `X.zipK(X.range())`。
 *
 * 方法，返回的迭代器的值与输入相同，键为 `0, 1, 2, ...`。
 *
 * @example
 * ```ts @import.meta.vitest
 * const iter = () =>
 *   X.ofArr('abcd').c(
 *     X.filter(x => x !== 'b'),
 *   )
 * expect(iter().c(
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([[0, 'a'], [2, 'c'], [3, 'd']])
 * expect(iter().c(
 *   X.enume,
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([[0, 'a'], [1, 'c'], [2, 'd']])
 * ```
 *
 * @see {@linkcode X.range}
 * @see {@linkcode X.zipK}
 */
export const enume: {
  <T>(self: Iter<T>): Iter<T, number>
} = self => _enume(self, 0)

let _enume = <T>(self: Iter<T>, from: number): Iter<T, number> => {
  self.k()
  let { i: init, g: get, n: next, e: each, s: slice } = self
  let i = from
  return new Iter(
    () => {
      let step = get()
      return step && { v: step.v, k: i }
    },
    () => {
      i++
      next()
    },
    f => each(v => f(v, i++)),
    init,
    slice && ((from, to) => _enume(slice(from, to), i + from)),
  )
}

/**
 * 映射值。键不变。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param f 函数。参数为值和键，返回值。
 *
 * @returns 方法，返回的迭代器的值为 `f` 的返回值。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr('abc').c(
 *   X.map((x, i) => `${i}: ${x}`),
 *   X.toArr,
 * )).toEqual(['0: a', '1: b', '2: c'])
 * ```
 *
 * @see {@linkcode X.mapKV}
 */
export const map: {
  <T, K, U>(f: (v: T, k: K) => U): (self: Iter<T, K>) => Iter<U, K>
} = f => mapKV(f, (_, k) => k)

/**
 * 映射键。值不变。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param f 函数。参数为值和键，返回键。
 *
 * @returns 方法，返回的迭代器的键为 `f` 的返回值。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.mapK(x => String(x)),
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([['1', 1], ['2', 2], ['3', 3]])
 * ```
 *
 * @see {@linkcode X.mapKV}
 */
export const mapK: {
  <T, K, L>(key: (v: T, k: K) => L): (self: Iter<T, K>) => Iter<T, L>
} = key => mapKV((v, _) => v, key)

/**
 * 映射键和值。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param val 函数。参数为值和键，返回值。
 * @param key 函数。参数为值和键，返回键。
 *
 * @returns 方法，返回的迭代器的值为 `val` 的返回值，键为 `key` 的返回值。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.mapKV(x => x * 2, (_, i) => 3 - i),
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([[3, 2], [2, 4], [1, 6]])
 * ```
 *
 * @see {@linkcode X.map}
 * @see {@linkcode X.mapK}
 */
export const mapKV: {
  <T, K, U, L>(
    val: (v: T, k: K) => U,
    key: (v: T, k: K) => L,
  ): (self: Iter<T, K>) => Iter<U, L>
} = (val, key) => self => {
  self.k()
  let { i: init, g: get, n: next, e: each, s: slice } = self
  return new Iter(
    () => {
      let s = get()
      return s && { v: val(s.v, s.k), k: key(s.v, s.k) }
    },
    next,
    f => each((v, k) => f(val(v, k), key(v, k))),
    init,
    slice && ((from, to) => mapKV(val, key)(slice(from, to))),
  )
}

/**
 * 把键和值打包到值里。
 *
 * 方法，返回的迭代器的值为键和值组成的元组，键不变。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.toEntries(X.ofArr('abc')))).toEqual([[0, 'a'], [1, 'b'], [2, 'c']])
 * ```
 *
 * @see {@linkcode X.ofEntries}
 * @see {@linkcode X.toObj}
 */
export const toEntries: {
  <T, K>(self: Iter<T, K>): Iter<[K, T], K>
} = /* @__PURE__ */ mapKV(
  (v, k) => [k, v],
  (_v, k) => k,
)

/**
 * 把值里的元组打开成键和值。
 *
 * 方法，返回的迭代器的值为输入的值的第一项，键为第二项。
 *
 * @example
 * ```ts @import.meta.vitest
 * const map = new Map([[1, 'a'], [2, 'b'], [3, 'c']])
 * X.ofIter(map).c(
 *   X.ofEntries,
 *   X.forEach((v, k) => {
 *     expect(v).toEqual(map.get(k))
 *   }),
 * )
 * ```
 *
 * @see {@linkcode X.toEntries}
 * @see {@linkcode X.ofObj}
 */
export const ofEntries: {
  <K, V>(self: Iter<[K, V]>): Iter<V, K>
} = /* @__PURE__ */ mapKV(
  (v, _k) => v[1],
  (v, _k) => v[0],
)

/**
 * 保留满足条件的值。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 *
 * @returns 方法，返回的迭代器包含输入中满足条件的值。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.filter(x => x !== 2),
 *   X.toArr,
 * )).toEqual([1, 3])
 * ```
 *
 * @see {@linkcode X.unless}
 */
export const filter: {
  <T, K, U extends T>(
    pred: (v: T, k: K) => v is U,
  ): (self: Iter<T, K>) => Iter<U, K>
  <T, K>(pred: (v: T, k: K) => boolean): (self: Iter<T, K>) => Iter<T, K>
} =
  <T, K>(pred: (v: T, k: K) => boolean) =>
  (self: Iter<T, K>) => {
    self.k()
    let { i: init, g: get, n: next, e: each } = self
    let step: Maybe<Yield<T, K>>
    let next_ = () => {
      do {
        step = get()
        next()
      } while (step && !pred(step.v, step.k))
    }
    return new Iter(
      () => step,
      next_,
      f =>
        (!step || f(step.v, step.k)) && each((v, k) => !pred(v, k) || f(v, k)),
      cInit(init, () => {
        if (!step) next_()
      }),
    )
  }

/**
 * 跳过满足条件的值。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 *
 * @returns 方法，返回的迭代器包含输入中不满足条件的值。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.unless(x => x === 2),
 *   X.toArr,
 * )).toEqual([1, 3])
 * ```
 *
 * @see {@linkcode X.filter}
 */
export const unless: {
  <T, K>(pred: (v: T, k: K) => boolean): (self: Iter<T, K>) => Iter<T, K>
} = pred => filter((v, k) => !pred(v, k))

/**
 * 跳过开头满足条件的值。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 *
 * @returns 方法，返回的迭代器中不包含输入的开头的满足条件的值。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3, 1]).c(
 *   X.skipWhile(x => x < 2),
 *   X.toArr,
 * )).toEqual([2, 3, 1])
 * ```
 *
 * @see {@linkcode X.skip}
 * @see {@linkcode X.takeWhile}
 */
export const skipWhile: {
  <T, K>(pred: (v: T, k: K) => boolean): (self: Iter<T, K>) => Iter<T, K>
} = pred => self => {
  self.k()
  let { i: init, g: get, n: next, e: each } = self
  let flag = true
  return new Iter(
    get,
    next,
    f =>
      each((v, k) => {
        if (flag) {
          flag = pred(v, k)
          if (flag) return true
        }
        return f(v, k)
      }),
    cInit(init, () => {
      if (!flag) return
      for (;;) {
        let step = get()
        flag = !!step && pred(step.v, step.k)
        if (!flag) break
        next()
      }
    }),
  )
}

/**
 * 取开头满足条件的值。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 *
 * @returns 方法，返回的迭代器中，若输入的某个值不满足条件，则直接结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3, 1]).c(
 *   X.takeWhile(x => x < 3),
 *   X.toArr,
 * )).toEqual([1, 2])
 * ```
 *
 * @see {@linkcode X.take}
 * @see {@linkcode X.skipWhile}
 */
export const takeWhile: {
  <T, K, U extends T>(
    pred: (v: T, k: K) => v is U,
  ): (self: Iter<T, K>) => Iter<U, K>
  <T, K>(pred: (v: T, k: K) => boolean): (self: Iter<T, K>) => Iter<T, K>
} =
  <T, K>(pred: (v: T, k: K) => boolean) =>
  (self: Iter<T, K>) => {
    self.k()
    let { i: init, g: get, n: next, e: each } = self
    let step: Maybe<Yield<T, K>>
    return new Iter(
      () => step,
      () => {
        if (!step) return
        next()
        step = get()
        if (step && !pred(step.v, step.k)) step = undefined
      },
      f => {
        let ok = true
        each((v, k) => {
          if (!pred(v, k)) return false
          ok = f(v, k)
          return ok
        })
        return ok
      },
      cInit(init, () => {
        step = get()
        if (step && !pred(step.v, step.k)) step = undefined
      }),
    )
  }

/**
 * 映射到迭代器并展平。
 *
 * @param f 函数。参数为值和键，返回迭代器。
 *
 * @returns 方法，返回的迭代器是输入迭代器逐项映射后依次连接起来。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.flatMap(x => X.range(x)),
 *   X.toArr,
 * )).toEqual([0, 0, 1, 0, 1, 2])
 * ```
 *
 * @see {@linkcode X.flatten}
 */
export const flatMap: {
  <T, K, U, L>(f: (v: T, k: K) => Iter<U, L>): (self: Iter<T, K>) => Iter<U, L>
} = f => self => {
  self.k()
  let { i: init, g: get, n: next, e: each } = self
  let step: Maybe<YieldOf<ReturnType<typeof f>>>
  let iter: Maybe<ReturnType<typeof f>>
  let nextIter = () => {
    let s = get()
    if (!s) {
      iter = undefined
      return
    }
    iter = f(s.v, s.k)
    iter.k()
    iter.i?.()
    next()
  }
  let next_ = () => {
    while (iter) {
      step = iter.g()
      if (step) {
        iter.n()
        return
      }
      nextIter()
    }
  }
  return new Iter(
    () => step,
    next_,
    f_ =>
      (!step || f_(step.v, step.k)) &&
      (!iter || iter.e(f_)) &&
      each((v, k) => f(v, k).e(f_)),
    cInit(init, () => {
      if (iter) return
      nextIter()
      next_()
    }),
  )
}

/**
 * 展平迭代器。
 *
 * 方法，输入迭代器每个值都是迭代器，返回的迭代器为输入迭代器逐项连接起来。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([X.range(3), X.ofArr([10, 20])]).c(
 *   X.flatten,
 *   X.toArr,
 * )).toEqual([0, 1, 2, 10, 20])
 * ```
 *
 * @see {@linkcode X.flatMap}
 */
export const flatten: {
  <T, K>(self: Iter<Iter<T, K>>): Iter<T, K>
} = /* @__PURE__ */ flatMap((v, _k) => v)

/**
 * 压缩两个迭代器为元组，取较短者。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param snd 另一个迭代器。
 *
 * @returns 方法，返回的迭代器同时迭代输入的两个迭代器，值为二者的元组，键取 `fst` 的，任意一个结束了就结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.zip(X.ofArr('abcd')),
 *   X.toArr,
 * )).toEqual([[1, 'a'], [2, 'b'], [3, 'c']])
 * ```
 *
 * @see {@linkcode X.zipBy}
 * @see {@linkcode X.zipByKV}
 */
export const zip: {
  <T, K, U>(snd: Iter<U>): (fst: Iter<T, K>) => Iter<[T, U], K>
} = snd =>
  zipByKV(
    snd,
    (v1, _k1, v2, _k2) => [v1, v2],
    (_v1, k1, _v2, _k2) => k1,
  )

/**
 * 压缩两个迭代器为键值，取较短者。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param snd 要作为键的迭代器。
 *
 * @returns 方法，返回的迭代器同时迭代输入的两个迭代器，值取 `fst` 的，键取 `snd` 的，任意一个结束了就结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.zipK(X.ofArr('abcd')),
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([['a', 1], ['b', 2], ['c', 3]])
 * ```
 *
 * @see {@linkcode X.zipByKV}
 */
export const zipK: {
  <T, U>(snd: Iter<U>): (fst: Iter<T>) => Iter<T, U>
} = snd =>
  zipByKV(
    snd,
    (v1, _k1, _v2, _k2) => v1,
    (_v1, _k1, v2, _k2) => v2,
  )

/**
 * 压缩两个迭代器并映射，取较短者。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param snd 另一个迭代器。
 * @param f 函数。参数为二者的值和键，返回要生成的值。
 *
 * @returns 方法，返回的迭代器同时迭代输入的两个迭代器，值为 `f` 的返回值，键取 `fst` 的，任意一个结束了就结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.zipBy(X.ofArr('abcd'), (a, _, b) => `${a}: ${b}`),
 *   X.toArr,
 * )).toEqual(['1: a', '2: b', '3: c'])
 * ```
 *
 * @see {@linkcode X.zip}
 * @see {@linkcode X.zipByKV}
 */
export const zipBy: {
  <T, K, U, L, V>(
    snd: Iter<U, L>,
    f: (v1: T, k1: K, v2: U, k2: L) => V,
  ): (fst: Iter<T, K>) => Iter<V, K>
} = (snd, f) => zipByKV(snd, f, (_v1, k1, _v2, _k2) => k1)

/**
 * 压缩两个迭代器并映射键值，取较短者。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param snd 另一个迭代器。
 * @param val 函数。参数为二者的值和键，返回要生成的值。
 * @param key 函数。参数为二者的值和键，返回要生成的键。
 *
 * @returns 方法，返回的迭代器同时迭代输入的两个迭代器，值为 `val` 的返回值，键为 `key` 的返回值，任意一个结束了就结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.skip(1),
 *   X.zipByKV(X.ofArr('abcd'), (a, _, b) => `${a}: ${b}`, (_, i) => i),
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([[1, '2: a'], [2, '3: b']])
 * ```
 *
 * @see {@linkcode X.zip}
 * @see {@linkcode X.zipK}
 * @see {@linkcode X.zipBy}
 * @see {@linkcode X.zipByKV}
 */
export const zipByKV: {
  <T, K, U, L, V, M>(
    snd: Iter<U, L>,
    val: (v1: T, k1: K, v2: U, k2: L) => V,
    key: (v1: T, k1: K, v2: U, k2: L) => M,
  ): (fst: Iter<T, K>) => Iter<V, M>
} = (snd, val, key) => fst => {
  fst.k()
  snd.k()
  let { i: init1, g: get1, n: next1, e: each1, s: slice1 } = fst
  let { i: init2, g: get2, n: next2, s: slice2 } = snd
  return new Iter(
    () => {
      let a = get1()
      let b = get2()
      if (!a || !b) return
      return { v: val(a.v, a.k, b.v, b.k), k: key(a.v, a.k, b.v, b.k) }
    },
    () => {
      next1()
      next2()
    },
    f => {
      init2?.()
      let ok = true
      each1((v1, k1) => {
        let s2 = get2()
        if (!s2) return false
        next2()
        ok = f(val(v1, k1, s2.v, s2.k), key(v1, k1, s2.v, s2.k))
        return ok
      })
      return ok
    },
    cInit(init1, init2),
    slice1 &&
      slice2 &&
      ((from, to) => zipByKV(slice2(from, to), val, key)(slice1(from, to))),
  )
}

type ZipAllFn<T, K, U, L, R> = (
  v1: Maybe<T>,
  k1: Maybe<K>,
  v2: Maybe<U>,
  k2: Maybe<L>,
  c1: boolean,
  c2: boolean,
) => R

/**
 * 压缩两个迭代器为元组，取较长者。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param snd 另一个迭代器。
 *
 * @returns 方法，返回的迭代器同时迭代输入的两个迭代器，值为二者的元组，键取 `fst` 的，两个都结束了才结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.zipAll(X.ofArr('abcd')),
 *   X.toArr,
 * )).toEqual([[1, 'a'], [2, 'b'], [3, 'c'], [undefined, 'd']])
 * ```
 *
 * @see {@linkcode X.zipAllBy}
 * @see {@linkcode X.zipAllByKV}
 */
export const zipAll: {
  <T, K, U>(
    snd: Iter<U>,
  ): (fst: Iter<Maybe<T>, Maybe<K>>) => Iter<[Maybe<T>, Maybe<U>], Maybe<K>>
} = snd =>
  zipAllByKV(
    snd,
    (v1, _k1, v2, _k2, _c1, _c2) => [v1, v2],
    (_v1, k1, _v2, _k2, _c1, _c2) => k1,
  )

/**
 * 压缩两个迭代器为键值，取较长者。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param snd 要作为键的迭代器。
 *
 * @returns 方法，返回的迭代器同时迭代输入的两个迭代器，值取 `fst` 的，键取 `snd` 的，两个都结束了才结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.zipAllK(X.ofArr('abcd')),
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([['a', 1], ['b', 2], ['c', 3], ['d', undefined]])
 * ```
 *
 * @see {@linkcode X.zipAllByKV}
 */
export const zipAllK: {
  <T, U>(snd: Iter<U>): (fst: Iter<Maybe<T>>) => Iter<Maybe<T>, Maybe<U>>
} = snd =>
  zipAllByKV(
    snd,
    (v1, _k1, _v2, _k2, _c1, _c2) => v1,
    (_v1, _k1, v2, _k2, _c1, _c2) => v2,
  )

/**
 * 压缩两个迭代器并映射，取较长者。
 *
 * @param snd 另一个迭代器。
 * @param f 函数。参数为二者的值和键（结束了则为 `undefined`）以及二者是否还没结束，返回要生成的值。
 *
 * @returns 方法，返回的迭代器同时迭代输入的两个迭代器，值为 `f` 的返回值，键取 `fst` 的，两个都结束了才结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.zipAllBy(X.ofArr(['a', undefined]), (a, _1, b, _2, _3, c) => `${a}: ${c ? b : '/'}`),
 *   X.toArr,
 * )).toEqual(['1: a', '2: undefined', '3: /'])
 * ```
 *
 * @see {@linkcode X.zipAll}
 * @see {@linkcode X.zipAllByKV}
 */
export const zipAllBy: {
  <T, K, U, L, V>(
    snd: Iter<U, L>,
    f: ZipAllFn<T, K, U, L, V>,
  ): (fst: Iter<Maybe<T>, Maybe<K>>) => Iter<V, Maybe<K>>
} = (snd, f) => zipAllByKV(snd, f, (_v1, k1, _v2, _k2, _c1, _c2) => k1)

/**
 * 压缩两个迭代器并映射键值，取较长者。
 *
 * 注意，不保证函数对每个值只调用一次。
 *
 * @param snd 另一个迭代器。
 * @param val 函数。参数为二者的值和键（结束了则为 `undefined`）以及二者是否还没结束，返回要生成的值。
 * @param key 函数。参数为二者的值和键（结束了则为 `undefined`）以及二者是否还没结束，返回要生成的键。
 *
 * @returns 方法，返回的迭代器同时迭代输入的两个迭代器，值为 `val` 的返回值，键为 `key` 的返回值，两个都结束了才结束。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.skip(1),
 *   X.zipAllByKV(X.ofArr('a'), (a, _1, b, _2, _3, c) => `${a}: ${c ? b : '/'}`, (_, i) => i),
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([[1, '2: a'], [2, '3: /']])
 * ```
 *
 * @see {@linkcode X.zipAll}
 * @see {@linkcode X.zipAllK}
 * @see {@linkcode X.zipAllBy}
 * @see {@linkcode X.zipAllByKV}
 */
export const zipAllByKV: {
  <T, K, U, L, V, M>(
    snd: Iter<U, L>,
    val: ZipAllFn<T, K, U, L, V>,
    key: ZipAllFn<T, K, U, L, M>,
  ): (fst: Iter<Maybe<T>, Maybe<K>>) => Iter<V, M>
} = (snd, val, key) => fst => {
  fst.k()
  snd.k()
  let { i: init1, g: get1, n: next1, e: each1, s: slice1 } = fst
  let { i: init2, g: get2, n: next2, e: each2, s: slice2 } = snd
  return new Iter(
    () => {
      let a = get1()
      let b = get2()
      if (!a && !b) return
      return {
        v: val(a?.v, a?.k, b?.v, b?.k, !!a, !!b),
        k: key(a?.v, a?.k, b?.v, b?.k, !!a, !!b),
      }
    },
    () => {
      next1()
      next2()
    },
    f => {
      init2?.()
      let c2 = true
      return (
        each1((v1, k1) => {
          let v2: Maybe<ValOf<typeof snd>>
          let k2: Maybe<KeyOf<typeof snd>>
          if (c2) {
            let step = get2()
            c2 = !!step
            if (step) {
              next2()
              ;({ v: v2, k: k2 } = step)
            }
          }
          return f(val(v1, k1, v2, k2, true, c2), key(v1, k1, v2, k2, true, c2))
        }) &&
        each2((v2, k2) =>
          f(
            val(undefined, undefined, v2, k2, false, true),
            key(undefined, undefined, v2, k2, false, true),
          ),
        )
      )
    },
    cInit(init1, init2),
    slice1 &&
      slice2 &&
      ((from, to) => zipAllByKV(slice2(from, to), val, key)(slice1(from, to))),
  )
}

/**
 * 更新状态并生成之。
 *
 * 类似 {@linkcode X.fold}，但返回迭代器，将会生成中间的状态。
 *
 * @param f 函数。参数为当前状态、值和键，返回值为新的状态。
 *
 * @return 方法，返回的迭代器的值是中间状态，键不变，长度不变。注意：生成的第一个值是 `f(init, 输入的第一个值)` 而非 `init`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.scan((a, b) => a + b, 0),
 *   X.toArr,
 * )).toEqual([1, 3, 6])
 * ```
 *
 * @see {@linkcode X.fold}
 * @see {@linkcode X.windowsByKV}
 */
export const scan: {
  <T, K, U>(
    f: (acc: U, v: T, k: K) => U,
    init: U,
  ): (self: Iter<T, K>) => Iter<U, K>
} = (f, init) => self => {
  self.k()
  let { i: init_, g: get, n: next, e: each } = self
  let step: Maybe<Yield<typeof init, KeyOf<typeof self>>>
  let done = false
  let next_ = () => {
    if (!step) return
    next()
    let s = get()
    done = !s
    step = s && { v: f(step.v, s.v, s.k), k: s.k }
  }
  return new Iter(
    () => step,
    next_,
    f_ => {
      if (done) return true
      let acc = step ? step.v : init
      if (step) {
        if (!f_(step.v, step.k)) return false
        next()
      }
      return each((v, k) => {
        acc = f(acc, v, k)
        return f_(acc, k)
      })
    },
    cInit(init_, () => {
      if (step || done) return
      let s = get()
      done = !s
      step = s && { v: f(init, s.v, s.k), k: s.k }
    }),
  )
}

/**
 * 在后面接上迭代器。
 *
 * @param snd 要接上的迭代器。
 *
 * @returns 方法，返回的迭代器是输入的迭代器和要接上的迭代器连接起来。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2]).c(
 *   X.append(X.ofArr([3, 4])),
 *   X.toArr,
 * )).toEqual([1, 2, 3, 4])
 * ```
 *
 * @see {@linkcode X.prepend}
 */
export const append: {
  <T, K>(snd: Iter<T, K>): (fst: Iter<T, K>) => Iter<T, K>
} = snd => fst => prepend(fst)(snd)

/**
 * 在前面接上迭代器。
 *
 * @param fst 要接上的迭代器。
 *
 * @returns 方法，返回的迭代器是要接上的迭代器和输入的迭代器连接起来。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2]).c(
 *   X.prepend(X.ofArr([3, 4])),
 *   X.toArr,
 * )).toEqual([3, 4, 1, 2])
 * ```
 *
 * @see {@linkcode X.append}
 */
export const prepend: {
  <T, K>(fst: Iter<T, K>): (snd: Iter<T, K>) => Iter<T, K>
} = fst => snd => {
  fst.k()
  snd.k()
  let { i: init1, g: get1, n: next1, e: each1 } = fst
  let { i: init2, g: get2, n: next2, e: each2 } = snd
  let done1 = false
  let step1: Maybe<YieldOf<typeof fst>>
  return new Iter(
    () => step1 ?? get2(),
    () => {
      if (done1) {
        next2()
        return
      }
      next1()
      step1 = get1()
      if (!step1) done1 = true
    },
    f => (done1 || each1(f)) && each2(f),
    cInit(cInit(init1, init2), () => {
      step1 = get1()
      if (!step1) done1 = true
    }),
  )
}

type Arr<T, N extends number> = number extends N
  ? T[]
  : N extends N
    ? _Arr<T, N, [T]>
    : never
type _Arr<T, N extends number, R extends T[]> = R['length'] extends N
  ? R
  : _Arr<T, N, [T, ...R]>

/**
 * 切分为指定大小的数组。
 *
 * @param n 正整数。数组大小。
 * @param last 是否生成最后大小不够的数组。默认为 `true`。若大小刚好，则没有影响。
 *
 * @returns 方法，返回的迭代器的值是数组，每隔 `n` 个切分。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3, 4, 5]
 * expect(X.ofArr(arr).c(
 *   X.chunk(2),
 *   X.toArr,
 * )).toEqual([[1, 2], [3, 4], [5]])
 * expect(X.ofArr(arr).c(
 *   X.chunk(2, false),
 *   X.toArr,
 * )).toEqual([[1, 2], [3, 4]])
 * expect(X.ofArr(arr).c(
 *   X.chunk(10, true),
 *   X.toArr,
 * )).toEqual([[1, 2, 3, 4, 5]])
 * expect(X.ofArr([1, 2, 3, 4]).c(
 *   X.chunk(2, true),
 *   X.toArr,
 * )).toEqual([[1, 2], [3, 4]])
 * ```
 *
 * @see {@linkcode X.splitBy}
 */
export const chunk: {
  <N extends number>(
    n: N,
    last: false,
  ): <T, K>(self: Iter<T, K>) => Iter<Arr<T, N>, undefined>
  (n: number, last?: boolean): <T, K>(self: Iter<T, K>) => Iter<T[], undefined>
} =
  (n: number, last = true) =>
  <T, K>(self: Iter<T, K>) => {
    self.k()
    let { i: init, g: get, n: next, e: each, s: slice } = self
    let step: Maybe<Yield<T[], undefined>>
    let next_ = () => {
      let arr = []
      while (arr.length < n) {
        let s = get()
        if (!s) {
          if (arr.length === 0 || !last) {
            step = undefined
            return
          }
          break
        }
        arr.push(s.v)
        next()
      }
      step = { v: arr, k: undefined }
    }
    return new Iter(
      () => step,
      next_,
      f => {
        let arr: T[] = []
        return (
          (!step || f(step.v, step.k)) &&
          each((v, _k) => {
            arr.push(v)
            if (arr.length < n) return true
            let r = f(arr, undefined)
            arr = []
            return r
          }) &&
          (!last || arr.length === 0 || f(arr, undefined))
        )
      },
      cInit(init, () => {
        if (!step) next_()
      }),
      slice && ((from, to) => chunk(n, last)(slice(from * n, to * n))),
    )
  }

/**
 * 在满足条件的位置切分为数组。
 *
 * 注意：
 * 若 `inclusive` 为假，且第一个值满足条件，则生成的第一个值为空数组。
 * 若 `last` 为真，且最后一个值满足条件，则生成的最后一个值为空数组（与 {@linkcode X.chunk} 不同）。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 * @param inclusive 数组是否包含其后的满足条件的值。默认为 `false`。
 * @param last 是否生成最后一个数组。默认为 `true`。
 *
 * @returns 方法，返回的迭代器的值是数组，在输入中满足条件的值处切分。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3, 4]).c(
 *   X.splitBy(x => x % 2 === 1),
 *   X.toArr,
 * )).toEqual([[], [2], [4]])
 *
 * const arr = [1, 2, 3, 4, 6]
 * expect(X.ofArr(arr).c(
 *   X.splitBy(x => x % 2 === 0, true),
 *   X.toArr,
 * )).toEqual([[1, 2], [3, 4], [6], []])
 * expect(X.ofArr(arr).c(
 *   X.splitBy(x => x % 2 === 0, true, false),
 *   X.toArr,
 * )).toEqual([[1, 2], [3, 4], [6]])
 * expect(X.ofArr(arr).c(
 *   X.splitBy(x => x % 2 === 0, false, false),
 *   X.toArr,
 * )).toEqual([[1], [3], []])
 * ```
 *
 * @see {@linkcode X.chunk}
 */
export const splitBy: {
  <T, K>(
    pred: (v: T, k: K) => boolean,
    inclusive?: boolean,
    last?: boolean,
  ): (self: Iter<T, K>) => Iter<T[], undefined>
} =
  (pred, inclusive = false, last = true) =>
  self => {
    self.k()
    let { i: init, g: get, n: next, e: each } = self
    let step: Maybe<Yield<ValOf<typeof self>[], undefined>>
    let done = false
    let next_ = () => {
      if (done) {
        step = undefined
        return
      }
      let arr = []
      for (;;) {
        let s = get()
        if (!s) {
          done = true
          if (!last) {
            step = undefined
            return
          }
          break
        }
        next()
        if (pred(s.v, s.k)) {
          if (inclusive) arr.push(s.v)
          break
        }
        arr.push(s.v)
      }
      step = { v: arr, k: undefined }
    }
    return new Iter(
      () => step,
      next_,
      f => {
        let arr: ValOf<typeof self>[] = []
        if (step && !f(step.v, step.k)) return false
        if (done) return true
        return (
          each((v, k) => {
            if (!pred(v, k)) {
              arr.push(v)
              return true
            }
            if (inclusive) arr.push(v)
            let r = f(arr, undefined)
            arr = []
            return r
          }) &&
          (!last || f(arr, undefined))
        )
      },
      cInit(init, () => {
        if (!done && !step) next_()
      }),
    )
  }

/**
 * 两个值为一组滑动并映射。
 *
 * @param val 函数。参数为两个值和键，返回值。
 * @param key 函数。参数为两个值和键，返回键。
 *
 * @returns 方法，返回的迭代器的值为 `val` 的返回值，键为 `key` 的返回值。若输入的迭代器长度不到二，则返回的迭代器为空。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr('abc').c(
 *   X.windowsByKV((a, _, b) => [a, b], (_1, a, _2, b) => [a, b]),
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([[[0, 1], ['a', 'b']], [[1, 2], ['b', 'c']]])
 * expect(X.ofArr([1]).c(
 *   X.windowsByKV(() => 'val', () => 'key'),
 *   X.toArr,
 * )).toEqual([])
 * ```
 *
 * @see {@linkcode X.splitBy}
 */
export const windowsByKV: {
  <T, K, U, L>(
    val: (v1: T, k1: K, v2: T, k2: K) => U,
    key: (v1: T, k1: K, v2: T, k2: K) => L,
  ): (self: Iter<T, K>) => Iter<U, L>
} = (val, key) => self => {
  self.k()
  let { i: init, g: get, n: next, e: each } = self
  let v1: Maybe<ValOf<typeof self>>, k1: Maybe<KeyOf<typeof self>>
  let v2: typeof v1, k2: typeof k1
  let done = false
  let step: Maybe<Yield<ReturnType<typeof val>, ReturnType<typeof key>>>

  let init_ = cInit(init, () => {
    if (step || done) return
    let prev = get()
    next()
    let curr = get()
    if (!prev || !curr) {
      done = true
      return
    }
    ;({ v: v1, k: k1 } = prev)
    ;({ v: v2, k: k2 } = curr)
    step = {
      v: val(v1!, k1!, v2!, k2!),
      k: key(v1!, k1!, v2!, k2!),
    }
  })
  return new Iter(
    () => step,
    () => {
      if (done) return
      next()
      let curr = get()
      if (!curr) {
        done = true
        step = undefined
        return
      }
      v1 = v2
      k1 = k2
      ;({ v: v2, k: k2 } = curr)
      step = {
        v: val(v1!, k1!, v2!, k2!),
        k: key(v1!, k1!, v2!, k2!),
      }
    },
    f => {
      init_()
      if (step && !f(step.v, step.k)) return false
      next()
      return each((v, k) => {
        let r = f(val(v2!, k2!, v, k), key(v2!, k2!, v, k))
        v2 = v
        k2 = k
        return r
      })
    },
    init_,
  )
}

/**
 * 去除最后一个值。
 *
 * 方法，返回的迭代器不包含输入迭代器的最后一项。若输入迭代器为空，则返回的也为空。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.pop(X.ofArr([1, 2, 3, 4])))).toEqual([1, 2, 3])
 * expect(X.toArr(X.pop(X.empty()))).toEqual([])
 * ```
 *
 * @see {@linkcode X.skip}
 * @see {@linkcode X.take}
 * @see {@linkcode X.windowsByKV}
 */
export const pop: {
  <T, K>(self: Iter<T, K>): Iter<T, K>
} = /* @__PURE__ */ windowsByKV(
  (v1, _k1, _v2, _k2) => v1,
  (_v1, k1, _v2, _k2) => k1,
)
