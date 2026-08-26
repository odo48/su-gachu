import AppNav from '@/components/AppNav';
import AppTabBar from '@/components/AppTabBar';
import SiteFooter from '@/components/SiteFooter';
import StickyMobileCta from '@/components/StickyMobileCta';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-4xl px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
        {children}
        <SiteFooter />
      </div>
      <StickyMobileCta />
      <AppTabBar />
    </>
  );
}
