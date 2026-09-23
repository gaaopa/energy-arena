import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface AlunoFotoProps {
  alunoId: string;
  nome: string;
  foto: string | null | undefined;
  className?: string;
  /** muda quando a foto é reenviada no mesmo formato (cache-bust) */
  versao?: string;
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

// A foto é servida por endpoint autenticado (JWT), então o <img> comum
// não funciona — baixamos como blob e criamos objectURL local.
export function AlunoFoto({ alunoId, nome, foto, className, versao }: AlunoFotoProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!foto) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let ativo = true;
    api
      .get<Blob>(`/alunos/${alunoId}/foto`, { responseType: 'blob' })
      .then((res) => {
        if (!ativo) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (ativo) setUrl(null);
      });
    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [alunoId, foto, versao]);

  if (url) {
    return (
      <img
        src={url}
        alt={nome}
        className={`rounded-full object-cover ${className ?? 'h-9 w-9'}`}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-full bg-orange-500/15 font-semibold text-orange-500 ${
        className ?? 'h-9 w-9 text-xs'
      }`}
    >
      {iniciais(nome)}
    </div>
  );
}
