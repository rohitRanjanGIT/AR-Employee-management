import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import {
  getGallerySite,
  getSitePhotos,
  getSiteGalleryUploaders,
  getUploadableSites,
} from '@/actions/site-photos'
import { GalleryView } from '@/components/gallery/GalleryView'

export default async function AdminSiteGalleryPage({
  params,
}: {
  params: Promise<{ siteId: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { siteId } = await params

  let site
  try {
    site = await getGallerySite(siteId)
  } catch {
    notFound()
  }

  const [photos, uploaders, uploadableSites] = await Promise.all([
    getSitePhotos(siteId),
    getSiteGalleryUploaders(siteId),
    getUploadableSites(),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/sites"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">
            {site.name} <span className="text-muted-foreground">· Gallery</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {site.cityName} · {site.code}
            {!site.canUpload && ' · uploads disabled (closed site)'}
          </p>
        </div>
      </div>

      <GalleryView
        mode="site"
        siteId={siteId}
        isAdmin
        canUpload={site.canUpload}
        uploadableSites={uploadableSites}
        initialPhotos={photos}
        uploaders={uploaders}
      />
    </div>
  )
}
