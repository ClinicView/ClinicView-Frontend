# ClinicView PDF fonts

Unmodified static TTFs from the Noto project, distributed under SIL OFL 1.1 (see `OFL.txt`). Pinned upstream commit:

https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf

- `NotoSans/NotoSans-Regular.ttf`: body, Spanish, Greek, subscripts and superscripts.
- `NotoSans/NotoSans-Bold.ttf`: headings and bold labels.
- `NotoSansMath/NotoSansMath-Regular.ttf`: mathematical comparisons and arrows.
- `NotoSansSymbols2/NotoSansSymbols2-Regular.ttf`: check marks and other symbols.

These assets load only when exporting a PDF and are embedded/subsetted in the document. No clinical text or font request is sent to a third-party font service. The application checks character coverage before rendering; unsupported characters produce an explicit error instead of a silently incomplete PDF. This is not universal script coverage.

The archived repository supplies reproducible static builds compatible with the installed renderer; variable fonts are not used. Font registration follows https://react-pdf.org/docs/v4/fonts. A full license accompanies these binaries and must remain with redistributed copies.
