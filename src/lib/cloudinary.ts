import 'server-only'
import { v2 as cloudinary } from 'cloudinary'
import { env } from '@/env'

let configured = false

function ensureConfigured() {
  if (configured) return
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    )
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  configured = true
}

export type UploadedImage = { publicId: string; url: string }

const FOLDERS = {
  worker: 'eems/public/worker-photos',
  employee: 'eems/public/employee-photos',
} as const

export type PhotoFolder = keyof typeof FOLDERS

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB server-side guard
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/**
 * Uploads a single image to the given logical folder. Validates type/size,
 * streams the file buffer to Cloudinary, and returns the public id + secure url.
 */
export async function uploadImage(file: File, folder: PhotoFolder): Promise<UploadedImage> {
  ensureConfigured()
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Unsupported image type. Use JPG, PNG, WEBP or HEIC.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image is too large. Maximum size is 8 MB.')
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const dataUri = `data:${file.type};base64,${bytes.toString('base64')}`

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: FOLDERS[folder],
    resource_type: 'image',
    overwrite: false,
  })

  return { publicId: result.public_id, url: result.secure_url }
}

/** Deletes an asset by public id. Best-effort — swallows "not found" errors. */
export async function deleteImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId) return
  ensureConfigured()
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
  } catch {
    // Ignore — an orphaned/already-deleted asset must not block the DB mutation.
  }
}
