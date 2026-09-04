export function formatRoomCode(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

export function clampCodeInput(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
  return clean.slice(0, 9);
}

export function connectionLabel(state: string): string {
  switch (state) {
    case "waiting":
      return "Aguardando participante";
    case "connecting":
      return "Conectando";
    case "connected":
      return "Conexão protegida";
    case "unstable":
      return "Conexão instável";
    case "disconnected":
      return "Usuário desconectado";
    case "ended":
      return "Compartilhamento encerrado";
    case "not-found":
      return "Sala inexistente";
    case "expired":
      return "Sala expirada";
    case "permission-denied":
      return "Permissão recusada";
    case "error":
      return "Erro de conexão";
    default:
      return "Pronto";
  }
}
