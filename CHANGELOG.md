# Changelog

## 0.3.0 — 2026-06-03

First Marketplace release (renamed from `iupac-color`).

### Added

- **FASTQ blocks anywhere.** 4-line FASTQ records are detected and colored in
  any file (markdown, plain text, scratch buffers), not just `.fastq` / `.fq`.
- **Quality hover.** Hover any FASTQ quality character to see Phred Q value,
  error probability, and accuracy.
- **Muted gap chars.** `- . * ~` inside colored runs render in muted grey
  instead of unstyled, matching the IUPAC ambiguity-code treatment.
- **Tag color.** `<color>` / `</color>` literal tags use muted grey with
  alpha 0.55 instead of opacity 0.3 (clearer against varied backgrounds).
- **Lower AA threshold.** Amino-acid auto-detect now needs only 12 residues
  (was 24), matching the nucleotide minimum. `AA_MINDISTINCT=8` still
  suppresses most prose.

### Changed

- Config keys and command IDs renamed from `iupacColor.*` to `biocolor.*`.
- Display name and Marketplace listing renamed from
  "IUPAC Sequence Color" to "Biocolor".

### Fixed

- FASTQ parser tolerates seq/qual length mismatch instead of dumping the
  record into the generic colorer (which previously mis-classified the
  quality line as amino acids when it contained `IIIHHHGGG`-style chars).
