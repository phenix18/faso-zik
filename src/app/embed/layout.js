/** Le lecteur integrable s'affiche seul, sans la coquille du site. */
export default function EmbedLayout({ children }) {
  return <div className="p-2">{children}</div>;
}
