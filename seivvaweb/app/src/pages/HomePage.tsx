import { lazy, Suspense } from 'react'
import ProductSkeleton from '../components/ProductSkeleton'

const Hero = lazy(() => import('../sections/Hero'))
const StatsBar = lazy(() => import('../sections/StatsBar'))
const ProductFeatured = lazy(() => import('../sections/ProductFeatured'))
const FeaturedGrid = lazy(() => import('../sections/FeaturedGrid'))
const Categories = lazy(() => import('../sections/Categories'))
const LatestProducts = lazy(() => import('../sections/LatestProducts'))

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <Hero />
      </Suspense>
      <Suspense fallback={<div className="min-h-[20vh]" />}>
        <StatsBar />
      </Suspense>
      <Suspense fallback={<div className="min-h-[50vh]" />}>
        <ProductFeatured />
      </Suspense>
      <Suspense fallback={<ProductSkeleton count={4} className="lg:grid-cols-4 container-main px-4 py-12" />}>
        <FeaturedGrid />
      </Suspense>
      <Suspense fallback={<ProductSkeleton count={6} className="lg:grid-cols-3 container-main px-4 py-12" />}>
        <Categories />
      </Suspense>
      <Suspense fallback={<ProductSkeleton count={4} className="lg:grid-cols-4 container-main px-4 py-12" />}>
        <LatestProducts />
      </Suspense>
    </>
  )
}
