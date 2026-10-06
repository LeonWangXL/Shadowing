Add-Type -AssemblyName System.Speech
$taskOutput = Join-Path $PSScriptRoot '../public/demo-clips'
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskLines = @(
  'I used to think progress had to be dramatic.',
  "But over time, I realized that's not true.",
  'Small steps make a big difference.',
  "You don't have to be perfect to move forward.",
  'What matters is showing up, again and again.',
  'Each little effort builds your confidence.',
  'And confidence helps you go further.',
  'So be patient with yourself, and keep going.'
)
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskSynth.SelectVoice('Microsoft Zira Desktop')
$taskSynth.Rate = -1
for ($taskIndex = 0; $taskIndex -lt $taskLines.Count; $taskIndex++) {
  $taskSynth.SetOutputToWaveFile((Join-Path $taskOutput "$taskIndex.wav"))
  $taskSynth.Speak($taskLines[$taskIndex])
  $taskSynth.SetOutputToNull()
}
$taskSynth.Dispose()
