# Nexus Share

Aplicação web de compartilhamento de tela em tempo real entre duas ou mais pessoas, mesmo em redes e cidades diferentes.

A transmissão de vídeo/áudio ocorre **diretamente entre os navegadores** via WebRTC. O servidor faz autenticação, salas, sinalização (SDP/ICE) e nunca grava o conteúdo da tela.

## Arquitetura

```text
Navegador A (anfitrião)          Navegador B (convidado)
  getDisplayMedia()
  RTCPeerConnection  <----media P2P---->  RTCPeerConnection
         |  SDP / ICE                            |
         +------------ Socket.IO ----------------+
                         |
                   Servidor Node
                   (Express + SQLite)
```

- **Cliente:** React + TypeScript + Vite + Tailwind CSS
- **Servidor:** Node.js + Express + Socket.IO
- **Mídia:** WebRTC (Offer/Answer + ICE)
- **NAT:** STUN público (Google) + TURN opcional (Coturn)
- **Auth:** JWT (cookie httpOnly + Bearer)
- **Dados:** SQLite (usuários, salas, logs de conexão — sem frames de tela)

O servidor **não** retransmite o vídeo quando a conexão P2P funciona. TURN só entra se NAT/firewall impedir o caminho direto.

## Estrutura

```text
/
  client/                 Front-end React
    src/components/
    src/pages/
    src/hooks/
    src/services/
    src/types/
    src/utils/
  server/                 Back-end Express
    src/config/
    src/controllers/
    src/services/
    src/socket/
    src/middleware/
    src/routes/
  .env.example
  README.md
```

## Eventos de sinalização

| Evento | Direção | Função |
| --- | --- | --- |
| `create-room` | client → server | Cria sala (alternativa à API REST) |
| `join-room` | client → server | Entra na sala pelo código |
| `joined-room` / `room-created` | server → client | Estado da sala + ICE servers |
| `user-joined` | server → room | Novo participante |
| `viewer-ready` | server → host | Pedido para enviar offer |
| `offer` / `answer` | peer ↔ peer via server | SDP |
| `ice-candidate` | peer ↔ peer via server | Candidatos ICE |
| `screen-started` / `screen-stopped` | host ↔ room | Estado do compartilhamento |
| `kick-user` | host → server | Remove participante |
| `end-session` / `leave-room` | client → server | Encerra ou sai |
| `user-disconnected` / `session-ended` | server → room | Desconexões |

Códigos de sala: 8 caracteres aleatórios no formato `A7FK-29QP`.

## Segurança e privacidade

- JWT + senhas com bcrypt (12 rounds)
- Rate limit em auth, API e tentativas de join
- Helmet, CORS, validação Zod em HTTP e Socket.IO
- Expiração automática de salas
- Confirmação na UI antes de `getDisplayMedia()`
- Botão **Parar compartilhamento** e **Encerrar sessão**
- Anfitrião pode remover participantes
- Logs apenas de conexão (quem entrou/saiu), nunca o conteúdo da tela
- Sem controle remoto de teclado/mouse
- Em produção use HTTPS (WebRTC/getDisplayMedia exigem contexto seguro)

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

```bash
PORT=3001
DATABASE_URL=./server/data/screenshare.db
JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
STUN_URL=stun:stun.l.google.com:19302
STUN_URL_SECONDARY=stun:stun1.l.google.com:19302
TURN_URL=
TURN_USERNAME=
TURN_PASSWORD=
CLIENT_URL=http://localhost:5173
```

Nunca coloque senhas no código. Para Coturn no futuro:

```bash
TURN_URL=turn:turn.seudominio.com:3478,turns:turn.seudominio.com:5349
TURN_USERNAME=usuario
TURN_PASSWORD=senha
```

## Rodar localmente

Requisitos: Node.js 20+

```bash
cp .env.example .env

npm install --prefix server
npm install --prefix client

# terminal 1 — API e sinalização
npm run dev --prefix server

# terminal 2 — interface
npm run dev --prefix client
```

Abra `http://localhost:5173`.

1. Crie uma conta e entre.
2. Clique em **Compartilhar minha tela**.
3. Confirme e autorize o seletor nativo do navegador.
4. Copie o link e abra em outro navegador/usuário.
5. A tela aparece em tempo real no convidado.

`getDisplayMedia` e WebRTC em dispositivos distintos exigem HTTPS (ou localhost).

## Publicar na internet

1. Defina `NODE_ENV=production` e um `JWT_SECRET` forte.
2. Configure `CLIENT_URL` com a origem pública (ex.: `https://share.seudominio.com`).
3. Faça o build do cliente: `npm run build --prefix client`.
4. O Express serve `client/dist` e a API na mesma origem (recomendado).
5. Coloque um proxy TLS (Caddy, Nginx ou Traefik) na frente, porta 443.
6. Exponha WebSocket (`/socket.io`) no mesmo host.
7. Opcional: Coturn com `TURN_URL` / usuário / senha.
8. Firewall: 443/tcp (app) e 3478/udp+tcp, 5349/tcp (TURN).

Exemplo Nginx:

```nginx
server {
  listen 443 ssl;
  server_name share.seudominio.com;
  ssl_certificate     /etc/letsencrypt/live/share.seudominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/share.seudominio.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

Depois: `npm run start --prefix server`.

## Evolução prevista

A sinalização já trata vários viewers por sala (`Map` de `RTCPeerConnection` no host). Próximos passos naturais:

- Chat em tempo real na mesma sala Socket.IO
- Áudio de voz (microfone) além do áudio da tela
- Mais de um transmissor (troca de apresentador)

Controle remoto de teclado/mouse **não** faz parte deste produto.
