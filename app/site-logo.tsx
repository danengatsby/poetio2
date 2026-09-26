/* eslint-disable @next/next/no-img-element -- Build-time WebP variants with native responsive selection. */
import { responsiveImage } from '@/lib/responsive-images';

export default function SiteLogo() {
  return <img className="homepage-logo" {...responsiveImage('/assets/poetio-balloons.png')} sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1050px) calc(100vw - 64px), (max-width: 1232px) calc(100vw - 112px), 1120px" alt="Poetio" width={2048} height={683} loading="eager" fetchPriority="high" decoding="async" />;
}
