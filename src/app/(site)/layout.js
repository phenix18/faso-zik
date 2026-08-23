import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import GlobalPlayer from "@/components/player/GlobalPlayer";
import ServiceWorker from "@/components/ServiceWorker";
import PiedDePage from "@/components/PiedDePage";

/**
 * Coquille du site : navigation et lecteur global.
 *
 * Elle vit dans un groupe de routes plutot que dans la mise en page racine,
 * pour que le lecteur integrable (/embed) puisse s'afficher seul dans le cadre
 * d'un site exterieur.
 */
export default function SiteLayout({ children }) {
  return (
    <>
      <Sidebar />
      <div className="lg:pl-60">
        <Navbar />
        <main className="mx-auto max-w-[1600px] px-3 pt-4 sm:px-5">{children}</main>
        <div className="pb-40">
          <PiedDePage />
        </div>
      </div>
      <GlobalPlayer />
      <ServiceWorker />
    </>
  );
}
