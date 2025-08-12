import * as vitest from 'vitest'
import { vi } from 'vitest'

// for doctest
vi.stubGlobal('X', await import('../src'))

// for debug assertion
if (import.meta.env.MODE === 'test') vi.stubGlobal('V', vitest)
