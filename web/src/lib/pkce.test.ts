import { describe, expect, it } from 'vitest'
import { challengeS256, createPkcePair, randomVerifier } from './pkce'

describe('pkce', () => {
  it('creates verifier of sufficient length', () => {
    const v = randomVerifier()
    expect(v.length).toBeGreaterThanOrEqual(43)
  })

  it('challenge is deterministic for a verifier', async () => {
    const v = 'a'.repeat(43)
    const a = await challengeS256(v)
    const b = await challengeS256(v)
    expect(a).toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(43)
  })

  it('createPkcePair returns distinct state', async () => {
    const a = await createPkcePair()
    const b = await createPkcePair()
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.state).not.toBe(b.state)
    expect(a.challenge).toBeTruthy()
  })
})
