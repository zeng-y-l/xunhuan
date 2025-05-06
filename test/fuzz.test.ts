// biome-ignore lint/correctness/noNodejsModules:
import { Console } from 'node:console'
import * as E from 'extra-iterable'
import fc, { type Arbitrary } from 'fast-check'
import { Pattern as P, match } from 'ts-pattern'
import { expect, test } from 'vitest'
import * as X from '../src'

fc.configureGlobal({ numRuns: Number(process.env.FUZZ_SIZE) || 300 })

type Key = undefined | number | string

type Mapper<R> = (v: number, k: Key) => R

type Zipper<R> = (v1: number, k1: Key, v2: number, k2: Key) => R
type ZipperAll<R> = (
  v1: X.Maybe<number>,
  k1: X.Maybe<Key>,
  v2: X.Maybe<number>,
  k2: X.Maybe<Key>,
  c1: boolean,
  c2: boolean,
) => R

type Iter =
  | { t: 'empty' }
  | { t: 'once'; v: number; k: Key }
  | { t: 'repeat'; n: number; v: number; k: Key }
  | { t: 'succ'; f: (v: number) => number; init: number }
  | { t: 'arr' | 'iter'; arr: number[] }
  | { t: 'range'; from: number; to: number; step: number }
  | { t: 'obj'; obj: Record<string, number> }
  | { t: 'enum'; e: Iter }
  | { t: 'map'; e: Iter; fv: Mapper<number>; fk: Mapper<Key> }
  | { t: 'skip'; e: Iter; n: number }
  | { t: 'slice'; e: Iter; from: number; to: number }
  | { t: 'flatMap'; e: Iter; f: Mapper<Iter> }
  | {
      t: 'filter' | 'takeWhile' | 'skipWhile'
      e: Iter
      f: Mapper<boolean>
    }
  | { t: 'scan'; e: Iter; f: Folder; init: number }
  | { t: 'chain2'; e1: Iter; e2: Iter }
  | {
      t: 'zip2'
      e1: Iter
      e2: Iter
      fv: Zipper<number>
      fk: Zipper<Key>
    }
  | {
      t: 'zipAll2'
      e1: Iter
      e2: Iter
      fv: ZipperAll<number>
      fk: ZipperAll<Key>
    }
  | {
      t: 'chunk'
      e: Iter
      n: number
      last: boolean
      f: (v: number[]) => number
    }
  | {
      t: 'splitBy'
      e: Iter
      fp: Mapper<boolean>
      fm: (v: number[]) => number
      inclusive: boolean
      last: boolean
    }
  | {
      t: 'windows'
      e: Iter
      fv: (v1: number, k1: Key, v2: number, k2: Key) => number
      fk: (v1: number, k1: Key, v2: number, k2: Key) => Key
    }

type Folder = (acc: number, v: number, k: Key) => number

type Consume =
  | { t: 'all' | 'any' | 'find'; f: Mapper<boolean> }
  | {
      t:
        | 'arr'
        | 'iter'
        | 'obj'
        | 'groupObj'
        | 'first'
        | 'last'
        | 'count'
        | 'map'
        | 'set'
    }
  | { t: 'fold'; f: Folder; init: number }
  | { t: 'fold1'; f: Folder }

const forever = (e: Iter): boolean =>
  match(e)
    .with({ t: P.union('empty', 'once', 'arr', 'iter', 'obj') }, () => false)
    .with(
      { t: P.union('range', 'succ', 'flatMap', 'repeat', 'scan') },
      () => true,
    )
    .with(
      {
        t: P.union(
          'map',
          'filter',
          'takeWhile',
          'skipWhile',
          'skip',
          'chunk',
          'splitBy',
          'enum',
          'windows',
        ),
      },
      ({ e }) => forever(e),
    )
    .with({ t: 'slice' }, ({ e, to }) => to > 200 && forever(e))
    .with({ t: 'zip2' }, ({ e1, e2 }) => forever(e1) && forever(e2))
    .with(
      { t: P.union('zipAll2', 'chain2') },
      ({ e1, e2 }) => forever(e1) || forever(e2),
    )
    .exhaustive()

const take = (e: Iter): Iter =>
  forever(e) ? { t: 'slice', e, from: 0, to: 200 } : e

const arbKey = () => fc.oneof(fc.integer(), fc.string())

const arbMapper = <T>(r: Arbitrary<T>) =>
  fc.func(r).map<Mapper<T>>(f => (v, k) => f(v, k))

const arbZipper = <T>(r: Arbitrary<T>) =>
  fc.func(r).map<Zipper<T>>(f => (v1, k1, v2, k2) => f(v1, k1, v2, k2))

const arbZipperAll = <T>(r: Arbitrary<T>) =>
  fc
    .func(r)
    .map<ZipperAll<T>>(
      f => (v1, k1, v2, k2, c1, c2) => f(v1, k1, v2, k2, c1, c2),
    )

const arbFolder = fc
  .func(fc.integer())
  .map<Folder>(f => (acc, v, k) => f(acc, v, k))

const _arbIter = fc.letrec<{ iter: Iter }>(tie => ({
  iter: fc.oneof<Arbitrary<Iter>[]>(
    fc.constant({ t: 'empty' }),
    fc.tuple(fc.integer(), arbKey()).map(([v, k]) => ({ t: 'once', v, k })),
    fc
      .tuple(fc.integer(), fc.option(fc.nat()), arbKey())
      .map(([v, n, k]) => ({ t: 'repeat', n: n ?? Infinity, v, k })),
    fc.record({
      t: fc.constantFrom('arr', 'iter'),
      arr: fc.array(fc.integer()),
    }),
    fc
      .array(fc.tuple(fc.string(), fc.integer()))
      .map(e => ({ t: 'obj', obj: Object.fromEntries(e) })),
    fc
      .tuple(fc.integer(), fc.func(fc.integer()))
      .map(([init, f]) => ({ t: 'succ', f: a => f(a), init })),
    fc
      .tuple(fc.integer(), fc.integer(), fc.integer())
      .filter(([, b, step]) => b * step > 0)
      .map(([from, b, step]) => ({ t: 'range', from, to: from + b, step })),
    tie('iter').map(e => ({ t: 'enum', e })),
    fc.record({
      t: fc.constant('map'),
      e: tie('iter'),
      fv: arbMapper(fc.integer()),
      fk: arbMapper(arbKey()),
    }),
    fc
      .tuple(tie('iter').map(take), arbMapper(tie('iter')))
      .map(([e, f]) => ({ t: 'flatMap', e, f })),
    fc
      .tuple(tie('iter'), arbMapper(fc.boolean()))
      .map(([e, f]) => ({ t: 'takeWhile', e, f })),
    fc.record({
      t: fc.constantFrom('filter', 'skipWhile'),
      e: tie('iter').map(take),
      f: arbMapper(fc.boolean()),
    }),
    fc
      .tuple(tie('iter'), arbFolder, fc.integer())
      .map(([e, f, init]) => ({ t: 'scan', e, f, init })),
    fc
      .tuple(tie('iter'), fc.nat(50))
      .chain(([e, to]) =>
        fc
          .nat(to ?? 20)
          .map(from => ({ t: 'slice', e, from, to: to ?? Infinity })),
      ),
    fc.tuple(tie('iter'), fc.nat(20)).map(([e, n]) => ({ t: 'skip', e, n })),
    fc
      .tuple(tie('iter'), tie('iter'))
      .map(([e1, e2]) => ({ t: 'chain2', e1, e2 })),
    fc.record({
      t: fc.constant('zip2'),
      e1: tie('iter'),
      e2: tie('iter'),
      fv: arbZipper(fc.integer()),
      fk: arbZipper(arbKey()),
    }),
    fc.record({
      t: fc.constant('zipAll2'),
      e1: tie('iter'),
      e2: tie('iter'),
      fv: arbZipperAll(fc.integer()),
      fk: arbZipperAll(arbKey()),
    }),
    fc.record({
      t: fc.constant('chunk'),
      e: tie('iter'),
      n: fc.integer({ min: 1, max: 20 }),
      last: fc.boolean(),
      f: fc.func(fc.integer()).map(f => (c: number[]) => f(c)),
    }),
    fc.record({
      t: fc.constant('splitBy'),
      e: tie('iter').map(take),
      fp: arbMapper(fc.boolean()),
      fm: fc.func(fc.integer()).map(f => (c: number[]) => f(c)),
      inclusive: fc.boolean(),
      last: fc.boolean(),
    }),
    fc
      .tuple(tie('iter'), fc.func(fc.integer()), fc.func(arbKey()))
      .map(([e, fv, fk]) => ({
        t: 'windows',
        e,
        fv: (v1: number, k1: Key, v2: number, k2: Key) => fv(v1, k1, v2, k2),
        fk: (v1: number, k1: Key, v2: number, k2: Key) => fk(v1, k1, v2, k2),
      })),
  ),
}))
const arbIter = _arbIter.iter.map(take)

const arbConsume = fc.oneof<Arbitrary<Consume>[]>(
  fc.constant({ t: 'iter' }),
  fc
    .constantFrom('arr', 'obj', 'groupObj', 'first', 'last', 'count')
    .map(t => ({ t })),
  fc.record({
    t: fc.constantFrom('all', 'any', 'find'),
    f: arbMapper(fc.boolean()),
  }),
  fc.record({
    t: fc.constantFrom('fold', 'fold1'),
    f: arbFolder,
    init: fc.integer(),
  }),
)

const iterX = (e: Iter): X.Iter<number, Key> =>
  match<Iter, X.Iter<number, Key>>(e)
    .with({ t: 'empty' }, () => X.empty())
    .with({ t: 'once' }, ({ v, k }) => X.onceKV(v, k))
    .with({ t: 'repeat' }, ({ n, v, k }) => X.repeatKV(v, k, n))
    .with({ t: 'succ' }, ({ f, init }) => X.succ(f, init))
    .with({ t: 'arr' }, ({ arr }) => X.ofArr(arr))
    .with({ t: 'iter' }, ({ arr }) => X.ofIter(arr))
    .with({ t: 'range' }, ({ from, to, step }) => X.range(from, to, step))
    .with({ t: 'obj' }, ({ obj }) => X.ofObj(obj))
    .with({ t: 'enum' }, ({ e }) => X.enume(iterX(e)))
    .with({ t: 'map' }, ({ e, fv, fk }) => iterX(e).c(X.mapKV(fv, fk)))
    .with({ t: 'flatMap' }, ({ e, f }) =>
      iterX(e).c(X.flatMap((v, k) => iterX(f(v, k)))),
    )
    .with({ t: 'filter' }, ({ e, f }) => iterX(e).c(X.filter(f)))
    .with({ t: 'scan' }, ({ e, f, init }) => iterX(e).c(X.scan(f, init)))
    .with({ t: 'takeWhile' }, ({ e, f }) => iterX(e).c(X.takeWhile(f)))
    .with({ t: 'skipWhile' }, ({ e, f }) => iterX(e).c(X.skipWhile(f)))
    .with({ t: 'slice' }, ({ e, from, to }) => iterX(e).c(X.slice(from, to)))
    .with({ t: 'skip' }, ({ e, n }) => iterX(e).c(X.skip(n)))
    .with({ t: 'zip2' }, ({ e1, e2, fv, fk }) =>
      iterX(e1).c(X.zipByKV(iterX(e2), fv, fk)),
    )
    .with({ t: 'chain2' }, ({ e1, e2 }) => iterX(e2).c(X.prepend(iterX(e1))))
    .with({ t: 'zipAll2' }, ({ e1, e2, fv, fk }) =>
      iterX(e1).c(X.zipAllByKV(iterX(e2), fv, fk)),
    )
    .with({ t: 'chunk' }, ({ e, n, last, f }) =>
      iterX(e).c(X.chunk(n, last), X.map(f)),
    )
    .with({ t: 'splitBy' }, ({ e, fp, fm, inclusive, last }) =>
      iterX(e).c(X.splitBy(fp, inclusive, last), X.map(fm)),
    )
    .with({ t: 'windows' }, ({ e, fv, fk }) =>
      iterX(e).c(X.windowsByKV(fv, fk)),
    )
    .exhaustive()

const consumeX = (e: Consume, i: X.Iter<number, Key>) =>
  match(e)
    .with({ t: 'arr' }, () => X.toArr(i))
    .with({ t: 'iter' }, () => Array.from(X.toIter(i)))
    .with({ t: 'obj' }, () =>
      i.c(
        X.mapK((_, k) => String(k)),
        X.toObj,
      ),
    )
    .with({ t: 'groupObj' }, () =>
      i.c(
        X.mapK((_, k) => String(k)),
        X.groupObj,
      ),
    )
    .with({ t: 'first' }, () => X.first(i))
    .with({ t: 'last' }, () => X.last(i))
    .with({ t: 'count' }, () => i.c(X.count))
    .with({ t: 'map' }, () => i.c(X.toMap))
    .with({ t: 'set' }, () => i.c(X.toSet))
    .with({ t: 'all' }, ({ f }) => i.c(X.all(f)))
    .with({ t: 'any' }, ({ f }) => i.c(X.any(f)))
    .with({ t: 'find' }, ({ f }) => i.c(X.find(f)))
    .with({ t: 'fold' }, ({ f, init }) => i.c(X.fold(f, init)))
    .with({ t: 'fold1' }, ({ f }) => i.c(X.fold1(f)))
    .exhaustive()

const iterE = (e: Iter): Iterable<[number, Key]> =>
  match<Iter, Iterable<[number, Key]>>(e)
    .with({ t: 'empty' }, () => [])
    .with({ t: 'once' }, ({ v, k }) => [[v, k]])
    .with({ t: 'repeat' }, ({ n, v, k }) => E.repeat([[v, k]], n))
    .with({ t: 'succ' }, ({ f, init }) =>
      E.map(E.fromApply(f, init), x => [x, undefined]),
    )
    .with({ t: 'arr' }, ({ arr }) => E.map(E.entries(arr), ([k, v]) => [v, k]))
    .with({ t: 'iter' }, ({ arr }) => E.map(arr, x => [x, undefined]))
    .with({ t: 'range' }, ({ from, to, step }) =>
      E.map(E.fromRange(from, to, step), x => [x, undefined]),
    )
    .with({ t: 'obj' }, ({ obj }) =>
      Object.entries(obj).map(([k, v]) => [v, k]),
    )
    .with({ t: 'enum' }, ({ e }) =>
      E.map(E.entries(iterE(e)), ([k, [v]]) => [v, k]),
    )
    .with({ t: 'map' }, ({ e, fv, fk }) =>
      E.map(iterE(e), ([v, k]) => [fv(v, k), fk(v, k)]),
    )
    .with({ t: 'flatMap' }, ({ e, f }) =>
      E.flatMap(iterE(e), ([v, k]) => iterE(f(v, k))),
    )
    .with({ t: 'filter' }, ({ e, f }) =>
      E.filter(iterE(e), ([v, k]) => f(v, k)),
    )
    .with({ t: 'scan' }, ({ e, f, init }) =>
      E.accumulate(iterE(e), ([acc], [v, k]) => [f(acc, v, k), k], [
        init,
        undefined,
      ]),
    )
    .with({ t: 'takeWhile' }, ({ e, f }) =>
      E.takeWhile(iterE(e), ([v, k]) => f(v, k)),
    )
    .with({ t: 'skipWhile' }, ({ e, f }) =>
      E.dropWhile(iterE(e), ([v, k]) => f(v, k)),
    )
    .with({ t: 'slice' }, ({ e, from, to }) => E.slice(iterE(e), from, to))
    .with({ t: 'skip' }, ({ e, n }) => E.drop(iterE(e), n))
    .with({ t: 'chain2' }, ({ e1, e2 }) => E.concat(iterE(e1), iterE(e2)))
    .with({ t: 'zip2' }, ({ e1, e2, fv, fk }) =>
      E.map(E.zip([iterE(e1), iterE(e2)]), ([[v1, k1], [v2, k2]]) => [
        fv(v1, k1, v2, k2),
        fk(v1, k1, v2, k2),
      ]),
    )
    .with({ t: 'zipAll2' }, ({ e1, e2, fv, fk }) =>
      E.map(
        E.zip([iterE(e1), iterE(e2)], x => x, E.every),
        ([a, b]) => [
          fv(a?.[0], a?.[1], b?.[0], b?.[1], !!a, !!b),
          fk(a?.[0], a?.[1], b?.[0], b?.[1], !!a, !!b),
        ],
      ),
    )
    .with({ t: 'chunk' }, ({ e, n, last, f }) =>
      E.map(
        E.filter(
          E.chunk(
            E.map(iterE(e), ([v]) => v),
            n,
          ),
          c => last || c.length === n,
        ),
        c => [f(c), undefined],
      ),
    )
    .with({ t: 'splitBy' }, ({ e, fp, fm, inclusive, last }) => {
      const arr = Array.from(E.cutRight(iterE(e), ([v, k]) => fp(v, k)))
      if (!inclusive) {
        for (const c of E.pop(arr)) c.pop()
      }
      if (!last) arr.pop()
      else if (arr.length === 0) arr.push([])
      return E.map(arr, c => [fm(c.map(([v]) => v)), undefined])
    })
    .with({ t: 'windows' }, ({ e, fv, fk }) =>
      E.map(
        E.pop(E.chunk(iterE(e), 2, 1)),
        ([[v1, k1], [v2, k2]]) =>
          [fv(v1, k1, v2, k2), fk(v1, k1, v2, k2)] as const,
      ),
    )
    .exhaustive()

const consumeE = (e: Consume, i: Iterable<[number, Key]>) =>
  match(e)
    .with({ t: P.union('arr', 'iter') }, () => Array.from(i, ([v]) => v))
    .with({ t: 'obj' }, () =>
      Object.fromEntries(E.map(i, ([v, k]) => [String(k), v])),
    )
    .with({ t: 'groupObj' }, () => {
      const obj: Record<string, number[]> = {}
      for (let [v, k] of i) {
        k = String(k)
        if (Object.prototype.hasOwnProperty.call(obj, k)) obj[k].push(v)
        else obj[k] = [v]
      }
      return obj
    })
    .with({ t: 'first' }, () => E.get(i, 0)?.[0])
    .with({ t: 'last' }, () => E.last(i)?.[0])
    .with({ t: 'count' }, () => E.length(i))
    .with({ t: 'map' }, () => new Map(i))
    .with({ t: 'set' }, () => new Set(E.map(i, ([v]) => v)))
    .with({ t: 'all' }, ({ f }) => E.every(i, ([v, k]) => f(v, k)))
    .with({ t: 'any' }, ({ f }) => E.some(i, ([v, k]) => f(v, k)))
    .with({ t: 'find' }, ({ f }) => E.find(i, ([v, k]) => f(v, k))?.[0])
    .with({ t: 'fold' }, ({ f, init }) =>
      E.reduce(i, (acc, [v, k]) => f(acc, v, k), init),
    )
    .with(
      { t: 'fold1' },
      ({ f }) =>
        E.reduce<[number, Key], [number]>(i, ([acc], [v, k]) => [
          f(acc, v, k),
        ])?.[0],
    )
    .exhaustive()

// biome-ignore lint/correctness/noUnusedVariables:
const c = new Console({
  stdout: process.stdout,
  inspectOptions: { colors: true, depth: Infinity },
})

test('fuzz', () => {
  fc.assert(
    fc.property(arbIter, arbConsume, (iter, consume) => {
      // c.log(iter, consume)
      const val1 = consumeX(consume, iterX(iter))
      const val2 = consumeE(consume, iterE(iter))
      expect(val1).toEqual(val2)
    }),
    {},
  )
})
