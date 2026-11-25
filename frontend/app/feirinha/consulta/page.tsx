"use client";

import { useEffect, useRef, useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { ListOrdered, ScanLine, Search, X } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { ExtratoAluno } from "@/components/ExtratoAluno";
import { ExtratoTurma } from "@/components/ExtratoTurma";
import { MoedaVeracom } from "@/components/MoedaVeracom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { AlunoBusca, CartaoFeirinha, PREFIXO_QR, mensagemCamera } from "@/lib/feirinha";

type Modo = "cartao" | "nome" | "turma";

const MODOS = [
  { valor: "cartao", rotulo: "Ler cartão", Icone: ScanLine },
  { valor: "nome", rotulo: "Buscar por nome", Icone: Search },
  { valor: "turma", rotulo: "Lista da turma", Icone: ListOrdered },
] as const;

function Consulta() {
  const [modo, setModo] = useState<Modo>("cartao");
  const [alunoId, setAlunoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [numero, setNumero] = useState("");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<AlunoBusca[]>([]);
  const ultimaLeituraRef = useRef<{ texto: string; em: number }>({ texto: "", em: 0 });

  // Busca por nome com pequeno atraso enquanto digita.
  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) return;
    const t = setTimeout(() => {
      api
        .get<AlunoBusca[]>(`/feirinha/alunos?busca=${encodeURIComponent(termo)}`)
        .then(setResultados)
        .catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  async function abrirPorCartao(codigo: string) {
    if (buscando) return;
    setBuscando(true);
    setErro(null);
    try {
      const c = await api.get<CartaoFeirinha>(`/feirinha/cartao/${encodeURIComponent(codigo)}`);
      setAlunoId(c.aluno_id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setErro("Cartão inválido ou desativado.");
      else if (e instanceof ApiError && e.status === 401) setErro("Sessão expirada. Entre novamente.");
      else setErro(e instanceof ApiError ? e.message : "Sem conexão com o servidor.");
    } finally {
      setBuscando(false);
    }
  }

  function onScan(codigos: IDetectedBarcode[]) {
    const texto = codigos[0]?.rawValue?.trim();
    if (!texto || alunoId !== null) return;
    const agora = Date.now();
    if (texto === ultimaLeituraRef.current.texto && agora - ultimaLeituraRef.current.em < 2500) return;
    ultimaLeituraRef.current = { texto, em: agora };
    if (!texto.toUpperCase().startsWith(PREFIXO_QR)) {
      setErro("Este QR code não é um cartão da feirinha.");
      return;
    }
    abrirPorCartao(texto);
  }

  function novaConsulta() {
    setAlunoId(null);
    setErro(null);
    setNumero("");
    setBusca("");
    setResultados([]);
  }

  return (
    <div className={`p-4 mx-auto space-y-4 ${modo === "turma" && alunoId === null ? "max-w-2xl" : "max-w-md"}`}>
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <MoedaVeracom size="md" /> Consulta de Saldo
      </h1>

      {erro && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm flex items-start justify-between gap-2">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} aria-label="Fechar aviso" className="p-1">
            <X className="size-4" />
          </button>
        </div>
      )}

      {alunoId !== null ? (
        <>
          <Card>
            <CardContent className="pt-4">
              <ExtratoAluno alunoId={alunoId} />
            </CardContent>
          </Card>
          <Button className="h-14 w-full text-base" onClick={novaConsulta}>
            Nova consulta
          </Button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {MODOS.map(({ valor, rotulo, Icone }) => (
              <Button
                key={valor}
                variant={modo === valor ? "default" : "outline"}
                className="h-14 flex-col gap-1 px-1 text-xs sm:text-sm"
                onClick={() => setModo(valor)}
              >
                <Icone className="size-4" /> {rotulo}
              </Button>
            ))}
          </div>

          {modo === "cartao" ? (
            <Card>
              <CardContent className="space-y-3 pt-4">
                <div className="overflow-hidden rounded-xl bg-black aspect-square">
                  {erroCamera ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-white/90 p-6 gap-3">
                      <ScanLine className="size-10" />
                      <p className="text-sm">{erroCamera}</p>
                    </div>
                  ) : (
                    <Scanner
                      onScan={onScan}
                      onError={(e) => setErroCamera(mensagemCamera(e.kind))}
                      formats={["qr_code"]}
                      paused={buscando}
                      constraints={{ facingMode: "environment" }}
                      components={{ finder: true, torch: true }}
                      sound={false}
                    />
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const codigo = numero.trim().replace(/^n[ºo°]?\s*/i, "");
                    if (codigo) abrirPorCartao(codigo);
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="Nº do cartão (ex: 12)"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                  <Button type="submit" className="h-12 px-5" disabled={buscando || !numero.trim()}>
                    Consultar
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : modo === "turma" ? (
            <ExtratoTurma />
          ) : (
            <Card>
              <CardContent className="space-y-3 pt-4">
                <Input
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    if (e.target.value.trim().length < 2) setResultados([]);
                  }}
                  placeholder="Digite o nome do aluno"
                  className="h-12 text-base"
                  autoFocus
                />
                {busca.trim().length >= 2 && resultados.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhum aluno encontrado.</p>
                )}
                <ul className="divide-y rounded-xl border bg-white empty:hidden">
                  {resultados.map((a) => (
                    <li key={a.aluno_id}>
                      <button
                        type="button"
                        onClick={() => setAlunoId(a.aluno_id)}
                        className="w-full text-left px-3 py-3 min-h-11 active:bg-slate-50"
                      >
                        <span className="font-medium text-slate-800">{a.nome}</span>
                        <span className="text-sm text-slate-500">{a.turma ? ` · Turma ${a.turma}` : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function ConsultaSaldoPage() {
  return (
    <RequireAuth>
      <Consulta />
    </RequireAuth>
  );
}
