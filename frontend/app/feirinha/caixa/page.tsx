"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { CheckCircle2, Delete, Keyboard, ListChecks, ReceiptText, ScanLine, Undo2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import RequireAuth from "@/components/RequireAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExtratoAluno } from "@/components/ExtratoAluno";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoedaVeracom } from "@/components/MoedaVeracom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  CartaoFeirinha,
  PREFIXO_QR,
  TransacaoResultado,
  VendaRecente,
  formatarNumeroCartao,
  iniciais,
  mensagemCamera,
  novaChaveIdempotencia,
} from "@/lib/feirinha";

type Etapa = "lendo" | "aluno" | "sucesso";

function assinarConexao(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

const SEGUNDOS_VOLTA_AUTOMATICA = 3;

function mensagemDeErro(e: unknown, contexto: "cartao" | "venda"): { texto: string; sessaoExpirada?: boolean } {
  if (e instanceof ApiError) {
    if (e.status === 401) return { texto: "Sessão expirada. Entre novamente para continuar.", sessaoExpirada: true };
    if (e.status === 404 && contexto === "cartao") return { texto: "Cartão inválido ou desativado." };
    return { texto: e.message };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { texto: "Sem internet. Verifique a conexão e tente de novo." };
  }
  return { texto: "Não foi possível falar com o servidor. Verifique a internet e tente de novo." };
}

function formatarHora(iso: string): string {
  // Backend grava em UTC sem fuso.
  return new Date(iso + "Z").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function TecladoNumerico({ onDigito, onApagar, onLimpar }: { onDigito: (d: string) => void; onApagar: () => void; onLimpar: () => void }) {
  const tecla = "h-14 text-2xl font-semibold rounded-xl border bg-white active:bg-slate-100 shadow-sm";
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={tecla} onClick={() => onDigito(d)}>
          {d}
        </button>
      ))}
      <button type="button" className={`${tecla} text-base text-slate-500`} onClick={onLimpar}>
        Limpar
      </button>
      <button type="button" className={tecla} onClick={() => onDigito("0")}>
        0
      </button>
      <button type="button" className={`${tecla} flex items-center justify-center`} onClick={onApagar} aria-label="Apagar">
        <Delete className="size-6" />
      </button>
    </div>
  );
}

function CaixaFeirinha() {
  const { logout } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>("lendo");
  const [aluno, setAluno] = useState<CartaoFeirinha | null>(null);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [codigoManual, setCodigoManual] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [resultado, setResultado] = useState<TransacaoResultado | null>(null);
  const [contagem, setContagem] = useState(SEGUNDOS_VOLTA_AUTOMATICA);
  const [vendas, setVendas] = useState<VendaRecente[]>([]);
  const [extratoAberto, setExtratoAberto] = useState(false);
  const online = useSyncExternalStore(assinarConexao, () => navigator.onLine, () => true);
  // Uma chave por tentativa de compra: reenviar após falha de rede reaproveita a
  // mesma chave, e o servidor não debita duas vezes.
  const chaveRef = useRef<string>("");
  const ultimaLeituraRef = useRef<{ texto: string; em: number }>({ texto: "", em: 0 });

  const tratarErro = useCallback((e: unknown, contexto: "cartao" | "venda") => {
    const { texto, sessaoExpirada: expirou } = mensagemDeErro(e, contexto);
    setErro(texto);
    if (expirou) setSessaoExpirada(true);
  }, []);

  const carregarVendas = useCallback(async () => {
    try {
      setVendas(await api.get<VendaRecente[]>("/feirinha/vendas-recentes?limite=5"));
    } catch {
      // lista é auxiliar; erro aparece nas ações principais
    }
  }, []);

  useEffect(() => {
    api
      .get<VendaRecente[]>("/feirinha/vendas-recentes?limite=5")
      .then(setVendas)
      .catch(() => undefined);
  }, []);

  const voltarAoLeitor = useCallback(() => {
    setEtapa("lendo");
    setAluno(null);
    setValor("");
    setDescricao("");
    setResultado(null);
    setErro(null);
    setCodigoManual("");
    chaveRef.current = "";
  }, []);

  // Volta sozinho ao leitor depois do sucesso.
  useEffect(() => {
    if (etapa !== "sucesso") return;
    const intervalo = setInterval(() => setContagem((c) => c - 1), 1000);
    const timeout = setTimeout(voltarAoLeitor, SEGUNDOS_VOLTA_AUTOMATICA * 1000);
    return () => {
      clearInterval(intervalo);
      clearTimeout(timeout);
    };
  }, [etapa, voltarAoLeitor]);

  async function buscarCartao(codigo: string) {
    if (buscando) return;
    setBuscando(true);
    setErro(null);
    try {
      const dados = await api.get<CartaoFeirinha>(`/feirinha/cartao/${encodeURIComponent(codigo)}`);
      setAluno(dados);
      setValor("");
      setDescricao("");
      chaveRef.current = novaChaveIdempotencia();
      setEtapa("aluno");
    } catch (e) {
      tratarErro(e, "cartao");
    } finally {
      setBuscando(false);
    }
  }

  function onScan(codigos: IDetectedBarcode[]) {
    const texto = codigos[0]?.rawValue?.trim();
    if (!texto || etapa !== "lendo") return;
    // Evita tratar o mesmo QR várias vezes seguidas enquanto ainda está na frente da câmera.
    const agora = Date.now();
    if (texto === ultimaLeituraRef.current.texto && agora - ultimaLeituraRef.current.em < 2500) return;
    ultimaLeituraRef.current = { texto, em: agora };

    if (!texto.toUpperCase().startsWith(PREFIXO_QR)) {
      setErro("Este QR code não é um cartão da feirinha.");
      return;
    }
    buscarCartao(texto);
  }

  function buscarManual(e: React.FormEvent) {
    e.preventDefault();
    const codigo = codigoManual.trim().replace(/^n[ºo°]?\s*/i, "");
    if (!codigo) return;
    buscarCartao(codigo);
  }

  const valorNumero = Number(valor || "0");
  const saldoInsuficiente = aluno !== null && valorNumero > aluno.saldo;
  const podeConfirmar = aluno !== null && valorNumero > 0 && !saldoInsuficiente && !enviando;

  async function confirmarDebito() {
    if (!aluno || !podeConfirmar) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await api.post<TransacaoResultado>("/feirinha/debito", {
        token: aluno.token,
        valor: valorNumero,
        descricao: descricao.trim() || null,
        chave_idempotencia: chaveRef.current,
      });
      setResultado(r);
      setContagem(SEGUNDOS_VOLTA_AUTOMATICA);
      setEtapa("sucesso");
      carregarVendas();
    } catch (e) {
      tratarErro(e, "venda");
      // Saldo mudou em outro caixa: atualiza o cartão na tela e libera nova tentativa.
      if (e instanceof ApiError && e.status === 409) {
        try {
          setAluno(await api.get<CartaoFeirinha>(`/feirinha/cartao/${encodeURIComponent(aluno.token)}`));
        } catch {
          // mantém o erro já exibido
        }
        chaveRef.current = novaChaveIdempotencia();
      }
    } finally {
      setEnviando(false);
    }
  }

  async function desfazer(venda: VendaRecente) {
    try {
      const r = await api.post<TransacaoResultado>(`/feirinha/estorno/${venda.transacao_id}`);
      toast.success(`Venda desfeita. Saldo de ${r.aluno_nome}: ${r.saldo}`);
      carregarVendas();
    } catch (e) {
      const { texto, sessaoExpirada: expirou } = mensagemDeErro(e, "venda");
      toast.error(texto);
      if (expirou) setSessaoExpirada(true);
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <MoedaVeracom size="md" /> Caixa da Feirinha
        </h1>
        <Link href="/feirinha/resumo" className="text-sm text-blue-700 underline underline-offset-2 flex items-center gap-1">
          <ListChecks className="size-4" /> Resumo
        </Link>
      </div>

      {!online && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-100 text-amber-900 px-3 py-2 text-sm">
          <WifiOff className="size-4 shrink-0" /> Sem internet. As vendas só podem ser feitas com conexão.
        </div>
      )}

      {erro && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm flex items-start justify-between gap-2">
          <span>{erro}</span>
          {sessaoExpirada ? (
            <Button size="sm" variant="outline" onClick={logout}>
              Entrar
            </Button>
          ) : (
            <button onClick={() => setErro(null)} aria-label="Fechar aviso" className="p-1">
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {etapa === "lendo" && (
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
            <p className="text-center text-sm text-slate-500">
              {buscando ? "Buscando cartão..." : "Aponte a câmera para o QR code do cartão."}
            </p>
            <form onSubmit={buscarManual} className="flex gap-2">
              <div className="relative flex-1">
                <Keyboard className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(e.target.value)}
                  placeholder="Nº do cartão (ex: 12) ou código"
                  className="h-12 pl-9 text-base"
                  inputMode="text"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" className="h-12 px-5" disabled={buscando || !codigoManual.trim()}>
                Buscar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {etapa === "aluno" && aluno && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 text-white shadow-md" style={{ background: "#13294B" }}>
            <div className="flex items-center gap-3">
              <div className="size-14 shrink-0 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: "#E8C766", color: "#13294B" }}>
                {iniciais(aluno.nome)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-lg leading-tight truncate">{aluno.nome}</p>
                <p className="text-sm" style={{ color: "#C0C6CE" }}>
                  {aluno.turma ? `Turma ${aluno.turma} · ` : ""}Nº {formatarNumeroCartao(aluno.numero)}
                </p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-xs uppercase tracking-widest" style={{ color: "#C0C6CE" }}>Saldo disponível</p>
              <p className="text-5xl font-extrabold" style={{ color: "#E8C766" }}>{aluno.saldo}</p>
            </div>
            <button
              type="button"
              onClick={() => setExtratoAberto(true)}
              className="mt-3 w-full h-11 rounded-lg border border-white/30 text-sm font-medium flex items-center justify-center gap-2 active:bg-white/10"
            >
              <ReceiptText className="size-4" /> Ver extrato
            </button>
          </div>

          <Dialog open={extratoAberto} onOpenChange={setExtratoAberto}>
            <DialogContent className="max-h-[85svh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Extrato</DialogTitle>
              </DialogHeader>
              <ExtratoAluno alunoId={aluno.aluno_id} />
            </DialogContent>
          </Dialog>

          <div className="rounded-xl border bg-white px-4 py-3 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Valor da compra</p>
            <p className={`text-4xl font-bold ${saldoInsuficiente ? "text-red-600" : "text-slate-800"}`}>{valorNumero}</p>
            {saldoInsuficiente && <p className="text-sm font-medium text-red-600">Saldo insuficiente</p>}
          </div>

          <TecladoNumerico
            onDigito={(d) => setValor((v) => (v.length >= 5 ? v : (v === "0" ? "" : v) + d))}
            onApagar={() => setValor((v) => v.slice(0, -1))}
            onLimpar={() => setValor("")}
          />

          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional), ex: pipoca e suco"
            maxLength={120}
            className="h-12 text-base"
          />

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-14 text-base" onClick={voltarAoLeitor} disabled={enviando}>
              Cancelar
            </Button>
            <Button className="h-14 text-base col-span-2" onClick={confirmarDebito} disabled={!podeConfirmar}>
              {enviando ? "Enviando..." : "Confirmar débito"}
            </Button>
          </div>
        </div>
      )}

      {etapa === "sucesso" && resultado && (
        <Card>
          <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="size-16 text-green-600" />
            <p className="text-lg font-semibold text-slate-800">Débito de {resultado.valor} confirmado</p>
            <p className="text-slate-600">{resultado.aluno_nome}</p>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Novo saldo</p>
              <p className="text-5xl font-extrabold text-slate-800">{resultado.saldo}</p>
            </div>
            <Button className="h-14 w-full text-base" onClick={voltarAoLeitor}>
              Próximo aluno ({Math.max(contagem, 0)})
            </Button>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Últimas vendas deste caixa</h2>
        {vendas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma venda ainda.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-white">
            {vendas.map((v) => (
              <li key={v.transacao_id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${v.estornado ? "line-through text-slate-400" : "text-slate-800"}`}>
                    {v.aluno_nome} · {v.valor}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {formatarHora(v.criado_em)}
                    {v.descricao ? ` · ${v.descricao}` : ""}
                    {v.estornado ? " · desfeita" : ""}
                  </p>
                </div>
                {v.pode_desfazer && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm" className="h-11 shrink-0">
                        <Undo2 className="size-4 mr-1" /> Desfazer
                      </Button>
                    }
                    title="Desfazer esta venda?"
                    description={`${v.valor} voltam para o saldo de ${v.aluno_nome}.`}
                    confirmLabel="Desfazer venda"
                    onConfirm={() => desfazer(v)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CaixaFeirinhaPage() {
  return (
    <RequireAuth>
      <CaixaFeirinha />
    </RequireAuth>
  );
}
