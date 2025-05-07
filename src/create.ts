// biome-ignore lint/correctness/noUnusedImports: for jsdoc link
import type * as X from '.'
import { Iter, type Maybe, type Yield } from './base'
import { flatten, prepend } from './trans'

/**
 * 数组转迭代器。同时支持字符串等类数组对象。
 *
 * @param arr 数组（不能稀疏）。
 *
 * @returns 迭代器，值为数组的每一项，键为 0 到 `arr.length - 1` 的数。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3]
 * X.ofArr(arr).c(
 *   X.forEach((x, i) => {
 *     expect(x).toEqual(arr[i])
 *   }),
 * )
 * ```
 *
 * @see {@linkcode X.ofIter}
 * @see {@linkcode X.toArr}
 */
export const ofArr: {
  <T>(arr: ArrayLike<T>): Iter<T, number>
} = arr => _ofArr(arr, 0, arr.length)

const _ofArr = <T>(arr: ArrayLike<T>, from: number, to: number): Iter<T, number> => {
  let i = from
  return new Iter(
    () => (i < to ? { v: arr[i], k: i } : undefined),
    () => i++,
    f => {
      for (; i < to; i++) {
        if (!f(arr[i], i)) return false
      }
      return true
    },
    undefined,
    (from, to_) => _ofArr(arr, i + from, Math.min(to, i + to_)),
  )
}

/**
 * 原生迭代器转迭代器。
 *
 * @param iter 原生迭代器或可迭代对象。
 *
 * @returns 迭代器，值为原生迭代器的每一项。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.ofArr('𰻝𰻝面'))).not.toEqual(['𰻝', '𰻝', '面'])
 * expect(X.toArr(X.ofIter('𰻝𰻝面'))).toEqual(['𰻝', '𰻝', '面'])
 * expect(X.toArr(X.ofIter({ next: () => ({ done: true }) }))).toEqual([])
 * ```
 *
 * @see {@linkcode X.ofArr}
 * @see {@linkcode X.toIter}
 */
export const ofIter: {
  <T>(iter: Iterable<T> | Iterator<T>): Iter<T, undefined>
} = <T>(iter: Iterable<T> | Iterator<T>) => {
  let i: Iterator<T>
  let step: Maybe<Yield<T, undefined>>
  let next = () => {
    let nxt = i.next()
    step = nxt.done ? undefined : { v: nxt.value, k: undefined }
  }
  let init = () => {
    if (i) return
    i =
      Symbol.iterator in Object(iter)
        ? (iter as Iterable<T>)[Symbol.iterator]()
        : (iter as Iterator<T>)
    next()
  }
  return new Iter(
    () => step,
    next,
    f => {
      if (!i && Symbol.iterator in Object(iter)) {
        for (let v of iter as Iterable<T>) {
          if (!f(v, undefined)) return false
        }
      } else {
        init()
        if (step && !f(step.v, step.k)) return false
        for (let res = i.next(); !res.done; res = i.next()) {
          if (!f(res.value, undefined)) return false
        }
      }
      return true
    },
    init,
  )
}

/**
 * 区间内的等差数列。
 *
 * @param from 第一个值。默认为 0。
 * @param to 不能超过这个值。默认为 `Infinity`。
 * @param step 每个值的增量。默认为 1 或 -1，根据 `from` 和 `to` 的大小决定。
 *
 * @returns 迭代器，值为等差数列。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.range(3))).toEqual([0, 1, 2])
 * expect(X.toArr(X.range(-2, 2))).toEqual([-2, -1, 0, 1])
 * expect(X.toArr(X.range(2, -2))).toEqual([2, 1, 0, -1])
 * expect(X.toArr(X.range(1, 11, 3))).toEqual([1, 4, 7, 10])
 * expect(X.range().c(
 *   X.take(5),
 *   X.toArr,
 * )).toEqual([0, 1, 2, 3, 4])
 * ```
 */
export const range: {
  (to?: number): Iter<number, undefined>
  (from: number, to: number, step?: number): Iter<number, undefined>
} = (a = Infinity, b?: number, c?: number) => {
  let x = b != null ? a : 0
  let to = b ?? a
  let step = c ?? (x < to ? 1 : -1)
  return new Iter(
    () => (step * (to - x) > 0 ? { v: x, k: undefined } : undefined),
    () => {
      x += step
    },
    f => {
      for (; step * (to - x) > 0; x += step) {
        if (!f(x, undefined)) return false
      }
      return true
    },
    undefined,
    (from, to_) => {
      let to1 = x + to_ * step
      to1 = step > 0 ? Math.min(to1, to) : Math.max(to1, to)
      return range(x + from * step, to1, step)
    },
  )
}

/**
 * 空迭代器。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.empty())).toEqual([])
 * ```
 */
export const empty: {
  (): Iter<never, never>
} = () =>
  new Iter(
    () => undefined,
    () => {},
    () => true,
    undefined,
    () => empty(),
  )

/**
 * 生成单个值。
 *
 * @param v 值。
 *
 * @returns 迭代器，值为 `v`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.once('value'))).toEqual(['value'])
 * ```
 *
 * @see {@linkcode X.onceKV}
 */
export const once: {
  <T>(v: T): Iter<T, undefined>
} = v => onceKV(v, undefined)

/**
 * 生成单个值。
 *
 * @param v 值。
 * @param k 键。
 *
 * @returns 迭代器，值为 `v`，键为 `k`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.onceKV('value', 'key').c(
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([['key', 'value']])
 * ```
 *
 * @see {@linkcode X.once}
 * @see {@linkcode X.repeat}
 */
export const onceKV: {
  <T, K>(v: T, k: K): Iter<T, K>
} = (v, k) => {
  let done = false
  return new Iter(
    () => (done ? undefined : { v, k }),
    () => {
      done = true
    },
    f_ => done || f_(v, k),
    undefined,
    (from, to) => (done || from > 0 || to < 1 ? empty() : onceKV(v, k)),
  )
}

/**
 * 重复某个值。
 *
 * @param v 值。
 * @param n 重复的次数。默认为 `Infinity`。
 *
 * @returns 迭代器，值为 `v`，长度为 `n`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.repeat('val', 1))).toEqual(['val'])
 * expect(X.repeat('val').c(
 *   X.take(2),
 *   X.toArr,
 * )).toEqual(['val', 'val'])
 * ```
 *
 * @see {@linkcode X.repeatKV}
 */
export const repeat: {
  <T>(v: T, n?: number): Iter<T, undefined>
} = (v, n = Infinity) => repeatKV(v, undefined, n)

/**
 * 重复某个值。
 *
 * @param v 值。
 * @param k 键。
 * @param n 重复的次数。默认为 `Infinity`。
 *
 * @returns 迭代器，值为 `v`，键为 `k`，长度为 `n`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.repeatKV('val', 'key', 1).c(
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([['key', 'val']])
 * expect(X.repeatKV('val', 'key').c(
 *   X.take(2),
 *   X.toEntries,
 *   X.toArr,
 * )).toEqual([['key', 'val'], ['key', 'val']])
 * ```
 *
 * @see {@linkcode X.repeat}
 * @see {@linkcode X.onceKV}
 * @see {@linkcode X.empty}
 */
export const repeatKV: {
  <T, K>(v: T, k: K, n?: number): Iter<T, K>
} = (v, k, n = Infinity) => {
  let i = 0
  let step = { v, k }
  return new Iter(
    () => (i < n ? step : undefined),
    () => {
      i++
    },
    f_ => {
      for (; i < n; i++) if (!f_(v, k)) return false
      return true
    },
    undefined,
    (from, to) => repeatKV(v, k, Math.min(to, n - i) - from),
  )
}

/**
 * 重复应用函数，无限生成值。
 *
 * @param f 函数。输入前一个值，输出后一个值。
 * @param init 第一个值。
 *
 * @returns 无限长的迭代器，值为 `init, f(init), f(f(init)), ...`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.succ(x => x * 2, 1).c(
 *   X.take(5),
 *   X.toArr,
 * )).toEqual([1, 2, 4, 8, 16])
 * ```
 *
 * @see {@linkcode X.scan}
 */
export const succ: {
  <T>(f: (prev: T) => T, init: T): Iter<T, undefined>
} = (f, init) => {
  let v = init
  return new Iter(
    () => ({ v, k: undefined }),
    () => {
      v = f(v)
    },
    f_ => {
      while (f_(v, undefined)) v = f(v)
      return false
    },
  )
}

/**
 * 连接若干迭代器。
 *
 * @param ...iter 迭代器。
 *
 * @returns 迭代器，将 `iter` 全部连接起来。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.concat())).toEqual([])
 * expect(X.toArr(X.concat(ofArr([1, 2])))).toEqual([1, 2])
 * expect(X.toArr(X.concat(ofArr([1, 2]), ofArr([3, 4])))).toEqual([1, 2, 3, 4])
 * expect(X.toArr(X.concat(ofArr([1, 2]), ofArr([3, 4]), ofArr([5, 6])))).toEqual([1, 2, 3, 4, 5, 6])
 * ```
 *
 * @see {@linkcode X.prepend}
 */
export const concat: {
  <T, K>(...iter: Iter<T, K>[]): Iter<T, K>
} = (...iter) => {
  let l = iter.length
  if (l === 0) return empty()
  if (l === 1) return iter[0]
  if (l === 2) return prepend(iter[0])(iter[1])
  return flatten(ofArr(iter))
}

/**
 * 对象转迭代器，类似 {@linkcode Object.entries}。
 *
 * 效果等同于 `X.ofEntries(X.ofArr(Object.entries(obj)))`。
 *
 * @param obj 对象。
 *
 * @returns 迭代器。
 *
 * @example
 * ```ts @import.meta.vitest
 * const obj = { a: 1, b: 2 }
 * X.ofObj(obj).c(
 *   X.forEach((v, k) => {
 *     expect(v).toEqual(obj[k])
 *   })
 * )
 * ```
 *
 * @see {@linkcode X.toObj}
 * @see {@linkcode X.ofArr}
 * @see {@linkcode X.ofEntries}
 */
export const ofObj: {
  <T>(obj: Record<string, T> | ArrayLike<T>): Iter<T, string>
  (obj: object): Iter<unknown, string>
} = <T>(obj: Record<string, T>) => _ofObj(obj, undefined, 0, undefined)

const _ofObj = <T>(
  obj: Record<string, T>,
  keys_: Maybe<string[]>,
  from: number,
  to_: Maybe<number>,
): Iter<T, string> => {
  let keys = keys_
  let to = to_
  let i = from
  let init = () => {
    if (keys) return
    keys = Object.keys(obj)
    to = keys.length
  }
  return new Iter(
    () => (i < to! ? { v: obj[keys![i]], k: keys![i] } : undefined),
    () => i++,
    f => {
      init()
      for (; i < to!; i++) {
        if (!f(obj[keys![i]], keys![i])) return false
      }
      return true
    },
    init,
    (from, to_) => {
      init()
      return _ofObj(obj, keys, i + from, Math.min(to!, i + to_))
    },
  )
}
