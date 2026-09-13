# ==============================================================================
# Micro-servidor HTTP Nativo para Calendário Digital de Visitas (ABB)
# Zero dependências externas - utiliza System.Net.HttpListener do .NET / Windows
# ==============================================================================

param(
    [int]$Port = 3000,
    [string]$ExcelFileName = "Calendario_Digital_Base.xlsx"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$distDir = Join-Path $scriptDir "dist"
$excelFilePath = Join-Path $scriptDir $ExcelFileName

# Se a pasta dist não existir, avisa
if (-not (Test-Path $distDir)) {
    Write-Host "AVISO: Pasta 'dist' nao encontrada em $distDir." -ForegroundColor Yellow
    Write-Host "Execute 'npm run build' para gerar os arquivos de producao." -ForegroundColor Yellow
}

# Tipos MIME suportados
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}

# Tenta iniciar o HttpListener na porta configurada ou tenta portas subsequentes
$listener = New-Object System.Net.HttpListener
$started = $false
$maxTries = 5

for ($i = 0; $i -lt $maxTries; $i++) {
    $currentPort = $Port + $i
    $prefix = "http://localhost:$currentPort/"
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add($prefix)
    try {
        $listener.Start()
        $started = $true
        $Port = $currentPort
        Write-Host "Servidor ativo em: $prefix" -ForegroundColor Green
        break
    } catch {
        Write-Host "Porta $currentPort ocupada, tentando proxima..." -ForegroundColor Gray
    }
}

if (-not $started) {
    Write-Host "ERRO: Nao foi possivel iniciar o servidor em nenhuma porta." -ForegroundColor Red
    Exit 1
}

# Loop principal de escuta
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers para flexibilidade
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $urlPath = $request.Url.LocalPath

        # --- API: Status ---
        if ($urlPath -eq "/api/excel/status") {
            $exists = Test-Path $excelFilePath
            $statusObj = @{
                running = $true
                port = $Port
                excelFileName = $ExcelFileName
                excelExists = $exists
                excelPath = $excelFilePath
            }
            $json = ConvertTo-Json $statusObj
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # --- API: Carregar Excel da Rede ---
        if ($urlPath -eq "/api/excel/load" -and $request.HttpMethod -eq "GET") {
            if (Test-Path $excelFilePath) {
                try {
                    $bytes = [System.IO.File]::ReadAllBytes($excelFilePath)
                    $response.ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    $response.AddHeader("Content-Disposition", "attachment; filename=$ExcelFileName")
                    $response.ContentLength64 = $bytes.Length
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                } catch {
                    $response.StatusCode = 500
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Erro ao ler arquivo Excel: $($_.Exception.Message)")
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                }
            } else {
                $response.StatusCode = 404
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Arquivo Excel nao encontrado no caminho da rede.")
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $response.Close()
            continue
        }

        # --- API: Salvar Excel na Rede ---
        if ($urlPath -eq "/api/excel/save" -and $request.HttpMethod -eq "POST") {
            try {
                $memStream = New-Object System.IO.MemoryStream
                $request.InputStream.CopyTo($memStream)
                $dataBytes = $memStream.ToArray()

                if ($dataBytes.Length -gt 0) {
                    # Salva temporário e renomeia para evitar corrupção
                    $tempFile = "$excelFilePath.tmp"
                    [System.IO.File]::WriteAllBytes($tempFile, $dataBytes)
                    if (Test-Path $excelFilePath) {
                        Remove-Item $excelFilePath -Force
                    }
                    Move-Item -Path $tempFile -Destination $excelFilePath -Force

                    $respJson = ConvertTo-Json @{ success = $true; message = "Arquivo Excel salvo com sucesso na rede!"; size = $dataBytes.Length }
                    $respBuffer = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                    $response.StatusCode = 200
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($respBuffer, 0, $respBuffer.Length)
                } else {
                    $response.StatusCode = 400
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Dados vazios recebidos.")
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                }
            } catch {
                $response.StatusCode = 500
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Erro ao salvar arquivo: $($_.Exception.Message)")
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $response.Close()
            continue
        }

        # --- Servir arquivos estáticos (dist/) ---
        $relativePath = $urlPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            $relativePath = "index.html"
        }

        $filePath = Join-Path $distDir $relativePath

        # Suporte a SPA: se arquivo não existe, serve o index.html
        if (-not (Test-Path $filePath) -or (Get-Item $filePath).PSIsContainer) {
            $filePath = Join-Path $distDir "index.html"
        }

        if (Test-Path $filePath) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

            # Garante que arquivos HTML nunca fiquem em cache antigo do navegador
            if ($ext -eq ".html" -or $urlPath -eq "/" -or $filePath.EndsWith("index.html")) {
                $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
                $response.AddHeader("Pragma", "no-cache")
                $response.AddHeader("Expires", "0")
            }

            try {
                $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $contentType
                $response.ContentLength64 = $fileBytes.Length
                $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
            } catch {
                $response.StatusCode = 500
            }
        } else {
            $response.StatusCode = 404
        }

        $response.Close()
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
