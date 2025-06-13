// biome-ignore lint/correctness/noNodejsModules:
import { Console } from 'node:console'
import * as E from 'extra-iterable'
import fc from 'fast-check'
import { Pattern as P, match } from 'ts-pattern'
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

// https://www.zhihu.com/question/636393410/answer/3447170081
interface Lazy<T = any> {
  __lazy: T
}
type Get<L extends Lazy> = L['__lazy']

type IterBase<R extends Lazy> =
  | { t: 'empty' }
  | { t: 'once'; v: number; k: Key }
  | { t: 'repeat'; n: number; v: number; k: Key }
  | { t: 'arr'; arr: number[] }
  | { t: 'range'; from: number; to: number; step: number }
  | { t: 'obj'; obj: Record<string, number> }
  | { t: 'enum'; e: Get<R> }
  | { t: 'map'; e: Get<R>; fv: Mapper<number>; fk: Mapper<Key> }
  | { t: 'skip'; e: Get<R>; n: number }
  | { t: 'slice'; e: Get<R>; from: number; to: number }
  | { t: 'chain2'; e1: Get<R>; e2: Get<R> }
  | {
      t: 'zip2'
      e1: Get<R>
      e2: Get<R>
      fv: Zipper<number>
      fk: Zipper<Key>
    }
  | {
      t: 'zipAll2'
      e1: Get<R>
      e2: Get<R>
      fv: ZipperAll<number>
      fk: ZipperAll<Key>
    }
  | {
      t: 'chunk'
      e: Get<R>
      n: number
      last: boolean
      f: (v: number[]) => number
    }
  | {
      t: 'windows'
      e: Get<R>
      fv: (v1: number, k1: Key, v2: number, k2: Key) => number
      fk: (v1: number, k1: Key, v2: number, k2: Key) => Key
    }
  | {
      t: 'next'
      e: Get<R>
      n: number
    }

type IdxIter = IterBase<Lazy<IdxIter>>

type Iter =
  | IterBase<Lazy<Iter>>
  | { t: 'iter'; arr: number[] }
  | { t: 'succ'; f: (v: number) => number; init: number }
  | { t: 'flatMap'; e: Iter; f: Mapper<Iter> }
  | { t: 'scan'; e: Iter; f: Folder; init: number }
  | { t: 'filter'; e: Iter; f: Mapper<boolean> }
  | { t: 'takeWhile'; e: Iter; f: Mapper<boolean> }
  | { t: 'skipWhile'; e: Iter; f: Mapper<boolean> }
  | {
      t: 'splitBy'
      e: Iter
      fp: Mapper<boolean>
      fm: (v: number[]) => number
      inclusive: boolean
      last: boolean
    }

type Folder = (acc: number, v: number, k: Key) => number

export type Consume =
  | { t: 'all' | 'any' | 'find'; e: ConsumeRec; f: Mapper<boolean> }
  | {
      t: 'arr' | 'iter' | 'obj' | 'groupObj' | 'first' | 'last' | 'count' | 'map' | 'set'
      e: ConsumeRec
    }
  | { t: 'fold'; e: ConsumeRec; f: Folder; init: number }
  | { t: 'fold1'; e: ConsumeRec; f: Folder }

type ConsumeBase<R extends Lazy> =
  | { t: 'next'; e: Get<R>; n: number }
  | { t: 'length'; e: Get<ConsumeIdxRecL> }
  | { t: 'index'; e: Get<ConsumeIdxRecL>; i: number }
  | { t: 'partitionPoint'; e: Get<ConsumeIdxRecL>; x: number }

type ConsumeRec = ConsumeBase<Lazy<ConsumeRec>> | { t: 'leaf'; e: Iter }
type ConsumeIdxRec = ConsumeBase<ConsumeIdxRecL> | { t: 'leafIdx'; e: IdxIter }
type ConsumeIdxRecL = Lazy<ConsumeIdxRec>

const forever = (e: Iter): boolean =>
  match(e)
    .with({ t: P.union('empty', 'once', 'arr', 'iter', 'obj') }, () => false)
    .with({ t: P.union('range', 'succ', 'flatMap', 'repeat', 'scan') }, () => true)
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
          'next',
        ),
      },
      ({ e }) => forever(e),
    )
    .with({ t: 'slice' }, ({ e, to }) => to > 200 && forever(e))
    .with({ t: 'zip2' }, ({ e1, e2 }) => forever(e1) && forever(e2))
    .with({ t: P.union('zipAll2', 'chain2') }, ({ e1, e2 }) => forever(e1) || forever(e2))
    .exhaustive()

const take = <T extends Iter>(e: T): T | IterBase<Lazy<T>> =>
  forever(e) ? { t: 'slice', e, from: 0, to: 200 } : e

const inc = (e: ConsumeIdxRec): ConsumeIdxRec =>
  match<ConsumeIdxRec, ConsumeIdxRec>(e)
    .with({ t: 'leafIdx' }, ({ e }) => ({
      t: 'leafIdx',
      e: {
        t: 'map',
        e: { t: 'enum', e },
        fk: (v, k) => (v % 1000) + (k as number) * 1000,
        fv: v => v,
      },
    }))
    .with({ t: P.union('index', 'length', 'next') }, e => ({ ...e, e: inc(e.e) }))
    .with({ t: 'partitionPoint' }, e => e)
    .exhaustive()

const arbKey = () => fc.oneof(fc.integer(), fc.string())

const arbMapper = <T>(r: fc.Arbitrary<T>) => fc.func(r).map<Mapper<T>>(f => (v, k) => f(v, k))

const arbZipper = <T>(r: fc.Arbitrary<T>) =>
  fc.func(r).map<Zipper<T>>(f => (v1, k1, v2, k2) => f(v1, k1, v2, k2))

const arbZipperAll = <T>(r: fc.Arbitrary<T>) =>
  fc.func(r).map<ZipperAll<T>>(f => (v1, k1, v2, k2, c1, c2) => f(v1, k1, v2, k2, c1, c2))

const arbFolder = fc.func(fc.integer()).map<Folder>(f => (acc, v, k) => f(acc, v, k))

const arbOneof = <T>(...args: (false | fc.MaybeWeightedArbitrary<T>)[]) =>
  fc.oneof(...args.filter(x => x !== false))

const arbIdxIterLeaf = (): fc.Arbitrary<IdxIter>[] => [
  fc.constant({ t: 'empty' }),
  fc.tuple(fc.integer(), arbKey()).map(([v, k]) => ({ t: 'once', v, k })),
  fc
    .tuple(fc.integer(), fc.option(fc.nat()), arbKey())
    .map(([v, n, k]) => ({ t: 'repeat', n: n ?? Infinity, v, k })),
  fc.array(fc.integer()).map(arr => ({ t: 'arr', arr })),
  fc
    .array(fc.tuple(fc.string(), fc.integer()))
    .map(e => ({ t: 'obj', obj: Object.fromEntries(e) })),
  fc
    .tuple(fc.integer(), fc.integer(), fc.integer())
    .filter(([, b, step]) => b * step > 0)
    .map(([from, b, step]) => ({ t: 'range', from, to: from + b, step })),
]

const arbIterLeaf = (): fc.Arbitrary<Iter>[] => [
  ...arbIdxIterLeaf(),
  fc.array(fc.integer()).map(arr => ({ t: 'iter', arr })),
  fc
    .tuple(fc.integer(), fc.func(fc.integer()))
    .map(([init, f]) => ({ t: 'succ', f: a => f(a), init })),
]

const arbIdxIterRec = <R>(
  self: fc.Arbitrary<R>,
): fc.MaybeWeightedArbitrary<IterBase<Lazy<R>>>[] => [
  self.map(e => ({ t: 'enum', e })),
  fc.record({
    t: fc.constant('map'),
    e: self,
    fv: arbMapper(fc.integer()),
    fk: arbMapper(arbKey()),
  }),
  {
    weight: 5,
    arbitrary: fc
      .tuple(self, fc.nat(50))
      .chain(([e, to]) =>
        fc.nat(to ?? 20).map(from => ({ t: 'slice', e, from, to: to ?? Infinity })),
      ),
  },
  fc.record({
    t: fc.constantFrom('skip', 'next'),
    e: self,
    n: fc.nat(20),
  }),
  fc.tuple(self, self).map(([e1, e2]) => ({ t: 'chain2', e1, e2 })),
  fc.record({
    t: fc.constant('zip2'),
    e1: self,
    e2: self,
    fv: arbZipper(fc.integer()),
    fk: arbZipper(arbKey()),
  }),
  fc.record({
    t: fc.constant('zipAll2'),
    e1: self,
    e2: self,
    fv: arbZipperAll(fc.integer()),
    fk: arbZipperAll(arbKey()),
  }),
  {
    weight: 2,
    arbitrary: fc.record({
      t: fc.constant('chunk'),
      e: self,
      n: fc.integer({ min: 1, max: 20 }),
      last: fc.boolean(),
      f: fc.func(fc.integer()).map(f => (c: number[]) => f(c)),
    }),
  },
  fc.tuple(self, fc.func(fc.integer()), fc.func(arbKey())).map(([e, fv, fk]) => ({
    t: 'windows',
    e,
    fv: (v1: number, k1: Key, v2: number, k2: Key) => fv(v1, k1, v2, k2),
    fk: (v1: number, k1: Key, v2: number, k2: Key) => fk(v1, k1, v2, k2),
  })),
]

const arbIterRec = (self: fc.Arbitrary<Iter>): fc.MaybeWeightedArbitrary<Iter>[] => [
  ...arbIdxIterRec(self),
  fc.tuple(self.map(take), arbMapper(self)).map(([e, f]) => ({ t: 'flatMap', e, f })),
  fc.tuple(self, arbMapper(fc.boolean())).map(([e, f]) => ({ t: 'takeWhile', e, f })),
  fc.record({
    t: fc.constantFrom('filter', 'skipWhile'),
    e: self.map(take),
    f: arbMapper(fc.boolean()),
  }),
  fc.tuple(self, arbFolder, fc.integer()).map(([e, f, init]) => ({ t: 'scan', e, f, init })),
  fc.record({
    t: fc.constant('splitBy'),
    e: self.map(take),
    fp: arbMapper(fc.boolean()),
    fm: fc.func(fc.integer()).map(f => (c: number[]) => f(c)),
    inclusive: fc.boolean(),
    last: fc.boolean(),
  }),
]

const arbIterLet = fc.letrec<{ iter: Iter; idx: IdxIter }>(tie => ({
  idx: arbOneof(arbOneof(...arbIdxIterLeaf()), ...arbIdxIterRec(tie('idx'))),
  iter: arbOneof(arbOneof(...arbIterLeaf()), ...arbIterRec(tie('iter'))),
}))

const arbIter = arbIterLet.iter.map(take)
const arbIdxIter = arbIterLet.idx.map(take)

const arbConsumeBase = <R>(
  self: fc.Arbitrary<R>,
  idx: fc.Arbitrary<ConsumeIdxRec>,
): fc.Arbitrary<ConsumeBase<Lazy<R>>>[] => [
  fc.tuple(self, fc.nat(20)).map(([e, n]) => ({ t: 'next', e, n })),
  idx.map(e => ({ t: 'length', e })),
  fc.tuple(idx, fc.nat(20)).map(([e, i]) => ({ t: 'index', e, i })),
  fc.tuple(idx, fc.integer()).map(([e, x]) => ({ t: 'partitionPoint', e: inc(e), x })),
]

const { consume: arbConsumeRec } = fc.letrec<{
  consume: ConsumeRec
  idx: ConsumeIdxRec
}>(tie => ({
  consume: arbOneof<ConsumeRec>(
    arbIter.map(e => ({ t: 'leaf', e })),
    ...arbConsumeBase(tie('consume'), tie('idx')),
  ),
  idx: arbOneof<ConsumeIdxRec>(
    arbIdxIter.map(e => ({ t: 'leafIdx', e })),
    ...arbConsumeBase(tie('idx'), tie('idx')),
  ),
}))

export const arbConsume = arbOneof<Consume>(
  arbConsumeRec.map(e => ({ t: 'iter', e })),
  fc.record({
    t: fc.constantFrom('arr', 'obj', 'groupObj', 'first'),
    e: arbConsumeRec,
  }),
  fc.record({
    t: fc.constantFrom('last', 'count'),
    e: arbConsumeRec,
  }),
  fc.record({
    t: fc.constantFrom('all', 'any', 'find'),
    e: arbConsumeRec,
    f: arbMapper(fc.boolean()),
  }),
  fc.record({
    t: fc.constantFrom('fold', 'fold1'),
    e: arbConsumeRec,
    f: arbFolder,
    init: fc.integer(),
  }),
  fc.record({
    t: fc.constantFrom('fold', 'fold1'),
    e: arbConsumeRec,
    f: arbFolder,
    init: fc.integer(),
  }),
)

const iterBaseX = <R extends Lazy, Idx extends undefined>(
  e: IterBase<R>,
  rec: (r: Get<R>) => X.Iter<number, Key, Idx>,
): X.Iter<number, Key, Idx> =>
  match<IterBase<R>, X.Iter<number, Key, Idx>>(e)
    .with({ t: 'empty' }, () => X.empty())
    .with({ t: 'once' }, ({ v, k }) => X.onceKV(v, k))
    .with({ t: 'repeat' }, ({ n, v, k }) => X.repeatKV(v, k, n))
    .with({ t: 'arr' }, ({ arr }) => X.ofArr(arr))
    .with({ t: 'range' }, ({ from, to, step }) => X.range(from, to, step))
    .with({ t: 'obj' }, ({ obj }) => X.ofObj(obj))
    .with({ t: 'enum' }, ({ e }) => X.enume(rec(e)))
    .with({ t: 'map' }, ({ e, fv, fk }) => rec(e).c(X.mapKV(fv, fk)))
    .with({ t: 'slice' }, ({ e, from, to }) => rec(e).c(X.slice(from, to)))
    .with({ t: 'skip' }, ({ e, n }) => rec(e).c(X.skip(n)))
    .with({ t: 'zip2' }, ({ e1, e2, fv, fk }) => rec(e1).c(X.zipByKV(rec(e2), fv, fk)))
    .with({ t: 'chain2' }, ({ e1, e2 }) => rec(e2).c(X.prepend(rec(e1))))
    .with({ t: 'zipAll2' }, ({ e1, e2, fv, fk }) => rec(e1).c(X.zipAllByKV(rec(e2), fv, fk)))
    .with({ t: 'chunk' }, ({ e, n, last, f }) => rec(e).c(X.chunk(n, last), X.map(f)))
    .with({ t: 'windows' }, ({ e, fv, fk }) => rec(e).c(X.windowsByKV(fv, fk)))
    .with({ t: 'next' }, ({ e, n }) => {
      const iter = rec(e)
      X.current(iter)
      while (n--) X.moveNext(iter)
      return iter
    })
    .exhaustive()

const iterIdxX = (e: IdxIter): X.IdxIter<number, Key> => iterBaseX(e, iterIdxX)

const iterX = (e: Iter): X.Iter<number, Key> =>
  match<Iter, X.Iter<number, Key>>(e)
    .with({ t: 'succ' }, ({ f, init }) => X.succ(f, init))
    .with({ t: 'iter' }, ({ arr }) => X.ofIter(arr))
    .with({ t: 'flatMap' }, ({ e, f }) => iterX(e).c(X.flatMap((v, k) => iterX(f(v, k)))))
    .with({ t: 'filter' }, ({ e, f }) => iterX(e).c(X.filter(f)))
    .with({ t: 'scan' }, ({ e, f, init }) => iterX(e).c(X.scan(f, init)))
    .with({ t: 'takeWhile' }, ({ e, f }) => iterX(e).c(X.takeWhile(f)))
    .with({ t: 'skipWhile' }, ({ e, f }) => iterX(e).c(X.skipWhile(f)))
    .with({ t: 'splitBy' }, ({ e, fp, fm, inclusive, last }) =>
      iterX(e).c(X.splitBy(fp, inclusive, last), X.map(fm)),
    )
    .otherwise(e => iterBaseX(e, iterX))

export const consumeX = (e: Consume, out: unknown[]) =>
  match(e)
    .with({ t: 'arr' }, ({ e }) => X.toArr(consumeRecX(e, out)))
    .with({ t: 'iter' }, ({ e }) => Array.from(X.toIter(consumeRecX(e, out))))
    .with({ t: 'obj' }, ({ e }) =>
      consumeRecX(e, out).c(
        X.mapK((_, k) => String(k)),
        X.toObj,
      ),
    )
    .with({ t: 'groupObj' }, ({ e }) =>
      consumeRecX(e, out).c(
        X.mapK((_, k) => String(k)),
        X.groupObj,
      ),
    )
    .with({ t: 'first' }, ({ e }) => X.first(consumeRecX(e, out)))
    .with({ t: 'last' }, ({ e }) => X.last(consumeRecX(e, out)))
    .with({ t: 'count' }, ({ e }) => consumeRecX(e, out).c(X.count))
    .with({ t: 'map' }, ({ e }) => consumeRecX(e, out).c(X.toMap))
    .with({ t: 'set' }, ({ e }) => consumeRecX(e, out).c(X.toSet))
    .with({ t: 'all' }, ({ e, f }) => consumeRecX(e, out).c(X.all(f)))
    .with({ t: 'any' }, ({ e, f }) => consumeRecX(e, out).c(X.any(f)))
    .with({ t: 'find' }, ({ e, f }) => consumeRecX(e, out).c(X.find(f)))
    .with({ t: 'fold' }, ({ e, f, init }) => consumeRecX(e, out).c(X.fold(f, init)))
    .with({ t: 'fold1' }, ({ e, f }) => consumeRecX(e, out).c(X.fold1(f)))
    .exhaustive()

const consumeRecX = (e: ConsumeRec, out: unknown[]): X.Iter<number, Key> =>
  match(e)
    .with({ t: 'leaf' }, ({ e }) => iterX(e))
    .otherwise(e => consumeBaseX(e, out, consumeRecX))

const consumeIdxRecX = (e: ConsumeIdxRec, out: unknown[]): X.IdxIter<number, Key> =>
  match(e)
    .with({ t: 'leafIdx' }, ({ e }) => iterIdxX(e))
    .otherwise(e => consumeBaseX(e, out, consumeIdxRecX))

const consumeBaseX = <R, I extends X.Iter<number, Key>>(
  e: ConsumeBase<Lazy<R>>,
  out: unknown[],
  r: (e: R, out: unknown[]) => I,
): I | X.IdxIter<number, Key> =>
  match(e)
    .with({ t: 'next' }, ({ e, n }) => {
      const i = r(e, out)
      while (n--) {
        out.push(X.current(i))
        X.moveNext(i)
      }
      return i
    })
    .with({ t: 'length' }, ({ e }) => {
      const i = consumeIdxRecX(e, out)
      out.push(X.length(i))
      return i
    })
    .with({ t: 'index' }, ({ e, i }) => {
      const iter = consumeIdxRecX(e, out)
      out.push(iter.c(X.nth(i)))
      return iter
    })
    .with({ t: 'partitionPoint' }, ({ e, x }) => {
      const iter = consumeIdxRecX(e, out)
      out.push(iter.c(X.partitionPoint((_, k) => (k as number) > x)))
      return iter
    })
    .exhaustive()

const iterE = (e: Iter): Iterable<[number, Key]> =>
  match<Iter, Iterable<[number, Key]>>(e)
    .with({ t: 'empty' }, () => [])
    .with({ t: 'once' }, ({ v, k }) => [[v, k]])
    .with({ t: 'repeat' }, ({ n, v, k }) => E.repeat([[v, k]], n))
    .with({ t: 'succ' }, ({ f, init }) => E.map(E.fromApply(f, init), x => [x, undefined]))
    .with({ t: 'arr' }, ({ arr }) => E.map(E.entries(arr), ([k, v]) => [v, k]))
    .with({ t: 'iter' }, ({ arr }) => E.map(arr, x => [x, undefined]))
    .with({ t: 'range' }, ({ from, to, step }) =>
      E.map(E.fromRange(from, to, step), x => [x, undefined]),
    )
    .with({ t: 'obj' }, ({ obj }) => Object.entries(obj).map(([k, v]) => [v, k]))
    .with({ t: 'enum' }, ({ e }) => E.map(E.entries(iterE(e)), ([k, [v]]) => [v, k]))
    .with({ t: 'map' }, ({ e, fv, fk }) => E.map(iterE(e), ([v, k]) => [fv(v, k), fk(v, k)]))
    .with({ t: 'flatMap' }, ({ e, f }) => E.flatMap(iterE(e), ([v, k]) => iterE(f(v, k))))
    .with({ t: 'filter' }, ({ e, f }) => E.filter(iterE(e), ([v, k]) => f(v, k)))
    .with({ t: 'scan' }, ({ e, f, init }) =>
      E.accumulate(iterE(e), ([acc], [v, k]) => [f(acc, v, k), k], [init, undefined]),
    )
    .with({ t: 'takeWhile' }, ({ e, f }) => E.takeWhile(iterE(e), ([v, k]) => f(v, k)))
    .with({ t: 'skipWhile' }, ({ e, f }) => E.dropWhile(iterE(e), ([v, k]) => f(v, k)))
    .with({ t: 'slice' }, ({ e, from, to }) => E.slice(iterE(e), from, to))
    .with({ t: P.union('skip', 'next') }, ({ e, n }) => E.drop(iterE(e), n))
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
        ([[v1, k1], [v2, k2]]) => [fv(v1, k1, v2, k2), fk(v1, k1, v2, k2)] as const,
      ),
    )
    .exhaustive()

export const consumeE = (e: Consume, out: unknown[]) =>
  match(e)
    .with({ t: P.union('arr', 'iter') }, ({ e }) => Array.from(consumeRecE(e, out), ([v]) => v))
    .with({ t: 'obj' }, ({ e }) =>
      Object.fromEntries(E.map(consumeRecE(e, out), ([v, k]) => [String(k), v])),
    )
    .with({ t: 'groupObj' }, ({ e }) => {
      const obj: Record<string, number[]> = {}
      for (let [v, k] of consumeRecE(e, out)) {
        k = String(k)
        if (Object.prototype.hasOwnProperty.call(obj, k)) obj[k].push(v)
        else obj[k] = [v]
      }
      return obj
    })
    .with({ t: 'first' }, ({ e }) => E.get(consumeRecE(e, out), 0)?.[0])
    .with({ t: 'last' }, ({ e }) => E.last(consumeRecE(e, out))?.[0])
    .with({ t: 'count' }, ({ e }) => E.length(consumeRecE(e, out)))
    .with({ t: 'map' }, ({ e }) => new Map(consumeRecE(e, out)))
    .with({ t: 'set' }, ({ e }) => new Set(E.map(consumeRecE(e, out), ([v]) => v)))
    .with({ t: 'all' }, ({ e, f }) => E.every(consumeRecE(e, out), ([v, k]) => f(v, k)))
    .with({ t: 'any' }, ({ e, f }) => E.some(consumeRecE(e, out), ([v, k]) => f(v, k)))
    .with({ t: 'find' }, ({ e, f }) => E.find(consumeRecE(e, out), ([v, k]) => f(v, k))?.[0])
    .with({ t: 'fold' }, ({ e, f, init }) =>
      E.reduce(consumeRecE(e, out), (acc, [v, k]) => f(acc, v, k), init),
    )
    .with(
      { t: 'fold1' },
      ({ e, f }) =>
        E.reduce<[number, Key], [number]>(consumeRecE(e, out), ([acc], [v, k]) => [
          f(acc, v, k),
        ])?.[0],
    )
    .exhaustive()

const consumeRecE = (e: ConsumeRec | ConsumeIdxRec, out: unknown[]): Iterable<[number, Key]> =>
  match(e)
    .with({ t: P.union('leaf', 'leafIdx') }, ({ e }) => iterE(e))
    .with({ t: 'next' }, ({ e, n }) => {
      const iter = E.iterator(consumeRecE(e, out))
      while (n--) {
        const r = iter.next()
        out.push(r.done ? undefined : r.value[0])
      }
      return E.fromIterator(iter)
    })
    .with({ t: 'length' }, ({ e }) => {
      const arr = [...consumeRecE(e, out)]
      out.push(arr.length)
      return arr
    })
    .with({ t: 'index' }, ({ e, i }) => {
      const arr = [...consumeRecE(e, out)]
      out.push(arr[i]?.[0])
      return arr
    })
    .with({ t: 'partitionPoint' }, ({ e, x }) => {
      const arr = [...consumeRecE(e, out)]
      const idx = arr.findIndex(([, k]) => (k as number) > x)
      out.push(idx === -1 ? arr.length : idx)
      return arr
    })
    .exhaustive()

export const c = new Console({
  stdout: process.stdout,
  inspectOptions: { colors: true, depth: Infinity },
})
