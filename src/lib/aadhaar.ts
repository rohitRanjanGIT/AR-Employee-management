import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { env } from '@/env'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(env.AADHAAR_ENCRYPTION_KEY, 'hex')

export function encryptAadhaar(aadhaar: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(aadhaar, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptAadhaar(encrypted: string): string {
  const [ivHex, authTagHex, dataHex] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function maskAadhaar(lastFour: string): string {
  return `XXXX-XXXX-${lastFour}`
}

export function extractLastFour(aadhaar: string): string {
  return aadhaar.slice(-4)
}
