param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TextArgs
)

$text = ($TextArgs -join ' ').Trim()
if ([string]::IsNullOrWhiteSpace($text)) {
  $text = 'This is a test of Windows text-to-speech voices.'
}

Write-Host "🔍 Listing available Windows TTS voices..." -ForegroundColor Cyan
Write-Host "Testing text: '$text'" -ForegroundColor Yellow
Write-Host ""

# Test SAPI voices
Write-Host "📢 SAPI (System.Speech) Voices:" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

try {
  Add-Type -AssemblyName System.Speech -ErrorAction Stop

  $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $voices = $synthesizer.GetInstalledVoices()

  if ($voices.Count -eq 0) {
    Write-Host "❌ No SAPI voices found!" -ForegroundColor Red
  } else {
    $voices | ForEach-Object {
      $voice = $_.VoiceInfo
      $enabled = if ($_.Enabled) { "✅" } else { "❌" }
      Write-Host "$enabled $($voice.Name)" -ForegroundColor White
      Write-Host "   Language: $($voice.Culture.DisplayName) ($($voice.Culture.Name))" -ForegroundColor Gray
      Write-Host "   Gender: $($voice.Gender)" -ForegroundColor Gray
      Write-Host "   Age: $($voice.Age)" -ForegroundColor Gray
      Write-Host ""
    }
  }
} catch {
  Write-Host "❌ SAPI not available: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test Windows Runtime voices (Windows 10/11)
Write-Host "🎯 Windows Runtime (WinRT) Voices:" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green

try {
  # Load WinRT assemblies
  $hasWrExt = $false
  try {
    Add-Type -AssemblyName 'System.Runtime.WindowsRuntime' -ErrorAction Stop
    $hasWrExt = $true
  } catch {
    # Try to load from Reference Assemblies
    $refRoot = "${env:ProgramFiles(x86)}\Reference Assemblies\Microsoft\Framework\"
    if (Test-Path $refRoot) {
      $dll = Get-ChildItem -Path $refRoot -Recurse -Filter 'System.Runtime.WindowsRuntime.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($dll) {
        Add-Type -Path $dll.FullName -ErrorAction Stop
        $hasWrExt = $true
      }
    }
  }

  if (-not $hasWrExt) {
    throw "Windows Runtime extensions not available"
  }

  # Prime WinRT types
  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows, ContentType=WindowsRuntime]
  $null = [Windows.Storage.Streams.DataReader, Windows, ContentType=WindowsRuntime]

  $synth = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()
  $winrtVoices = $synth.AllVoices

  if ($winrtVoices.Count -eq 0) {
    Write-Host "❌ No WinRT voices found!" -ForegroundColor Red
  } else {
    $winrtVoices | ForEach-Object {
      $enabled = "✅"
      Write-Host "$enabled $($_.DisplayName)" -ForegroundColor White
      Write-Host "   Language: $($_.Language)" -ForegroundColor Gray
      Write-Host "   Gender: $($_.Gender)" -ForegroundColor Gray
      Write-Host "   Description: $($_.Description)" -ForegroundColor Gray
      Write-Host ""
    }
  }

  # Test a sample voice if available
  if ($winrtVoices.Count -gt 0) {
    Write-Host "🎵 Testing first available WinRT voice..." -ForegroundColor Cyan
    $synth.Voice = $winrtVoices[0]
    Write-Host "Using voice: $($synth.Voice.DisplayName)" -ForegroundColor Yellow

    $op = $synth.SynthesizeTextToStreamAsync($text)
    if ($hasWrExt) {
      $stream = [System.Runtime.WindowsRuntime.WindowsRuntimeSystemExtensions]::AsTask($op).GetAwaiter().GetResult()
    } else {
      Start-Sleep -Milliseconds 200
      $stream = $op.GetType().InvokeMember('GetResults', 'InvokeMethod', $null, $op, @())
    }

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

    $tempFile = Join-Path $env:TEMP 'winrt_tts_test.wav'
    [System.IO.File]::WriteAllBytes($tempFile, $buffer)

    Write-Host "Saved test audio to: $tempFile" -ForegroundColor Green

    # Play the audio
    Add-Type -AssemblyName System.Media
    $player = New-Object System.Media.SoundPlayer $tempFile
    $player.PlaySync()

    Write-Host "✅ WinRT TTS test completed" -ForegroundColor Green

    # Cleanup
    $reader.DetachStream()
    $reader.Dispose()
    $stream.Dispose()
  }

} catch {
  Write-Host "❌ WinRT not available: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "   WinRT voices require Windows 10/11" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Notes:" -ForegroundColor Cyan
Write-Host "   - SAPI voices are basic system voices" -ForegroundColor White
Write-Host "   - WinRT voices are modern neural voices (Windows 10/11 only)" -ForegroundColor White
Write-Host "   - More voices can be installed via Windows Settings > Time & Language > Speech" -ForegroundColor White
Write-Host "   - Neural voices provide better quality than traditional voices" -ForegroundColor White
