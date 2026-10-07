# Echo Shadowing Trainer

[中文](README.md) | **English**

A personal web app for practicing spoken English with timed video or audio. The Focus Studio layout places the player and active practice unit on the left, with the transcript and feedback on the right.

Repository: [LeonWangXL/Shadowing](https://github.com/LeonWangXL/Shadowing)

User manuals: [English](docs/Echo-User-Manual.en.md) · [中文](docs/Echo影子跟读-使用操作手册.md). Both include a workflow diagram, numbered screenshots and operating steps. The interface and screenshot labels are currently Chinese; the English manual explains their meanings.

## Quick start

1. Open the running preview at `http://127.0.0.1:4173/`.
2. Use the built-in eight-sentence demo, or select **导入素材** (Import materials) and import local media plus matching SRT/VTT subtitles.
3. Select a starting cue and a practice range: one sentence, 2/3/5/10 sentences, or a custom positive count.
4. Select a mode in **练习设置** (Practice settings). For preparation time, choose manual listen-then-record.
5. Click **开始跟读** (Start practice). In manual mode, listen first, then click **开始录音** (Start recording) when ready. Allow microphone access when prompted.
6. Click **结束录音** (Finish recording), then listen to the saved take. Its waveform appears automatically; **对比原声** (Compare source) samples the reference on demand.
7. Bookmark difficult sentences for review and download important recordings.

The demo uses Microsoft Zira synthesized speech and an AI-generated static cover, not a real interview video. English text and Chinese translations are project examples; demo subtitles are in `public/demo.srt`.

## Practice features

- Playback speed: 0.6/0.8/1.0/1.2x; repeats: 1/2/3/5; optional progression to the next sentence/group.
- **Automatic listen-then-record:** recording starts when the source finishes.
- **Manual listen-then-record:** each round waits for your explicit recording action. Waiting does not use recording time; cancelling it does not create an empty take.
- **Simultaneous shadowing:** play and record together; headphones reduce source leakage into the microphone.
- Both listen modes offer automatic duration or at least 30 seconds, 1 minute, 2 minutes, or 5 minutes. Automatic duration follows the reference at the selected speed plus about 1.2 seconds. Every take is capped at 5 minutes. Finish early to save a valid take.
- Groups preserve pauses between consecutive cues. Repeats and progression operate on the whole group. Groups near the end use the remaining cues. During continuous playback, the selected group text stays stable until its last cue finishes; player captions may follow individual cues.
- Single-cue and group takes are shown separately. Recordings retain their capture-time reference text, bounds and speed; later subtitle edits do not rewrite historical references.
- Hide subtitles with the eye icon; edit text, translation and timing with the sliders icon. In a group, the editor modifies its first cue.

## Imports, downloads and local data

Supported media includes MP4, WebM, MP3, WAV and M4A, provided the browser can decode the file. H.264/AAC is a practical MP4 choice. The application imposes no media/subtitle file-size cap, cue-count cap, per-cue text-length cap or total subtitle-duration cap. Actual capacity depends on browser storage, memory and device resources. Long transcripts use 100-cue pages and a cue-number jump.

SRT/VTT needs valid, non-overlapping time ranges and non-empty text. Cues beyond media duration remain intact with a warning: playback is clipped to available media, and wholly out-of-range cues cannot be practiced. Match media and subtitle versions. Bilingual subtitles use English as reference text and Chinese as translation. Plain-text alignment and video-site URL importing are not implemented.

In **导入素材 → 我的素材** (Import materials → My materials), download original media, retained original subtitles, or the current edited SRT. Original filenames are preserved. Older imports may not contain the original subtitle file. Takes download as WAV; review exports metadata as JSON without audio, and there is no JSON restore feature.

Deleting a material moves it to a persistent recycle bin and hides related recordings, assessments and review marks. Restore brings them back. The bin still uses storage. Confirmed permanent deletion removes the material and related data in one database transaction. The built-in demo is protected. Deleting an individual take cannot be undone via the material recycle bin.

Media, recordings and review data use IndexedDB; preferences and practice position use localStorage. There is no account synchronization. Different browsers, profiles or origins have separate data, including `localhost:4173` versus `127.0.0.1:4173`. Clearing site data or losing browser storage can remove records. Download backups. Ordinary imports are not uploaded to a server.

## Waveform comparison

The selected recording waveform appears first. Only **对比原声** samples the source range, silently using the browser's native media decoder and bounded energy bins. It does not load/decode the entire source into an ArrayBuffer/AudioBuffer. Sampling supports progress and cancellation; failure preserves the recording waveform.

Both RMS waveforms share time and amplitude scales. Source sampling runs at 1.0x and its displayed duration is adjusted to the take's captured practice speed. Processing takes roughly the original range's playback duration. Waveforms help inspect duration, pauses and amplitude; they are not pronunciation scores, voice similarity scores, sample-exact slowed audio or word alignment.

## Development and running

Requires Node.js **22.18+ or 24+** and npm. The recorded development environment used Node.js 23.9.

```powershell
npm ci --cache .npm-cache --registry https://registry.npmjs.org
npm run dev
```

After installing dependencies, `start.cmd` is another entry point. The development URL is `http://127.0.0.1:4173/`; an existing preview need not be started twice.

```powershell
npm run typecheck
npm test
npm run build
npm start
```

Production assets are in `dist/client`. `npm start` serves them and the assessment API through the bundled Node server. `PORT` defaults to 4173 and `HOST` to 127.0.0.1. Microphone access requires localhost or HTTPS; remote deployments need HTTPS.

The Sites static Worker remains in `dist/server`; it does not include the Node speech proxy. Cloud assessment needs the Node service or a protected same-origin API. Preserve the Sites handoff files; before a handoff run `npm run build` and `npm run test:sites`.

## Optional real pronunciation assessment

Playback, recording, comparison and review work without cloud services. **No service response means no invented score.**

1. Create an Azure Speech resource.
2. Copy `.env.example` to `.env` and set the backend credentials:

```dotenv
AZURE_SPEECH_KEY=your-resource-key
AZURE_SPEECH_REGION=eastasia
AZURE_ENABLE_PROSODY=false
```

3. Restart the service and check its connection status in the assessment settings.
4. Select a take and click **评测此录音** (Assess this recording). Only this action sends the take and its capture-time reference text to Azure Speech; charges may apply.

Assessment uses American English (`en-US`) and accepts 16 kHz mono PCM WAV recordings of 0.3–30 seconds with reference text up to 2,000 characters. Longer local takes remain playable and downloadable. The server validates audio and proxies the official short-audio endpoint. Accuracy, fluency, completeness, optional prosody, word and phoneme results are displayed only when returned. Assessment is reference-based reading feedback, not similarity to the speaker's voice. Check service capabilities and costs before enabling prosody.

Keep keys on the backend: do not use a `VITE_` prefix or commit `.env`. This personal edition has no user authentication, per-user quotas or multi-user data isolation. Protect access before exposing a paid API publicly.

References:

- [Azure short-audio REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)
- [Azure pronunciation assessment](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/how-to-pronunciation-assessment)
- [Browser microphone secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## Validation scope

Automated checks cover subtitles, demo timing, WAV encoding, server audio validation, assessment parsing, authentication errors, missing configuration and cross-site requests. Browser evidence covers playback, settings, import, reload persistence, review, editing, desktop/mobile layouts and later group/waveform fixes; see `qa/` and `design-qa.md`.

`tests/browser-runner.html` is a development-only integration harness using synthetic audio to exercise AudioWorklet, resampling, WAV encoding, progression and IndexedDB. It requests no microphone and calls no cloud service, and is excluded from production. Synthetic tests do not replace physical-device microphone, permission, headphone leakage or human pronunciation testing. Real paid Azure assessment has not been tested end to end with actual credentials; service mappings were tested with mocks.

## Source map

- `src/App.tsx`: practice, imports, recordings, review and feedback UI.
- `src/usePractice.ts`: playback, recording, saving, repeats and progression.
- `src/audio.ts`, `public/capture-worklet.js`: microphone capture, levels and 16 kHz WAV.
- `src/subtitles.ts`, `src/storage.ts`: subtitle validation and persistence.
- `server/assessment.mjs`: assessment proxy and normalization.
- `server/start.mjs`: production files and API service.
- `PRODUCT.md`: scope and iteration principles.

## Article to speech and subtitles

In Import materials, expand “文章转语音 + 自动生成 SRT” (Article to speech + SRT), paste an article or import a UTF-8 TXT file, choose a voice, and click “生成并导入练习” (Generate and import). Third-party open-source edge-tts calls Microsoft's online speech service, not a Microsoft open-source offline engine. No Azure key is required. Generation requires a network connection and sends article content to Microsoft. Generated audio is stored in the browser for offline replay.

Audio is generated by sentence. Cue times use actual decoded audio lengths with 0.25-second gaps. This does not align articles to existing videos. Rule-based segmentation may need review for complex abbreviations and punctuation. There is no total article character cap; long sentences are split into requests. Progress and cancellation are available. Failure imports no partial lesson and retains the input to retry. Browser memory/storage and WAV's 32-bit capacity limit extremely long output.

Download the original article, generated audio, original SRT or edited SRT. These files follow the lesson into the recycle bin. Existing groups, repeats, automatic progression and manual recording apply. Local recording supports five minutes. Cloud pronunciation assessment remains English-only and limited to 30 seconds; synthesized speech never supplies pronunciation scores.

The local backend requires Python 3.9+: run `python -m venv .venv-tts`, then `.venv-tts/Scripts/python.exe -m pip install -r server/requirements-tts.txt` on Windows, or use `.venv-tts/bin/python` elsewhere. The project environment is detected automatically; `TTS_PYTHON` in `.env` can override it. Node development, preview and production servers support synthesis. The current Sites Worker cannot execute Python and needs a separate speech backend for cloud generation. Online service changes may interrupt synthesis but do not affect saved materials.