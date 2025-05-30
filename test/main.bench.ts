import * as E from 'extra-iterable'
import M from 'immutable'
import * as I from 'iterare'
import Lazy from 'lazy.js'
import _ from 'lodash'
import { bench, describe } from 'vitest'
import * as X from '../src'

describe('flatMap', () => {
  const arr = Array.from({ length: 300 }, Math.random)

  bench('native loop', () => {
    const out: string[] = []
    for (let i = 0; i < arr.length; i++) {
      for (const c of String(arr[i])) {
        if (c !== '.') out.push(c)
      }
    }
  })

  bench('native array method', () => {
    arr.flatMap(x => [...String(x)]).filter(x => x !== '.')
  })

  bench('xunhuan', () => {
    X.ofArr(arr).c(
      X.flatMap(x => X.ofIter(String(x))),
      X.filter(x => x !== '.'),
      X.toArr,
    )
  })

  bench('lazy.js', () => {
    Lazy(arr)
      .map(x => Lazy([...String(x)]))
      .flatten(true)
      .filter(x => x !== '.')
      .toArray()
  })

  bench('extra-iterable', () => {
    Array.from(
      E.filter(
        E.flatMap(
          arr,
          x => String(x),
          () => true,
        ),
        x => x !== '.',
      ),
    )
  })

  bench('iterare', () => {
    I.iterate(arr)
      .map(x => new String(x))
      .flatten()
      .filter(x => x !== '.')
      .toArray()
  })

  bench('lodash', () => {
    _(arr)
      .flatMap(x => [...String(x)])
      .filter(x => x !== '.')
      .value()
  })

  bench('immutable', () => {
    M.Seq(arr)
      .flatMap(x => String(x))
      .filter(x => x !== '.')
      .toArray()
  })
})

describe('range', () => {
  bench('native loop', () => {
    let flag = true
    // biome-ignore lint/correctness/noUnusedVariables:
    let sum = 0
    for (let x = 0; x < 1000; x++) {
      if (x % 2 !== 0) continue
      const x1 = x * x
      if (flag) {
        if (x1 < 1000) continue
        flag = false
      }
      sum += x1
    }
  })

  bench('xunhuan', () => {
    X.range(1000).c(
      X.filter(x => x % 2 === 0),
      X.map(x => x * x),
      X.skipWhile(x => x < 1000),
      X.sum,
    )
  })

  bench('lazy.js', () => {
    Lazy.range(1000)
      .filter(x => x % 2 === 0)
      .map(x => x * x)
      .dropWhile(x => x < 1000)
      .sum()
  })

  bench('extra-iterable', () => {
    E.reduce(
      E.dropWhile(
        E.map(
          E.filter(E.fromRange(0, 1000), x => x % 2 === 0),
          x => x * x,
        ),
        x => x < 1000,
      ),
      (a, x) => a + x,
      0,
    )
  })

  bench('lodash', () => {
    _(0)
      .range(1000)
      .filter(x => x % 2 === 0)
      .map(x => x * x)
      .dropWhile(x => x < 1000)
      .sum()
  })

  bench('immutable', () => {
    M.Range(0, 1000)
      .filter(x => x % 2 === 0)
      .map(x => x * x)
      .skipWhile(x => x < 1000)
      .reduce((a, b) => a + b, 0)
  })
})

describe('zip', () => {
  const arr = Array.from({ length: 1000 }, Math.random)

  bench('native loop', () => {
    let max = -Infinity
    let j = 0
    for (let i = 0; i < arr.length && j < arr.length; i++) {
      if (arr[i] <= 0.1) continue
      max = Math.max(max, arr[i] + arr[j])
      j++
    }
  })

  bench('xunhuan', () => {
    X.ofArr(arr).c(
      X.filter(x => x > 0.1),
      X.zipBy(X.ofArr(arr), (a, _, b) => a + b),
      X.max,
    )
  })

  bench('lazy.js', () => {
    Lazy(arr)
      .filter(x => x > 0.1)
      .zip(arr)
      .map(([a, b]: any) => (a + b) as number)
      .max()
  })

  bench('extra-iterable', () => {
    E.max(E.zip([E.filter(arr, x => x > 0.1), arr], ([a, b]) => a + b))
  })

  bench('iterare', () => {
    I.zip(
      I.iterate(arr).filter(x => x > 0.1),
      arr,
    )
      .map(([a, b]) => a + b)
      .reduce((a, b) => Math.max(a, b), -Infinity)
  })

  bench('lodash', () => {
    _(arr)
      .filter(x => x > 0.1)
      .zipWith(arr, (a, b) => a + b)
      .max()
  })

  bench('immutable', () => {
    M.Seq(arr)
      .filter(x => x > 0.1)
      .zipWith((a, b) => a + b, M.Seq(arr))
      .max()
  })
})
