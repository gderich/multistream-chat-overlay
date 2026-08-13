# Como publicar uma nova versão (uso interno — não é pro usuário final ler isso)

## Ideia geral

Um repositório só, **público**: `multistream-chat-overlay`. Ele tem o
código-fonte e, na aba **Releases**, os arquivos prontos (`.exe`) pra baixar.

O usuário final nunca clona nada, nunca abre terminal: ele entra no
repositório, clica em **Releases** (ou usa os botões de download do
`README.md`) e baixa o instalador ou o portátil.

## Configuração (fazer uma vez só)

Não precisa criar token nem configurar Secret nenhum — o workflow usa o
token automático que o próprio GitHub Actions já gera (`GITHUB_TOKEN`), que
tem permissão de escrever Releases no mesmo repositório.

Só confira uma coisa:

1. **Confirmar o `owner`/`repo` no `package.json`.**
   Está apontando para `gderich/multistream-chat-overlay` em `build.publish`.
   Ajuste `owner` caso o nome de usuário do GitHub seja outro, e garanta que
   o repositório se chama exatamente `multistream-chat-overlay` e é público.

## Publicando uma versão nova (toda vez que quiser lançar)

1. Atualize a versão em `package.json` (campo `"version"`), ex: `2.0.0` → `2.1.0`.
2. Commit e push normal no repositório.
3. Crie e envie uma tag com o mesmo número, com o prefixo `v`:
   ```
   git tag v2.1.0
   git push origin v2.1.0
   ```
4. Isso dispara o workflow (`.github/workflows/release.yml`) automaticamente:
   ele builda no Windows, gera o instalador e o portátil, e publica os dois
   direto na aba **Releases** deste repositório — sem tocar em nada local.
5. Acompanhe em: aba **Actions**. Quando o job terminar (ícone verde), os
   arquivos já estão em **Releases**.
6. Como o nome dos arquivos é fixo (`MultistreamChat-Setup.exe` e
   `MultistreamChat-Portable.exe`, sem número de versão no nome), os dois
   botões de download do `README.md` **não precisam ser atualizados a cada
   versão** — eles sempre apontam para a versão mais recente automaticamente
   (link `/releases/latest/download/...`).

## Sobre o Windows SmartScreen

Sem um certificado de assinatura de código (code signing), o instalador vai
continuar disparando o aviso "Editor desconhecido" do Windows na primeira
execução — isso é sobre o `.exe` em si, não tem relação com o GitHub. Resolve
com um certificado de assinatura de código (ideal: EV, reduz o aviso quase de
imediato); sem isso, o aviso "Mais informações → Executar assim mesmo"
continua aparecendo. Vale explicar isso no README pra ninguém desconfiar
achando que é vírus.
