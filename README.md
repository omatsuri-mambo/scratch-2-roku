# Scratch to Roku Converter

A dependency-free browser tool for turning Scratch `.sb3` projects into a native Roku SceneGraph starter package.


## What It Does

- Reads `.sb3` files locally in the browser.
- Extracts `project.json` and packaged Scratch assets.
- Generates Roku starter files:
  - `manifest`
  - `source/main.brs`
  - `components/MainScene.xml`
  - `components/MainScene.brs`
  - `source/ScratchLogic.brs`
  - `source/RemoteInputMap.brs`
  - `README.txt`
- Downloads the generated Roku project as a ZIP.
- Shows a side panel of Scratch blocks and features that need manual Roku work.
- Uses a Scratch sprite named `rokusmanifest` as a manifest override when that sprite contains a comment/note.
- Lets you map Scratch keyboard keys to Roku remote buttons before export.
- Reserves Roku Play/Pause for Scratch project start/stop behavior.
- Uses a Scratch sprite named `rokuthumbnail` as the Roku channel thumbnail when it has a costume.
- Converts SVG costumes and thumbnails to PNG files during export.
- Includes a short tutorial for Scratch projects that convert more cleanly.

## Current Conversion Scope

The generated Roku channel starter maps initial sprite positions and copies available assets. It also emits logic notes for detected Scratch scripts. Full Scratch runtime behavior is intentionally conservative for now because Roku does not run Scratch HTML/JavaScript projects directly.

Unsupported or partial features are reported in the app, including clones, pen, color collision sensing, Scratch extensions, custom blocks, and lists.

## Manifest Notes

To customize the generated Roku `manifest`, create a sprite named `rokusmanifest` in Scratch. Add a comment/note inside that sprite with the full manifest text, for example:

```text
title=My Roku Game
major_version=1
minor_version=0
build_version=00001
ui_resolutions=hd
```

The converter will use that note as the manifest and will not place the `rokusmanifest` helper sprite on the generated Roku stage.

## Thumbnail Sprite

To set the Roku channel thumbnail, create a sprite named `rokuthumbnail` and give it one costume. The converter exports that costume as `assets/roku-thumbnail.png` and adds this manifest line:

```text
mm_icon_focus_hd=pkg:/assets/roku-thumbnail.png
```

The `rokuthumbnail` helper sprite is not placed on the generated Roku stage.

## Credits

rokucommunity: making BrighterScript and Bslint

omatsuri-mambo: Making Sb3-2-Roku
