# ============================================================
# Multistream Chat Overlay
# atualizar.ps1
#
# Publicador automatico de novas versoes
#
# USO:
#   .\atualizar.ps1
#
# Fluxo:
#   1. Detecta a nova versao no package.json
#   2. Verifica o Git/GitHub
#   3. Ignora node_modules e pastas de build
#   4. Verifica arquivos maiores que 100 MB
#   5. Verifica o release.yml
#   6. Compara com a ultima tag do GitHub
#   7. Mostra as alteracoes
#   8. Pede confirmacao
#   9. Faz commit
#  10. Faz push para main
#  11. Cria a tag vX.X.X
#  12. Envia a tag
#  13. GitHub Actions gera a Release
#
# ============================================================

$ErrorActionPreference = "Stop"

# ============================================================
# CONFIGURACAO
# ============================================================

$RepoOwner = "gderich"
$RepoName  = "multistream-chat-overlay"
$Branch    = "main"

$MaxFileSizeMB = 100

$ExcludedDirectories = @(
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    ".cache"
)

# ============================================================
# FUNCOES VISUAIS
# ============================================================

function Write-Step {
    param([string]$Message)

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGray
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkGray
}

function Write-OK {
    param([string]$Message)

    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-WarningMessage {
    param([string]$Message)

    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Write-ErrorMessage {
    param([string]$Message)

    Write-Host "[ERRO] $Message" -ForegroundColor Red
}

# ============================================================
# VERIFICAR COMANDO
# ============================================================

function Test-CommandExists {
    param([string]$Command)

    return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# ============================================================
# VERIFICAR REPOSITORIO
# ============================================================

function Test-GitRepository {

    if (-not (Test-Path ".git")) {
        throw "A pasta .git nao foi encontrada. Esta pasta nao parece ser um repositorio Git."
    }

    Write-OK "Repositorio Git valido."
}

# ============================================================
# VERIFICAR REMOTE
# ============================================================

function Test-RemoteRepository {

    $remote = git remote get-url origin 2>$null

    if ([string]::IsNullOrWhiteSpace($remote)) {
        throw "O remote 'origin' nao esta configurado."
    }

    if ($remote -notmatch "github\.com[:/]$RepoOwner/$RepoName(\.git)?$") {

        Write-WarningMessage "O remote atual nao corresponde ao repositorio esperado:"
        Write-Host ""
        Write-Host "Atual:"
        Write-Host "  $remote"
        Write-Host ""
        Write-Host "Esperado:"
        Write-Host "  https://github.com/$RepoOwner/$RepoName.git"
        Write-Host ""

        $answer = Read-Host "Deseja continuar mesmo assim? [S/N]"

        if ($answer -notmatch '^[Ss]$') {
            throw "Operacao cancelada."
        }
    }

    Write-OK "Remote GitHub encontrado."
}

# ============================================================
# VERIFICAR BRANCH
# ============================================================

function Test-Branch {

    $currentBranch = git branch --show-current

    if ($currentBranch -ne $Branch) {

        Write-WarningMessage "Voce esta na branch '$currentBranch'."

        $answer = Read-Host "Deseja mudar para '$Branch'? [S/N]"

        if ($answer -notmatch '^[Ss]$') {
            throw "Operacao cancelada."
        }

        git checkout $Branch

        if ($LASTEXITCODE -ne 0) {
            throw "Nao foi possivel mudar para a branch $Branch."
        }
    }

    Write-OK "Branch atual: $Branch"
}

# ============================================================
# LER VERSAO
# ============================================================

function Get-VersionFromPackageJson {

    if (-not (Test-Path "package.json")) {
        throw "package.json nao encontrado."
    }

    try {
        $package = Get-Content "package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "Nao foi possivel ler o package.json."
    }

    if ([string]::IsNullOrWhiteSpace($package.version)) {
        throw "A propriedade 'version' nao existe no package.json."
    }

    if ($package.version -notmatch '^\d+\.\d+\.\d+$') {
        throw "A versao '$($package.version)' nao esta no formato X.Y.Z."
    }

    return $package.version
}

# ============================================================
# VERIFICAR VERSAO
# ============================================================

function Test-VersionGreater {
    param(
        [string]$NewVersion,
        [string]$OldVersion
    )

    $new = [version]$NewVersion
    $old = [version]$OldVersion

    return $new -gt $old
}

# ============================================================
# BUSCAR TAGS DO GITHUB
# ============================================================

function Get-LatestVersion {

    Write-Host "Buscando tags existentes no GitHub..."

    git fetch origin --tags --force

    if ($LASTEXITCODE -ne 0) {
        throw "Nao foi possivel buscar as tags do GitHub."
    }

    $tags = git tag --list "v*.*.*"

    if (-not $tags) {
        return $null
    }

    $versions = @()

    foreach ($tag in $tags) {

        $versionText = $tag -replace '^v', ''

        if ($versionText -match '^\d+\.\d+\.\d+$') {

            try {
                $versions += [version]$versionText
            }
            catch {
                # Ignora tags invalidas
            }
        }
    }

    if ($versions.Count -eq 0) {
        return $null
    }

    return ($versions | Sort-Object -Descending | Select-Object -First 1).ToString()
}

# ============================================================
# VERIFICAR TAG
# ============================================================

function Test-VersionNotAlreadyPublished {
    param([string]$Version)

    $tag = "v$Version"

    $exists = git ls-remote --tags origin "refs/tags/$tag" 2>$null

    if (-not [string]::IsNullOrWhiteSpace($exists)) {
        throw "A tag $tag ja existe no GitHub."
    }

    Write-OK "A tag v$Version ainda nao existe."
}

# ============================================================
# VERIFICAR ARQUIVOS GRANDES
# ============================================================

function Test-LargeFiles {

    Write-Step "Verificando arquivos maiores que $MaxFileSizeMB MB"

    $maxBytes = $MaxFileSizeMB * 1MB

    $largeFiles = @(
        Get-ChildItem `
            -Path "." `
            -File `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue |
        Where-Object {

            $path = $_.FullName

            $isExcluded = $false

            foreach ($excluded in $ExcludedDirectories) {

                $pattern = [regex]::Escape("\$excluded\")

                if ($path -match $pattern) {
                    $isExcluded = $true
                    break
                }

                if ($path -match "\\$([regex]::Escape($excluded))$") {
                    $isExcluded = $true
                    break
                }
            }

            (-not $isExcluded) -and ($_.Length -gt $maxBytes)
        }
    )

    if ($largeFiles.Count -gt 0) {

        Write-ErrorMessage "Foram encontrados arquivos maiores que 100 MB:"

        foreach ($file in $largeFiles) {

            $sizeMB = [math]::Round($file.Length / 1MB, 2)

            Write-Host ""
            Write-Host "  $($file.FullName)" -ForegroundColor Red
            Write-Host "  Tamanho: $sizeMB MB" -ForegroundColor Red
        }

        throw "Publicacao cancelada por causa de arquivo maior que 100 MB."
    }

    Write-OK "Nenhum arquivo maior que 100 MB encontrado."
}

# ============================================================
# VERIFICAR NODE_MODULES
# ============================================================

function Test-NodeModules {

    Write-Step "Verificando node_modules"

    $nodeModules = Get-ChildItem `
        -Path "." `
        -Directory `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq "node_modules"
        }

    if ($nodeModules.Count -gt 0) {

        Write-WarningMessage "node_modules foi encontrado no projeto."

        foreach ($folder in $nodeModules) {
            Write-Host "  $($folder.FullName)"
        }

        Write-Host ""
        Write-Host "Isso e normal." -ForegroundColor Cyan
        Write-Host "node_modules sera ignorado pelo Git."
    }
    else {
        Write-OK "node_modules nao encontrado."
    }
}

# ============================================================
# GARANTIR GITIGNORE
# ============================================================

function Ensure-GitIgnore {

    Write-Step "Verificando .gitignore"

    $requiredEntries = @(
        "node_modules/",
        "dist/",
        "build/",
        "out/",
        "*.log",
        "*.tmp",
        "*.temp",
        ".DS_Store",
        "Thumbs.db"
    )

    if (-not (Test-Path ".gitignore")) {

        @"
node_modules/
dist/
build/
out/
*.log
*.tmp
*.temp
.DS_Store
Thumbs.db
"@ | Set-Content ".gitignore" -Encoding UTF8

        Write-OK ".gitignore criado."

        return
    }

    $content = Get-Content ".gitignore" -Raw

    foreach ($entry in $requiredEntries) {

        if ($content -notmatch [regex]::Escape($entry)) {

            Add-Content ".gitignore" $entry

            Write-OK "Adicionado ao .gitignore: $entry"
        }
    }

    Write-OK ".gitignore verificado."
}

# ============================================================
# VERIFICAR SE NODE_MODULES JA ESTA NO GIT
# ============================================================

function Test-NodeModulesTracked {

    $tracked = git ls-files "node_modules/*"

    if (-not [string]::IsNullOrWhiteSpace($tracked)) {

        Write-ErrorMessage "node_modules ja esta sendo rastreado pelo Git."

        Write-Host ""
        Write-Host "Isso precisa ser corrigido manualmente antes de continuar."
        Write-Host ""

        throw "node_modules esta no historico/rastreamento do Git."
    }

    Write-OK "node_modules nao esta sendo rastreado."
}

# ============================================================
# VERIFICAR RELEASE.YML
# ============================================================

function Test-ReleaseWorkflow {

    Write-Step "Verificando GitHub Actions"

    $workflow = ".github\workflows\release.yml"

    if (-not (Test-Path $workflow)) {
        throw "O arquivo .github/workflows/release.yml nao foi encontrado."
    }

    $content = Get-Content $workflow -Raw

    if ($content -notmatch "tags:") {
        throw "O release.yml nao possui configuracao de tags."
    }

    if ($content -notmatch "v\*\.\*\.\*") {
        Write-WarningMessage "Nao encontrei o padrao v*.*.* no release.yml."
    }

    if ($content -notmatch "contents:\s*write") {
        Write-WarningMessage "Nao encontrei 'contents: write' no release.yml."
    }

    Write-OK "release.yml encontrado."
}

# ============================================================
# MOSTRAR ALTERACOES
# ============================================================

function Show-Changes {

    Write-Step "Alteracoes encontradas"

    git status --short

    Write-Host ""

    $stat = git diff --stat

    if (-not [string]::IsNullOrWhiteSpace($stat)) {
        Write-Host $stat
    }

    Write-Host ""
}

# ============================================================
# VERIFICAR O QUE SERA ENVIADO
# ============================================================

function Test-StagedFiles {

    Write-Step "Verificando arquivos que serao enviados"

    git add .

    if ($LASTEXITCODE -ne 0) {
        throw "git add falhou."
    }

    $staged = git diff --cached --name-only

    if ([string]::IsNullOrWhiteSpace($staged)) {
        throw "Nenhum arquivo foi colocado no staging."
    }

    foreach ($file in $staged) {

        if ($file -match '^node_modules/') {
            throw "node_modules entrou no staging. Publicacao cancelada."
        }

        if ($file -match '^\.git/') {
            throw ".git entrou no staging. Publicacao cancelada."
        }
    }

    Write-OK "Arquivos verificados."
}

# ============================================================
# CONFIRMACAO
# ============================================================

function Confirm-Publication {
    param([string]$Version)

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host "           PUBLICAR MULTISTREAM CHAT v$Version" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host ""

    Write-Host "O script vai:"
    Write-Host ""
    Write-Host "  [1] Criar commit"
    Write-Host "  [2] Enviar para main"
    Write-Host "  [3] Criar tag v$Version"
    Write-Host "  [4] Enviar tag para o GitHub"
    Write-Host "  [5] Disparar o GitHub Actions"
    Write-Host "  [6] Gerar o instalador automaticamente"
    Write-Host ""

    Write-Host "O instalador sera:"
    Write-Host "  MultistreamChat-Setup.exe" -ForegroundColor Green
    Write-Host ""

    $answer = Read-Host "Deseja publicar v$Version? [S/N]"

    if ($answer -notmatch '^[Ss]$') {
        throw "Publicacao cancelada pelo usuario."
    }
}

# ============================================================
# PUBLICAR
# ============================================================

function Publish-Version {
    param([string]$Version)

    Write-Step "Criando commit"

    git commit -m "release: v$Version"

    if ($LASTEXITCODE -ne 0) {
        throw "git commit falhou."
    }

    Write-OK "Commit criado."

    Write-Step "Enviando codigo para o GitHub"

    git push origin $Branch

    if ($LASTEXITCODE -ne 0) {
        throw "git push origin $Branch falhou."
    }

    Write-OK "Codigo enviado para $Branch."

    Write-Step "Criando tag v$Version"

    git tag "v$Version"

    if ($LASTEXITCODE -ne 0) {
        throw "Nao foi possivel criar a tag v$Version."
    }

    Write-OK "Tag v$Version criada."

    Write-Step "Enviando tag para o GitHub"

    git push origin "v$Version"

    if ($LASTEXITCODE -ne 0) {
        throw "Nao foi possivel enviar a tag v$Version."
    }

    Write-OK "Tag v$Version enviada."
}

# ============================================================
# FINAL
# ============================================================

function Show-FinalResult {
    param([string]$Version)

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "             PUBLICACAO CONCLUIDA" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""

    Write-Host "Versao publicada: " -NoNewline
    Write-Host "v$Version" -ForegroundColor Green

    Write-Host ""
    Write-Host "GitHub Actions:"
    Write-Host "https://github.com/$RepoOwner/$RepoName/actions" -ForegroundColor Cyan

    Write-Host ""
    Write-Host "Release:"
    Write-Host "https://github.com/$RepoOwner/$RepoName/releases/tag/v$Version" -ForegroundColor Cyan

    Write-Host ""
    Write-Host "O GitHub Actions deve gerar:" -ForegroundColor Cyan
    Write-Host "  MultistreamChat-Setup.exe" -ForegroundColor Green

    Write-Host ""
    Write-Host "Acompanhe o Actions para confirmar o build."
}

# ============================================================
# INICIO
# ============================================================

Clear-Host

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       MULTISTREAM CHAT OVERLAY - ATUALIZADOR" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

try {

    # --------------------------------------------------------
    # 1. Git
    # --------------------------------------------------------

    Write-Step "Verificando ferramentas"

    if (-not (Test-CommandExists "git")) {
        throw "Git nao esta instalado ou nao esta no PATH."
    }

    Write-OK "Git encontrado."

    # --------------------------------------------------------
    # 2. Projeto
    # --------------------------------------------------------

    Write-Step "Verificando projeto"

    Test-GitRepository
    Test-RemoteRepository
    Test-Branch

    # --------------------------------------------------------
    # 3. IMPORTANTE:
    # NAO fazemos git pull aqui.
    #
    # O usuario acabou de copiar a nova versao para a pasta.
    # Essas alteracoes locais sao justamente o que queremos
    # publicar.
    # --------------------------------------------------------

    Write-Step "Verificando alteracoes locais"

    $localStatus = git status --porcelain

    if ([string]::IsNullOrWhiteSpace($localStatus)) {
        throw "Nenhuma alteracao local encontrada. Copie a nova versao para esta pasta primeiro."
    }

    Write-OK "Alteracoes locais encontradas."

    # --------------------------------------------------------
    # 4. Arquivos
    # --------------------------------------------------------

    Test-NodeModules
    Ensure-GitIgnore
    Test-NodeModulesTracked
    Test-LargeFiles

    # --------------------------------------------------------
    # 5. Workflow
    # --------------------------------------------------------

    Test-ReleaseWorkflow

    # --------------------------------------------------------
    # 6. Versao
    # --------------------------------------------------------

    Write-Step "Identificando nova versao"

    $newVersion = Get-VersionFromPackageJson

    Write-Host "Versao encontrada: " -NoNewline
    Write-Host "$newVersion" -ForegroundColor Green

    # --------------------------------------------------------
    # 7. Ultima versao
    # --------------------------------------------------------

    Write-Step "Comparando versoes"

    $latestVersion = Get-LatestVersion

    if ($null -eq $latestVersion) {

        Write-WarningMessage "Nenhuma tag anterior encontrada."

    }
    else {

        Write-Host "Ultima versao publicada: " -NoNewline
        Write-Host "$latestVersion" -ForegroundColor Yellow

        if (-not (Test-VersionGreater $newVersion $latestVersion)) {

            throw "A versao $newVersion nao e maior que a ultima versao $latestVersion."
        }

        Write-OK "A nova versao e maior que a anterior."
    }

    # --------------------------------------------------------
    # 8. Tag
    # --------------------------------------------------------

    Test-VersionNotAlreadyPublished $newVersion

    # --------------------------------------------------------
    # 9. Mostrar alteracoes
    # --------------------------------------------------------

    Show-Changes

    # --------------------------------------------------------
    # 10. Confirmar
    # --------------------------------------------------------

    Confirm-Publication $newVersion

    # --------------------------------------------------------
    # 11. Staging
    # --------------------------------------------------------

    Test-StagedFiles

    # --------------------------------------------------------
    # 12. Mostrar arquivos finais
    # --------------------------------------------------------

    Write-Step "Arquivos preparados para o commit"

    git diff --cached --stat

    Write-Host ""

    # --------------------------------------------------------
    # 13. Publicar
    # --------------------------------------------------------

    Publish-Version $newVersion

    # --------------------------------------------------------
    # 14. Resultado
    # --------------------------------------------------------

    Show-FinalResult $newVersion

}
catch {

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "              PUBLICACAO CANCELADA" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""

    Write-ErrorMessage $_.Exception.Message

    Write-Host ""
    Write-Host "Nenhuma nova tag sera criada se o erro ocorreu antes da etapa de publicacao." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Suas alteracoes locais nao foram apagadas." -ForegroundColor Cyan
    Write-Host ""

    exit 1
}

Write-Host ""
Read-Host "Pressione ENTER para sair"