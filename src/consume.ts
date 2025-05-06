// biome-ignore lint/correctness/noUnusedImports: for jsdoc link
import type * as X from '.'
import type { Iter, Maybe, ValOf } from './base'

/**
 * 获取第一个值。
 *
 * 方法，返回输入迭代器的第一个值。若空则返回 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.first(X.ofArr([1, 2, 3]))).toEqual(1)
 * expect(X.first(X.empty())).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.last}
 */
export const first: {
  <T>(self: Iter<T>): Maybe<T>
} = self => {
  self.k()
  let r: Maybe<ValOf<typeof self>>
  self.e(v => {
    r = v
    return false
  })
  return r
}

/**
 * 获取最后一个值。
 *
 * 方法，返回输入迭代器的最后一个值。若空则返回 `undefined`。
 *
 * TODO: 目前的时间复杂度始终是线性。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.last(X.ofArr([1, 2, 3]))).toEqual(3)
 * expect(X.last(X.empty())).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.first}
 */
export const last: {
  <T>(self: Iter<T>): Maybe<T>
} = self => {
  self.k()
  let r: Maybe<ValOf<typeof self>>
  self.e(v => {
    r = v
    return true
  })
  return r
}

/**
 * 遍历每个值。
 *
 * 不能提前退出。若需要，请使用 {@linkcode X.all}。
 *
 * @param f 函数。参数为值和键，无返回值。
 *
 * @returns 方法，无返回值。
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
 * @see {@linkcode X.all}
 */
export const forEach: {
  <T, K>(f: (v: T, k: K) => void): (self: Iter<T, K>) => void
} = f => self => {
  self.k()
  self.e((v, k) => {
    f(v, k)
    return true
  })
}

/**
 * 判断所有值都满足条件。
 *
 * 若有不满足条件的，则提前退出。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 *
 * @returns 方法，返回是否所有值都满足条件。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3]
 * expect(X.ofArr(arr).c(
 *   X.all(x => x < 4),
 * )).toEqual(true)
 * expect(X.ofArr(arr).c(
 *   X.all(x => x >= 2),
 * )).toEqual(false)
 * ```
 *
 * @see {@linkcode X.any}
 */
export const all: {
  <T, K>(pred: (v: T, k: K) => boolean): (self: Iter<T, K>) => boolean
} = pred => self => {
  self.k()
  return self.e(pred)
}

/**
 * 判断存在值满足条件。
 *
 * 若有满足条件的，则提前退出。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 *
 * @returns 方法，返回是否存在值满足条件。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3]
 * expect(X.ofArr(arr).c(
 *   X.any(x => x < 4),
 * )).toEqual(true)
 * expect(X.ofArr(arr).c(
 *   X.any(x => x >= 2),
 * )).toEqual(true)
 * ```
 *
 * @see {@linkcode X.all}
 */
export const any: {
  <T, K>(pred: (v: T, k: K) => boolean): (self: Iter<T, K>) => boolean
} = pred => self => {
  self.k()
  return !self.e((v, k) => !pred(v, k))
}

/**
 * 查找值。
 *
 * 一找到就提前退出。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 *
 * @returns 方法，返回第一个满足条件的值，没有则返回 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3]
 * expect(X.ofArr(arr).c(
 *   X.find(x => x >= 2),
 * )).toEqual(2)
 * expect(X.ofArr(arr).c(
 *   X.find(x => x >= 4),
 * )).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.findMap}
 */
export const find: {
  <T, K>(pred: (v: T, k: K) => boolean): (self: Iter<T, K>) => Maybe<T>
} = pred => findMap(pred, v => v)

/**
 * 查找值并映射。
 *
 * 一找到就提前退出。
 *
 * @param pred 函数。参数为值和键，返回是否满足条件。
 * @param f 函数。参数为值和键，返回结果。
 *
 * @returns 方法，返回第一个满足条件的值经过 `f` 映射的结果，没有则返回 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * const arr = [1, 2, 3]
 * expect(X.ofArr(arr).c(
 *   X.findMap(x => x >= 2, (_, i) => i),
 * )).toEqual(1)
 * expect(X.ofArr(arr).c(
 *   X.findMap(x => x >= 4, (_, i) => i),
 * )).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.find}
 */
export const findMap: {
  <T, K, R>(
    pred: (v: T, k: K) => boolean,
    f: (v: T, k: K) => R,
  ): (self: Iter<T, K>) => Maybe<R>
} = (pred, f) => self => {
  self.k()
  let val: Maybe<ReturnType<typeof f>>
  self.e((v, k) => {
    let found = pred(v, k)
    if (found) val = f(v, k)
    return !found
  })
  return val
}

/**
 * 迭代器转数组。
 *
 * 方法，返回迭代器所有值组成的数组。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.toArr(X.range(3))).toEqual([0, 1, 2])
 * ```
 *
 * @see {@linkcode X.ofArr}
 */
export const toArr: {
  <T>(self: Iter<T>): T[]
} = <T>(self: Iter<T>) => {
  self.k()
  let arr: T[] = []
  self.e(v => {
    arr.push(v)
    return true
  })
  return arr
}

/**
 * 迭代器转原生迭代器。
 *
 * 方法，返回原生迭代器。
 *
 * @example
 * ```ts @import.meta.vitest
 * for (const x of X.toIter(X.range(3))) {
 *   expect(x).toBeOneOf([0, 1, 2])
 * }
 * ```
 *
 * @see {@linkcode X.ofIter}
 * @see {@linkcode X.toArr}
 */
export const toIter: {
  <T>(self: Iter<T>): IterableIterator<T>
} = <T>(self: Iter<T>) => {
  self.k()
  let { i: init, g: get, n: next } = self
  init?.()
  return {
    next() {
      let step = get()
      next()
      return step
        ? { done: false, value: step.v }
        : { done: true, value: undefined }
    },
    [Symbol.iterator]() {
      return this
    },
  }
}

/**
 * 折叠所有值，提供最初状态，返回最终状态。
 *
 * 类似 {@linkcode Array.reduce}。
 *
 * 若需要中间状态，请用 {@linkcode X.scan}。
 * 若要用第一个值作为状态，请用 {@linkcode X.fold1}。
 *
 * @param f 函数。参数为当前状态、值和键，返回值为新的状态。
 *
 * @return 方法，返回最终状态。若输入为空，则返回最初状态。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.fold((a, b) => `${a}${b},`, ''),
 * )).toEqual('1,2,3,')
 * expect(X.empty().c(
 *   X.fold((a, b) => `${a}${b},`, ''),
 * )).toEqual('')
 * ```
 *
 * @see {@linkcode X.scan}
 * @see {@linkcode X.fold1}
 */
export const fold: {
  <T, K, R>(f: (acc: R, v: T, k: K) => R, init: R): (self: Iter<T, K>) => R
} = (f, init) => self => {
  self.k()
  let acc = init
  self.e((v, k) => {
    acc = f(acc, v, k)
    return true
  })
  return acc
}

/**
 * 折叠所有值，以第一个值为最初状态，返回最终状态。
 *
 * 类似 {@linkcode Array.reduce}。
 *
 * 若要手动提供最初状态，请用 {@linkcode X.fold1}。
 *
 * @param f 函数。参数为当前状态、值和键，返回值为新的状态。
 *
 * @return 方法，返回最终状态。若输入为空，则返回 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([1, 2, 3]).c(
 *   X.fold1((a, b) => `${a},${b}`),
 * )).toEqual('1,2,3')
 * expect(X.empty().c(
 *   X.fold1((a, b) => `${a},${b}`),
 * )).toEqual(undefined)
 * ```
 *
 * @see {@linkcode X.fold}
 */
export const fold1: {
  <T, K>(f: (acc: T, v: T, k: K) => T): (self: Iter<T, K>) => Maybe<T>
} = f => self => {
  self.k()
  let { i: init, g: get, n: next } = self
  init?.()
  let fst = get()
  if (!fst) return
  next()
  self.u = false
  return fold(f, fst.v)(self)
}

/**
 * 计算长度。
 *
 * 方法，返回迭代器的长度。
 *
 * TODO: 目前的时间复杂度始终是线性。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.count(X.empty())).toEqual(0)
 * expect(X.count(X.ofArr([1, 2, 3, 4]))).toEqual(4)
 * ```
 *
 * @see {@linkcode X.fold}
 */
export const count: {
  (self: Iter<unknown>): number
} = /* @__PURE__ */ fold((a, _) => a + 1, 0)

/**
 * 求和。
 *
 * 方法，返回迭代器中所有数字的和，空则为 0。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.sum(X.empty())).toEqual(0)
 * expect(X.sum(X.ofArr([1, 2, 3, 4]))).toEqual(10)
 * ```
 *
 * @see {@linkcode X.fold}
 * @see {@linkcode X.product}
 */
export const sum: {
  (self: Iter<number>): number
} = /* @__PURE__ */ fold((a, b) => a + b, 0)

/**
 * 求积。
 *
 * 方法，返回迭代器中所有数字的积，空则为 1。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.product(X.empty())).toEqual(1)
 * expect(X.product(X.ofArr([1, 2, 3, 4]))).toEqual(24)
 * ```
 *
 * @see {@linkcode X.fold}
 * @see {@linkcode X.sum}
 */
export const product: {
  (self: Iter<number>): number
} = /* @__PURE__ */ fold((a, b) => a * b, 1)

/**
 * 求最小值。
 *
 * 使用 `>` 比较，支持任意类型。
 *
 * 方法，返回迭代器中的最小值，空则为 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.min(X.empty())).toEqual(undefined)
 * expect(X.min(X.ofArr([2, 3, 4, 1]))).toEqual(1)
 * expect(X.min(X.ofArr('cdab'))).toEqual('a')
 * ```
 *
 * @see {@linkcode X.fold1}
 * @see {@linkcode X.max}
 */
export const min: {
  <T>(self: Iter<T>): Maybe<T>
} = /* @__PURE__ */ fold1((l, r) => (l > r ? r : l))

/**
 * 求最大值。
 *
 * 使用 `>` 比较，支持任意类型。
 *
 * 方法，返回迭代器中的最大值，空则为 `undefined`。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.max(X.empty())).toEqual(undefined)
 * expect(X.max(X.ofArr([2, 3, 4, 1]))).toEqual(4)
 * expect(X.max(X.ofArr('cdab'))).toEqual('d')
 * ```
 *
 * @see {@linkcode X.fold1}
 * @see {@linkcode X.min}
 */
export const max: {
  <T>(self: Iter<T>): Maybe<T>
} = /* @__PURE__ */ fold1((l, r) => (l > r ? l : r))

/**
 * 迭代器转对象，类似 {@linkcode Object.fromEntries}。
 *
 * 效果等同于 `Object.fromEntries(X.toArr(X.toEntries(iter)))`。
 *
 * 方法，返回对象，键重复则取后者。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([['a', 1], ['b', 2], ['a', 3]]).c(
 *   X.ofEntries,
 *   X.toObj,
 * )).toEqual({ a: 3, b: 2 })
 * ```
 *
 * @see {@linkcode X.ofObj}
 * @see {@linkcode X.groupObj}
 * @see {@linkcode X.toArr}
 * @see {@linkcode X.toEntries}
 */
export const toObj: {
  <T, K extends keyof any>(self: Iter<T, K>): Record<K, T>
} = self => {
  self.k()
  let obj: Record<keyof any, ValOf<typeof self>> = {}
  self.e((v, k) => {
    obj[k] = v
    return true
  })
  return obj
}

/**
 * 迭代器转对象，键相同的放在数组里。
 *
 * 方法，返回对象，属性值为数组，数组元素为输入迭代器中键为属性键的对应值。
 *
 * @example
 * ```ts @import.meta.vitest
 * expect(X.ofArr([['a', 1], ['b', 2], ['a', 3]]).c(
 *   X.ofEntries,
 *   X.groupObj,
 * )).toEqual({ a: [1, 3], b: [2] })
 * ```
 *
 * @see {@linkcode X.toObj}
 */
export const groupObj: {
  <T, K extends keyof any>(self: Iter<T, K>): Record<K, T[]>
} = self => {
  self.k()
  let obj: Record<keyof any, ValOf<typeof self>[]> = {}
  self.e((v, k) => {
    if (Object.prototype.hasOwnProperty.call(obj, k)) obj[k].push(v)
    else obj[k] = [v]
    return true
  })
  return obj
}
