<#
.SYNOPSIS
  Publish the project from Windows CMD using Git and GitHub CLI.
.EXAMPLE
  .\publish.cmd
  .\publish.cmd target-tab-auto-clicker
  .\publish.cmd owner/my-repository private

The script never force-pushes or overwrites an unrelated origin. You must
approve a public/private push; login uses GitHub CLI's browser flow.
#>
[CmdletBinding()]
param(
    [Parameter(Position=0)] [string] $Repository = 'target-tab-auto-clicker',
    [Parameter(Position=1)] [ValidateSet('public','private')] [string] $Visibility = 'public'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step([string]$message) {
    Write-Host "`n>> $message" -ForegroundColor Cyan
}
function CheckTool([string]$name, [string]$installationUrl) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "'$name' not found. Install it: $installationUrl (then reopen CMD)."
    }
}
function Run([string]$command, [string[]]$arguments) {
    & $command @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$command failed (exit code $LASTEXITCODE): $($arguments -join ' ')"
    }
}
function Probe([string]$command, [string[]]$arguments) {
    # Do not confuse a non-zero exit status with a PowerShell exception.
    $prior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $result = & $command @arguments 2>$null
        return @{ Ok = ($LASTEXITCODE -eq 0); Text = (($result | Out-String).Trim()) }
    } finally {
        $ErrorActionPreference = $prior
    }
}
function Confirm([string]$message) {
    $choice = Read-Host "$message [y/N]"
    return $choice -ceq 'y' -or $choice -ceq 'Y'
}

try {
    Step 'Checking requirements'
    CheckTool 'git' 'https://git-scm.com/downloads/win'
    CheckTool 'gh' 'https://cli.github.com/'
    if (-not (Test-Path (Join-Path $root 'manifest.json'))) {
        throw 'manifest.json not found. Run publish.cmd from the project root.'
    }
    if (-not (Test-Path (Join-Path $root '.github/workflows/pages.yml'))) {
        throw '.github/workflows/pages.yml not found. Check that you extracted all files.'
    }
    $about = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'repository-about.json') -Raw -Encoding UTF8 | ConvertFrom-Json

    $Repository = $Repository.Trim()
    if ($Repository -notmatch '^(?:[a-zA-Z0-9][a-zA-Z0-9_.-]*/)?[a-zA-Z0-9][a-zA-Z0-9_.-]*$') {
        throw 'Repository name must be NAME or OWNER/NAME (letters, numbers, dots, dashes, underscores).'
    }
    $auth = Probe 'gh' @('auth','status')
    if (-not $auth.Ok) {
        Step 'GitHub login required (browser authentication; no token is stored in the project)'
        Run 'gh' @('auth','login','--web','--git-protocol','https')
        $auth = Probe 'gh' @('auth','status')
        if (-not $auth.Ok) { throw 'GitHub authentication did not complete. Run: gh auth login' }
    }
    Run 'gh' @('auth','setup-git')
    $currentUser = (Probe 'gh' @('api','user','--jq','.login'))
    if (-not $currentUser.Ok -or -not $currentUser.Text) { throw 'Unable to read GitHub account. Check gh auth status.' }
    if ($Repository.Contains('/')) { $fullName = $Repository }
    else { $fullName = "$($currentUser.Text)/$Repository" }
    $parts = $fullName.Split('/')
    $owner = $parts[0]
    $repoName = $parts[1]
    $homepage = if ($repoName -ieq "$owner.github.io") { "https://$owner.github.io/" } else { "https://$owner.github.io/$repoName/" }
    $repoUrl = "https://github.com/$fullName"
    $originUrl = "$repoUrl.git"
    $existing = Probe 'gh' @('repo','view',$fullName,'--json','nameWithOwner','--jq','.nameWithOwner')

    Step "Target: $repoUrl"
    Write-Host "Visibility (new repository only): $Visibility"
    Write-Host "Website / About: $homepage"
    Write-Host "Topics: $($about.topics -join ', ')"

    # A user's Desktop/Downloads may be inside an accidentally initialized home
    # directory repository. Never stage or push from that parent repository.
    # If the project is NOT already tracked by the parent, create its own .git
    # here: Git then treats it as an independent, nested repository.
    $projectRoot = [System.IO.Path]::GetFullPath($root).TrimEnd([char]92,[char]47)
    $localGit = Join-Path $projectRoot '.git'
    if (-not (Test-Path -LiteralPath $localGit)) {
        $detected = Probe 'git' @('rev-parse','--show-toplevel')
        if ($detected.Ok -and $detected.Text) {
            $parentRoot = [System.IO.Path]::GetFullPath($detected.Text.Trim()).TrimEnd([char]92,[char]47)
            if ($parentRoot -ine $projectRoot) {
                $prefix = "$parentRoot\"
                if (-not $projectRoot.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                    throw "Unexpected Git working-tree root: $parentRoot. No files were staged."
                }
                $relativeProject = $projectRoot.Substring($prefix.Length).Replace('\','/')
                $parentTracked = Probe 'git' @('-C',$parentRoot,'ls-files','--',$relativeProject)
                if (-not $parentTracked.Ok) {
                    throw "Cannot check tracked files in parent repository: $parentRoot. No files were staged."
                }
                if ($parentTracked.Text) {
                    throw "Parent repository $parentRoot already tracks files inside this project. To protect its history, move the project outside it (for example C:\Projects\target-tab-auto-clicker) and rerun publish.cmd. Do NOT delete the parent's .git folder."
                }
                Step "Parent Git repository detected: $parentRoot"
                Write-Host 'Project files are not tracked by the parent. Creating a separate .git inside this project.'
                Write-Host 'The parent Git repository will not be staged, committed, or pushed.'
            }
        }
        Step 'Initializing independent project Git repository'
        Run 'git' @('init')
    }
    $gitRoot = Probe 'git' @('rev-parse','--show-toplevel')
    if (-not $gitRoot.Ok -or -not $gitRoot.Text) {
        throw 'Unable to identify the project Git repository after initialization.'
    }
    $actualRoot = [System.IO.Path]::GetFullPath($gitRoot.Text.Trim()).TrimEnd([char]92,[char]47)
    if ($actualRoot -ine $projectRoot) {
        throw "Git root mismatch: $actualRoot. Refusing to stage files outside $projectRoot."
    }
    $remote = Probe 'git' @('remote','get-url','origin')
    if ($remote.Ok) {
        $currentRemote = $remote.Text.Trim().TrimEnd('/')
        $valid = @(
            "https://github.com/$fullName.git", "https://github.com/$fullName",
            "git@github.com:$fullName.git", "git@github.com:$fullName"
        )
        if (-not ($valid | Where-Object { $_ -ieq $currentRemote })) {
            throw "origin already points elsewhere: $currentRemote. No push performed."
        }
    }

    # Review what will become public BEFORE committing or pushing.
    # Existing remote history is never force-pushed. A failed push stops safely.
    Step 'Reviewing files that will be committed'
    Run 'git' @('add','--all')
    $stagedFiles = Probe 'git' @('diff','--cached','--name-only')
    if ($stagedFiles.Ok -and $stagedFiles.Text) {
        foreach ($file in ($stagedFiles.Text -split "`r?`n")) {
            if ($file -match '(^|/)(\.env(\..*)?|[^/]*\.(pem|p12|pfx|key|secret)|credentials[^/]*)$') {
                throw "Potential credential file staged: $file. Unstage it and add it to .gitignore first."
            }
        }
        Run 'git' @('diff','--cached','--stat')
    } else {
        Write-Host 'No changed files detected.'
    }
    if (-not (Confirm "Publish reviewed project files to $repoUrl ($Visibility if new)?")) {
        throw 'Cancelled by user. No commit or push performed.'
    }
    Step 'Committing changed files'
    $staged = Probe 'git' @('diff','--cached','--quiet')
    if (-not $staged.Ok) {
        Run 'git' @('commit','-m','Publish Target Tab Auto Clicker')
    } else {
        Write-Host 'No changed files to commit.'
    }
    $hasCommit = Probe 'git' @('rev-parse','--verify','HEAD')
    if (-not $hasCommit.Ok) { throw 'No commit exists. Configure git user.name/user.email and rerun.' }
    Run 'git' @('branch','-M','main')

    if (-not $existing.Ok) {
        Step "Creating GitHub repository $fullName"
        $createFlags = @('repo','create',$fullName,"--$Visibility",'--description',[string]$about.description,'--homepage',$homepage)
        if (-not $remote.Ok) { $createFlags += @('--source','.','--remote','origin') }
        Run 'gh' $createFlags
    }
    if (-not $remote.Ok) {
        $remoteAfterCreate = Probe 'git' @('remote','get-url','origin')
        if (-not $remoteAfterCreate.Ok) { Run 'git' @('remote','add','origin',$originUrl) }
    }
    Step 'Pushing main (no force; does not replace unrelated remote history)'
    Run 'git' @('push','-u','origin','main')

    Step 'Updating GitHub About: description, website, topics'
    Run 'gh' @('repo','edit',$fullName,'--description',[string]$about.description,'--homepage',$homepage)
    foreach ($topic in $about.topics) {
        Run 'gh' @('repo','edit',$fullName,'--add-topic',[string]$topic)
    }

    Step 'Configuring GitHub Pages for Actions deployment'
    $pages = Probe 'gh' @('api',"repos/$fullName/pages",'--jq','.build_type')
    if (-not $pages.Ok) {
        $createPages = Probe 'gh' @('api','-X','POST',"repos/$fullName/pages",'-f','build_type=workflow')
        if (-not $createPages.Ok) {
            Write-Warning 'Could not enable Pages automatically. In GitHub go to Settings > Pages > Source > GitHub Actions.'
        }
    } elseif ($pages.Text -ne 'workflow') {
        $updatePages = Probe 'gh' @('api','-X','PUT',"repos/$fullName/pages",'-f','build_type=workflow')
        if (-not $updatePages.Ok) {
            Write-Warning 'Pages build mode could not be updated. Select GitHub Actions in Settings > Pages.'
        }
    }
    Write-Host "`nSUCCESS: $repoUrl" -ForegroundColor Green
    Write-Host "Website: $homepage (available after GitHub Actions deployment)"
    Write-Host "Actions: $repoUrl/actions"
    Write-Host "Social Preview: Settings > General > Social preview > docs/repository-social-preview.png"
    Write-Host 'If the first Pages workflow failed before Pages was enabled, select Actions > Build and deploy GitHub Pages > Run workflow.'
    exit 0
} catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'No force-push or history overwrite was attempted.'
    Write-Host 'For Git identity: git config --global user.name "Your Name"'
    Write-Host '                  git config --global user.email "you@example.com"'
    exit 1
}
