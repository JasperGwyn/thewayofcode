param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TextArgs
)

function Load-WindowsRuntimeAssembly {
  param([string]$AssemblyName)
  try {
    Add-Type -AssemblyName $AssemblyName -ErrorAction Stop | Out-Null
    return $true
  } catch {
    # Try locate in Reference Assemblies
    $refRoot = "${env:ProgramFiles(x86)}\Reference Assemblies\Microsoft\Framework\"
    if (Test-Path $refRoot) {
      $dll = Get-ChildItem -Path $refRoot -Recurse -Filter 'System.Runtime.WindowsRuntime.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($dll) {
        try {
          Add-Type -Path $dll.FullName -ErrorAction Stop | Out-Null
          return $true
        } catch {}
      }
    }
    return $false
  }
}

$hasWrExt = Load-WindowsRuntimeAssembly -AssemblyName 'System.Runtime.WindowsRuntime'

# Prime WinRT types (Windows Runtime metadata) for PowerShell binding
try {
  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows, ContentType=WindowsRuntime]
  $null = [Windows.Storage.Streams.DataReader, Windows, ContentType=WindowsRuntime]
} catch {
  Write-Error "WinRT types not available. Run in Windows PowerShell (5.1) on Windows 10/11. $_"
  exit 1
}

# Build text
$text = ($TextArgs -join ' ').Trim()
if ([string]::IsNullOrWhiteSpace($text)) {
  $text = 'This is a Windows 11 Speech Synthesizer test in English.'
}

try {
  $synth = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()

  # Prefer English voice if available
  $enVoices = $synth.AllVoices | Where-Object { $_.Language -like 'en-*' }
  if ($enVoices -and $enVoices.Count -gt 0) {
    $synth.Voice = $enVoices[0]
  }

  # Synthesize to stream (WAV format)
  $op = $synth.SynthesizeTextToStreamAsync($text)
  if ($hasWrExt) {
    $stream = [System.Runtime.WindowsRuntime.WindowsRuntimeSystemExtensions]::AsTask($op).GetAwaiter().GetResult()
  } else {
    # Fallback: naive wait loop then attempt GetResults via reflection
    Start-Sleep -Milliseconds 200
    $stream = $op.GetType().InvokeMember('GetResults', 'InvokeMethod', $null, $op, @())
  }

  # Read bytes from SpeechSynthesisStream
  $size = [int]$stream.Size
  $reader = [Windows.Storage.Streams.DataReader]::new($stream)
  $loadOp = $reader.LoadAsync($size)
  if ($hasWrExt) {
    $null = [System.Runtime.WindowsRuntime.WindowsRuntimeSystemExtensions]::AsTask($loadOp).GetAwaiter().GetResult()
  } else {
    Start-Sleep -Milliseconds 100
    $null = $loadOp.GetType().InvokeMember('GetResults', 'InvokeMethod', $null, $loadOp, @())
  }
  $buffer = New-Object byte[] $size
  $reader.ReadBytes($buffer)
  $reader.DetachStream()
  $reader.Dispose()
  $stream.Dispose()

  # Write WAV to temp and play synchronously
  $outPath = Join-Path $env:TEMP 'tts_test_winrt.wav'
  [System.IO.File]::WriteAllBytes($outPath, $buffer)
  Write-Host "Saved: $outPath"

  Add-Type -AssemblyName System.Media
  $player = New-Object System.Media.SoundPlayer $outPath
  $player.PlaySync()
  Write-Host 'Playback finished.'
} catch {
  Write-Error "TTS test failed: $_"
  exit 1
}


