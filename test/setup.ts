import { vi } from 'vitest'

// for doctest
vi.stubGlobal('X', await import('../src'))
