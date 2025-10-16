param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TextArgs
)

try {
  Add-Type -AssemblyName System.Speech -ErrorAction Stop
} catch {
  Write-Error "No se pudo cargar System.Speech: $_"
  exit 1
}

$text = ($TextArgs -join ' ').Trim()
if ([string]::IsNullOrWhiteSpace($text)) {
  $text = 'Hello, this is a quick SAPI text-to-speech test in English.'
}

$s = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Intentar tomar una voz en inglés; si no hay, usar la predeterminada
$enVoice = $s.GetInstalledVoices() |
  Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'en' } |
  Select-Object -First 1

if ($enVoice) {
  $s.SelectVoice($enVoice.VoiceInfo.Name)
}

$s.Rate = 0
$s.Volume = 100

Write-Host ("Using voice: " + ($s.Voice.Name))
$s.Speak($text)


