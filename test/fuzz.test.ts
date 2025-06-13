import fc from 'fast-check'
import { expect, test } from 'vitest'
import * as F from './fuzz'

test('fuzz', () => {
  fc.assert(
    fc.property(F.arbConsume, consume => {
      // c.log(iter, consume)
      const out1: unknown[] = []
      const out2: unknown[] = []
      const val1 = F.consumeX(consume, out1)
      const val2 = F.consumeE(consume, out2)
      expect(out1).toEqual(out2)
      expect(val1).toEqual(val2)
    }),
    {},
  )
})
