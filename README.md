# Multistream Chat Overlay

Veja o chat da Twitch, Kick, YouTube e TikTok ao mesmo tempo, num único overlay transparente por cima do jogo — sem precisar alternar entre abas ou janelas enquanto você transmite.

**100% gratuito.** Este projeto não é comercial: não tem assinatura, não tem chave de ativação, não tem versão "paga" com mais recursos. É pra qualquer streamer usar à vontade.

<p>
  <a href="https://github.com/gderich/multistream-chat-overlay/releases/latest/download/MultistreamChat-Setup.exe">
    <img src="https://img.shields.io/badge/⬇️_Baixar_Instalador-MultistreamChat--Setup.exe-6441a5?style=for-the-badge" alt="Baixar instalador" />
  </a>
</p>

O botão sempre aponta para a versão mais recente. **O instalador é a única forma oficial de distribuição do aplicativo.**

## O que ele faz

- **4 plataformas em um só lugar**: Twitch, Kick, YouTube e TikTok, com cor própria pra cada uma.
- **Invisível pro OBS**: fica por cima da tela mas não aparece na captura (Display Capture), então nunca vaza pra sua live sem querer.
- **Click-through**: quando travado, o mouse passa direto por ele — não atrapalha o jogo.
- **Eventos especiais**: novo sub, resub, gift, doação, raid, follow e membro, destacados no meio das mensagens normais.
- **Personalização total**: 3 estilos visuais (compacto, cards, bubble), 4 temas (escuro, transparente, minimalista, gamer), tamanho, opacidade, fonte e espaçamento configuráveis.
- **Filtros ao vivo**: some/mostra mensagens de cada plataforma sem precisar desconectar.
- **Histórico opcional**: se quiser, grava tudo em `.txt` local — útil pra achar aquele comentário engraçado na hora de cortar o VOD.
- **Reconexão automática**: se uma plataforma cair (ou você não estiver ao vivo nela ainda), o app tenta de novo sozinho — as outras continuam funcionando normalmente.

## Requisitos

- Windows 10 ou superior (64 ou 32 bits).
- Conexão com a internet.
- Nada mais. Sem conta, sem cadastro, sem pagamento.

## Instalação (sem terminal, sem prompt)

1. Clique no botão **Baixar Instalador** acima.
2. Dê dois cliques no `MultistreamChat-Setup.exe` baixado.
3. Siga o assistente (Avançar → Avançar → Concluir).
4. O instalador cria os atalhos na área de trabalho e no menu iniciar.
5. Pronto. O app abre e já está pronto pra usar.

> Se o Windows SmartScreen exibir um aviso ("O Windows protegeu seu computador" / "Editor desconhecido"), isso pode acontecer porque o aplicativo ainda não possui um certificado de assinatura digital com reputação estabelecida. Isso **não significa, por si só, que o arquivo seja um vírus**. Não execute o arquivo se o alerta do seu antivírus indicar uma ameaça específica.

## Primeira configuração

Um assistente rápido pergunta como você quer começar (chat simples, overlay discreto, ver tudo com eventos/avatares, ou configurar na mão). Isso só define os valores iniciais — tudo pode ser mudado depois em **⚙ Configurações**.

Depois, informe o nome de canal/usuário de cada plataforma que você usa e pronto — o overlay já conecta sozinho.

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+L` | Trava/destrava o clique através da janela |
| `Ctrl+Alt+↑` | Aumenta o tamanho da janela |
| `Ctrl+Alt+↓` | Diminui o tamanho da janela |
| `Ctrl+Alt+R` | Reinicia todas as conexões |

Quando travado (click-through), a barra de título some — destrave com `Ctrl+Alt+L` pra mexer nas configurações.

## Apoie o projeto ❤️

O app é e sempre será gratuito. Mas se ele te ajuda no dia a dia da sua live e você quiser retribuir de alguma forma, há duas opções — sem nenhuma obrigação:

- **🍺 Pix**: clique no ícone **🍺** na barra do app pra abrir o painel de apoio, com QR Code e código "copia e cola" pra uma cervejinha.
- **📱 Me siga nas redes**: não pode (ou não quer) doar? Só me seguir já ajuda bastante a manter o projeto vivo → **[linktr.ee/FalaDerix](https://linktr.ee/FalaDerix)**

Nenhuma das duas opções desbloqueia nada — o app é o mesmo, completo, pra todo mundo.

## Atualizações automáticas

O app verifica sozinho se há uma versão nova e baixa em segundo plano; você só confirma o reinício quando ela avisar. Nada de mensagens de chat, credenciais ou dados pessoais são enviados nesse processo.

## Suporte

Encontrou um problema ou tem uma sugestão? Abra uma **Issue** aqui no repositório, ou me chame pelas redes: [linktr.ee/FalaDerix](https://linktr.ee/FalaDerix)

## Perguntas frequentes

**É realmente grátis, sem pegadinha?**
Sim. Sem assinatura, sem chave de ativação, sem versão paga. Doação é só um "obrigado" opcional, não é requisito pra usar.

**Posso usar isso comercialmente / revender / redistribuir como se fosse meu?**
Não. O app é gratuito pra uso pessoal de qualquer streamer, mas revenda, redistribuição não autorizada ou uso comercial do software em si não são permitidos — veja os detalhes em [TERMS.md](./TERMS.md).

**Preciso instalar algo além do app?**
Não. É só baixar o instalador e seguir o assistente — todas as dependências já vêm empacotadas.

**O app vê minhas mensagens privadas ou dados de login?**
Não. Ele só lê o chat público de cada plataforma, do mesmo jeito que qualquer espectador vê. Não pede login nem senha de nenhuma das quatro plataformas.

**Uma das plataformas parou de mostrar mensagens, e as outras continuam normais — é bug?**
Twitch, Kick, YouTube e TikTok não têm APIs de chat 100% estáveis pra esse tipo de uso, então cada uma é isolada das outras: se uma tiver instabilidade momentânea, ela reconecta sozinha sem travar as demais. Se persistir por muito tempo, abra uma Issue.

**Posso usar em mais de um computador?**
Sim, à vontade — não há limite de dispositivos nem verificação de licença.

---

© Multistream Chat Overlay — projeto gratuito e sem fins comerciais de **FalaDerix**. Uso sujeito aos [Termos de Uso e Política de Privacidade](./TERMS.md).
