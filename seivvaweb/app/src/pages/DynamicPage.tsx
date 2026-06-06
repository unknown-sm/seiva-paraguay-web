import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/sections/Navbar";
import Footer from "@/sections/Footer";

export default function DynamicPage() {
  const { slug } = useParams();
  const [page, setPage] = useState<{titulo: string; slug: string; contenido: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    fetch(`/api/paginas/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setPage(data);
        document.title = data.titulo + " | Seiva Paraguay";
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)]">
        <Navbar />
        <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto text-center">
          <p className="text-[var(--theme-muted)]">Cargando...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)]">
        <Navbar />
        <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-serif text-[var(--theme-primary)] mb-4">P&aacute;gina no encontrada</h1>
          <p className="text-[var(--theme-muted)] mb-8">La p&aacute;gina que buscas no existe.</p>
          <Link to="/" className="text-[var(--theme-gold)] hover:underline">Volver al inicio</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--theme-bg)]">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <article className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-serif text-[var(--theme-primary)] mb-8">{page.titulo}</h1>
          <div className="prose prose-lg max-w-none text-[var(--theme-text)] leading-relaxed" style={{whiteSpace: "pre-wrap"}}>
            {page.contenido}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
