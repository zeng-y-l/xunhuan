// biome-ignore lint/correctness/noUnusedImports: for jsdoc link
import type * as X from '.'
import { type BidiIter, type Iter, type Maybe, type Yield, newIter } from './base'
import { flatten, prepend } from './trans'

type IdxedEach<T, K> = (from: number, to: number, f: (v: T, k: K) => boolean) => boolean

/**
 * 根据索引生成迭代器。内部使用。
 *
 * @param getLen 迭代器长度，自然数或无穷大。若需计算，则为函数。
 * @param idx 函数，输入索引（小于长度的自然数），获取对应键值。调用前调用过 `getLen`。
 * @param each 函数，输入开始和结束位置（左闭右开）以及迭代函数，遍历区间每个值。类似 {@linkcode X.Iter.e}。调用后不会再调用函数。
 *
 * @returns 迭代器。注意：若长度为无穷大，则反向迭代会抛出异常。
 */
export const newIdxed: {
  <T, K>(
    getLen: number | (() => number),
    idx: (i: number) => Yield<T, K>,
    each: IdxedEach<T, K>,
    reach: IdxedEach<T, K>,
  ): BidiIter<T, K>
} = (getLen, idx, each, reach) => _newIdxed(0, getLen, idx, each, reach)

const _newIdxed = <T, K>(
  i: number,
  getLen: number | (() => number),
  idx: (i: number) => Yield<T, K>,
  each: IdxedEach<T, K>,
  reach: IdxedEach<T, K>,
): BidiIter<T, K> => {
  let init: Maybe<() => void>, rinit: Maybe<() => void>, len: Maybe<number>, err: Maybe<() => never>
  if (typeof getLen === 'number') {
    len = getLen
    if (len === Infinity) {
      rinit = () => {
        throw new Error('inf')
      }
    }
  } else {
    init = () => {
      len ??= getLen()
    }
    rinit = () => {
      init?.()
      if (len === Infinity) throw new Error('inf')
    }
  }
  return newIter(
    () => (i < len! ? idx(i) : undefined),
    () => {
      i++
    },
    f => {
      init?.()
      return each(i, len!, f)
    },
    init,
    (from, to) => {
      len ??= (getLen as () => number)()
      return _newIdxed(i + from, Math.min(len, i + to), idx, each, reach)
    },
    () => {
      init?.()
      return Math.max(0, len! - i)
    },
    i_ => (i + i_ < len! ? idx(i + i_) : undefined),
    rinit,
    err || (() => (len! > i ? idx(len! - 1) : undefined)),
    err ||
      (() => {
        len!--
      }),
    err ||
      (f => {
        rinit?.()
        return reach(i, len!, f)
      }),
  )
}

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
  <T>(arr: ArrayLike<T>): BidiIter<T, number>
} = arr =>
  newIdxed(
    arr.length,
    i => ({ v: arr[i], k: i }),
    (i, to, f) => {
      for (; i < to; i++) {
        if (!f(arr[i], i)) return false
      }
      return true
    },
    (to, i, f) => {
      while (i-- > to) {
        if (!f(arr[i], i)) return false
      }
      return true
    },
  )

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
  return newIter(
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
 * @param to 不能到达这个值。默认为 `Infinity`。
 * @param step 每个值的增量。默认为 1 或 -1，根据 `from` 和 `to` 的大小决定。若为 0，则返回空迭代器。
 *
 * @returns 迭代器，值为等差数列。若迭代器无限长，则不能反向迭代。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.range(3))).toEqual([0, 1, 2])
 * expect(X.toArr(X.range(-2, 2))).toEqual([-2, -1, 0, 1])
 * expect(X.toArr(X.range(2, -2))).toEqual([2, 1, 0, -1])
 * expect(X.toArr(X.range(1, 11, 3))).toEqual([1, 4, 7, 10])
 * expect(X.toArr(X.range(0, 0, 0))).toEqual([])
 * expect(X.range().c(
 *   X.take(5),
 *   X.toArr,
 * )).toEqual([0, 1, 2, 3, 4])
 * expect(X.range(1, 2, 0).c(
 *   X.take(3),
 *   X.toArr,
 * )).toEqual([1, 1, 1])
 * expect(() => X.range().c(
 *   X.rev,
 *   X.first,
 * )).toThrow('inf')
 * ```
 * ```
 */
export const range: {
  (to?: number): BidiIter<number, undefined>
  (from: number, to: number, step?: number): BidiIter<number, undefined>
} = (a = Infinity, b?: number, c?: number) => {
  let from = b != null ? a : 0
  let to = b ?? a
  let step = c ?? (from < to ? 1 : -1)
  return newIdxed(
    to === from ? 0 : step * (to - from) >= 0 ? Math.ceil((to - from) / step) : 0,
    i => ({
      v: from + i * step,
      k: undefined,
    }),
    (i, to, f) => {
      for (; i < to; i++) {
        if (!f(from + i * step, undefined)) return false
      }
      return true
    },

    (to, i, f) => {
      while (i-- > to) {
        if (!f(from + i * step, undefined)) return false
      }
      return true
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
  (): BidiIter<never, never>
} = () =>
  newIter<never, never, never, never>(
    () => undefined,
    () => {},
    _ => true,
    undefined,
    () => empty(),
    () => 0,
    _ => undefined,
    undefined,
    () => undefined,
    () => {},
    _ => true,
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
  <T>(v: T): BidiIter<T, undefined>
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
  <T, K>(v: T, k: K): BidiIter<T, K>
} = (v, k) => {
  let done = false
  let get = () => (done ? undefined : { v, k })
  let next = () => {
    done = true
  }
  let each = (f: (v_: typeof v, k_: typeof k) => boolean) => done || f(v, k)
  return newIter(
    get,
    next,
    each,
    undefined,
    (from, to) => (done || from > 0 || to < 1 ? empty() : onceKV(v, k)),
    () => 1 - +done,
    i => (i === 0 && !done ? { v, k } : undefined),
    undefined,
    get,
    next,
    each,
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
  <T>(v: T, n?: number): BidiIter<T, undefined>
} = (v, n = Infinity) => repeatKV(v, undefined, n)

/**
 * 重复某个值。
 *
 * @param v 值。
 * @param k 键。
 * @param n 自然数或无穷大。重复的次数。默认为 `Infinity`。
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
  <T, K>(v: T, k: K, n?: number): BidiIter<T, K>
} = (v, k, n = Infinity) => {
  let step = { v, k }
  return newIdxed(
    n,
    () => step,
    (i, to, f) => {
      for (; i < to; i++) if (!f(v, k)) return false
      return true
    },
    (to, i, f) => {
      while (i-- > to) if (!f(v, k)) return false
      return true
    },
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
  return newIter(
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
  <T>(obj: Record<string, T> | ArrayLike<T>): BidiIter<T, string>
  (obj: object): BidiIter<unknown, string>
} = <T>(obj: Record<string, T>) => {
  let keys: string[] | undefined
  return newIdxed(
    () => {
      keys ??= Object.keys(obj)
      return keys.length
    },
    i => ({ v: obj[keys![i]], k: keys![i] }),
    (i, to, f) => {
      for (; i < to; i++) {
        if (!f(obj[keys![i]], keys![i])) return false
      }
      return true
    },
    (to, i, f) => {
      while (i-- > to) {
        if (!f(obj[keys![i]], keys![i])) return false
      }
      return true
    },
  )
}
