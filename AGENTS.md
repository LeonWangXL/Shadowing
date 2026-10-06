# Prototype Instructions

The user selected ideation option 1 (Focus Studio), a warm white / forest-green desktop layout with video and active sentence on the left and a sentence transcript on the right. Preserve this direction. The app is a functional personal shadowing trainer, with local media / recordings and optional real pronunciation assessment; never invent pronunciation scores. The user's communication preference is factual, logical analysis without pandering.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

The user needs longer practice: preserve adjustable recording time up to 5 minutes and automatic sentence progression. Longer practice recordings must remain playable and downloadable; clearly distinguish the cloud assessment 30-second limit.

SRT imports must not impose a fixed cue-count, text-length or total-duration cap. Paginate long transcripts; retain valid time-axis checks and separate assessment limits.

Imported resources must be downloadable: original media, original subtitle when retained, and the current edited subtitle as SRT. Preserve original filenames and distinguish original from current subtitle.

Resource deletion uses a persistent recycle bin with restoration of related practice data; permanent purge requires an explicit scope confirmation and one atomic IndexedDB transaction. Built-in demo is protected.

All imported media and subtitle files must have no application-imposed file-size cap. Explain browser storage limits without presenting them as a fixed product size limit. Keep recording and assessment duration limits separate.

Subtitle end times beyond media duration must not block imports or edits. Preserve all original cues, warn about mismatch, clamp playback to available media and reject practice for wholly out-of-range cues before requesting a microphone.

Continuous playback subtitle updates must never seek the media back to cue start. Seek only for explicit selection or practice playback; await seek completion before starting a practice segment. Preserve SRT boundaries instead of applying arbitrary global trims.

Multi-sentence practice groups contiguous cues from the selected start, preserving inter-cue pauses. Both listen-then-record and shadow modes, repeats and automatic progression act on the whole group. Store group identity, member cue IDs and merged reference text separately from single-cue attempts.

Recording comparisons should show real source/recording waveforms on shared time and amplitude scales. Preserve capture-time reference bounds and playback rate; never invent similarity scores or imply waveform shape establishes pronunciation accuracy. Decode on explicit request to avoid automatically processing huge media.

Show the selected recording waveform automatically and first. Only decode/show source waveform after explicit “对比原声”; a failed source comparison must not remove the recording waveform.

Source-waveform comparisons must never fetch the whole source into an ArrayBuffer or decode it into a complete AudioBuffer. Stream the selected range through the native media decoder and accumulate bounded energy bins; provide progress/cancellation and release media/context on completion.

Practice range must include a custom contiguous cue count in addition to presets. Preserve custom counts across reloads, validate positive integers and clamp groups at the final cue. Source waveform sampling must establish its render-clock anchor before allowing audio processing, so startup samples are not discarded. Test immediate onset, real leading silence and nonzero start offsets.

Offer manual listen-then-record mode: after each source playback wait indefinitely for explicit start-recording input, including repeated/group/auto-next rounds. Waiting must not capture microphone samples or consume recording duration; cancellation must not create an empty attempt. Preserve automatic listen mode.

During continuous playback, keep the selected practice group and its full text stable until the last cue finishes. Only then advance to the next group; the player subtitle may follow individual cues without changing group selection. Explicit user selection remains immediate.
