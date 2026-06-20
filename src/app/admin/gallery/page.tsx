import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getGlobalGallery,
  getGlobalGalleryFilterOptions,
  getUploadableSites,
} from '@/actions/site-photos'
import { GalleryView } from '@/components/gallery/GalleryView'

export default async function GlobalGalleryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const [photos, options, uploadableSites] = await Promise.all([
    getGlobalGallery(),
    getGlobalGalleryFilterOptions(),
    getUploadableSites(),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Gallery</h1>
      <GalleryView
        mode="global"
        isAdmin
        canUpload={uploadableSites.length > 0}
        uploadableSites={uploadableSites}
        initialPhotos={photos}
        uploaders={options.uploaders}
        sites={options.sites}
        cities={options.cities}
      />
    </div>
  )
}
