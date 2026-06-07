import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-20 pb-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-sans font-bold text-gray-900 tracking-tight mb-6">
            Demonstração do Produto
          </h1>
          <p className="text-lg text-gray-500">
            Vídeo e demo funcional. Em construção... Fase F6/F7.
          </p>
        </div>
      </main>
    </div>
  );
}
