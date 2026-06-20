import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getSupervisorGallery,
  getSupervisorGalleryFilterOptions,
  getUploadableSites,
} from '@/actions/site-photos'
import { GalleryView } from '@/components/gallery/GalleryView'

export default async function SupervisorGalleryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const [photos, options, uploadableSites] = await Promise.all([
    getSupervisorGallery(),
    getSupervisorGalleryFilterOptions(),
    getUploadableSites(),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Gallery</h1>
        <p className="text-sm text-muted-foreground">Photos across all your assigned sites.</p>
      </div>

      <GalleryView
        mode="supervisor"
        isAdmin={false}
        canUpload={uploadableSites.length > 0}
        uploadableSites={uploadableSites}
        initialPhotos={photos}
        uploaders={[]}
        sites={options.sites}
      />
    </div>
  )
}
