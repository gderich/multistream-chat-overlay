# Multistream Chat Overlay

Veja o chat da Twitch, Kick, YouTube e TikTok ao mesmo tempo, num único overlay transparente por cima do jogo — sem precisar alternar entre abas ou janelas enquanto você transmite.

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
- Uma assinatura ativa do Multistream Chat Overlay.

## Instalação

1. Baixe o instalador (`MultistreamChat-Setup-X.X.X.exe`) ou a versão portátil (`MultistreamChat-Portable.exe`) — ambos disponíveis após a assinatura.
2. Rode o instalador (ou simplesmente abra o portátil, sem instalar nada).
3. Na primeira execução, o app pede sua chave de ativação — ela é enviada por e-mail assim que a assinatura é confirmada.

> Se o Windows SmartScreen exibir um aviso na primeira execução, isso é normal para apps novos e assinados recentemente — clique em "Mais informações" → "Executar assim mesmo".

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

## Assinatura

- **Plano mensal ou anual** — escolha na hora da compra.
- Renovação automática até o cancelamento; cancele quando quiser e o acesso continua até o fim do ciclo já pago.
- Dúvidas sobre cobrança, cancelamento ou reembolso: veja o [TERMS.md](./TERMS.md) ou fale com o suporte (abaixo).
- As atualizações do app são automáticas — você é avisado quando uma nova versão é baixada e só precisa confirmar o reinício.

## Suporte

Encontrou um problema ou tem uma sugestão? [PREENCHER: canal de suporte — e-mail, Discord, formulário, etc.]

## Perguntas frequentes

**Preciso instalar algo além do app?**
Não. É só baixar e abrir — todas as dependências já vêm empacotadas.

**O app vê minhas mensagens privadas ou dados de login?**
Não. Ele só lê o chat público de cada plataforma, do mesmo jeito que qualquer espectador vê. Não pede login nem senha de nenhuma das quatro plataformas.

**Uma das plataformas parou de mostrar mensagens, e as outras continuam normais — é bug?**
Twitch, Kick, YouTube e TikTok não têm APIs de chat 100% estáveis pra esse tipo de uso, então cada uma é isolada das outras: se uma tiver instabilidade momentânea, ela reconecta sozinha sem travar as demais. Se persistir por muito tempo, chame o suporte.

**Posso usar em mais de um computador?**
[PREENCHER: política de ativação — 1 dispositivo por assinatura, N dispositivos, etc.]

---

© Multistream Chat Overlay. Uso sujeito aos [Termos de Uso e Política de Privacidade](./TERMS.md).
