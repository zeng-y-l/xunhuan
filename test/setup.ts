import { vi } from 'vitest'
import * as vitest from 'vitest'

// for doctest
vi.stubGlobal('X', await import('../src'))

// for debug assertion
if (import.meta.env.MODE === 'test') vi.stubGlobal('V', vitest)
