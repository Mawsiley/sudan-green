---
name: apktool
description: Decode, inspect, rebuild and sign Android APKs with Apktool (iBotPeaches/Apktool). Use for APK analysis of apps you own or are authorized to examine, e.g. reading AndroidManifest.xml, resources and smali, or rebuilding a modified APK.
---

# Apktool

Source: https://github.com/iBotPeaches/Apktool (requires Java 8+).

## Setup
If `apktool.jar` is missing, download it (the GitHub release asset URL is versioned; Bitbucket works):

    curl -sSL -o apktool.jar https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_2.11.1.jar
    java -jar apktool.jar --version

## Usage
- Decode: `java -jar apktool.jar d app.apk -o out/` (add `-f` to overwrite, `-s` to skip smali, `-r` to skip resources)
- Rebuild: `java -jar apktool.jar b out/ -o rebuilt.apk`
- Sign (required before install): `apksigner sign --ks my.keystore rebuilt.apk` (or `zipalign` then `apksigner`)
- Install framework for system apps: `java -jar apktool.jar if framework-res.apk`

## Workflow
1. Decode into a fresh directory; never decode into the project source tree.
2. Inspect `AndroidManifest.xml`, `res/`, `smali*/`, `apktool.yml`.
3. Make edits, rebuild, re-sign, test.

Only work on APKs the user owns or is authorized to analyze.
