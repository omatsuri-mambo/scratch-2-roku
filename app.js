const SUPPORTED_BLOCKS = new Set([
  "event_whenflagclicked",
  "event_whenkeypressed",
  "event_whenbroadcastreceived",
  "event_broadcast",
  "event_broadcastandwait",
  "control_wait",
  "control_repeat",
  "control_forever",
  "control_if",
  "control_if_else",
  "control_stop",
  "motion_movesteps",
  "motion_gotoxy",
  "motion_glideto",
  "motion_changexby",
  "motion_changeyby",
  "motion_setx",
  "motion_sety",
  "motion_turnright",
  "motion_turnleft",
  "motion_pointindirection",
  "looks_show",
  "looks_hide",
  "looks_switchcostumeto",
  "looks_nextcostume",
  "looks_sayforsecs",
  "looks_say",
  "looks_thinkforsecs",
  "looks_think",
  "sound_play",
  "sound_playuntildone",
  "sound_stopallsounds",
  "data_setvariableto",
  "data_changevariableby",
  "operator_add",
  "operator_subtract",
  "operator_multiply",
  "operator_divide",
  "operator_equals",
  "operator_gt",
  "operator_lt",
  "operator_and",
  "operator_or",
  "operator_not",
  "operator_random",
  "operator_join",
]);

const BLOCK_NOTES = {
  control_create_clone_of: "Roku output does not synthesize Scratch clone lifecycles yet.",
  control_start_as_clone: "Clone startup scripts need a custom SceneGraph node factory.",
  control_delete_this_clone: "Clone deletion needs manual runtime support.",
  sensing_touchingcolor: "Pixel-perfect color collision is not available in this starter runtime.",
  sensing_coloristouchingcolor: "Scratch color collision needs a custom Roku collision layer.",
  sensing_askandwait: "Roku remote text entry needs a native dialog flow.",
  sensing_videoon: "Video sensing requires Scratch camera features Roku channels cannot reproduce.",
  pen_clear: "Pen drawings need a custom bitmap or canvas-like renderer.",
  pen_stamp: "Pen stamping needs a custom render target implementation.",
  procedures_definition: "Custom blocks are listed, but their bodies are not inlined yet.",
  procedures_call: "Custom block calls need generated helper functions.",
  music_playDrumForBeats: "Scratch music extension needs a Roku audio mapping.",
  text2speech_speakAndWait: "Text-to-speech extension is not mapped to Roku APIs.",
  translate_getTranslate: "Translate extension needs an online service integration.",
};

const CATEGORY_NOTES = {
  pen: "Scratch pen blocks do not have a direct SceneGraph equivalent.",
  sensing: "Only simple sensing can be approximated; collision-heavy sensing is manual.",
  videoSensing: "Camera/video sensing cannot be packaged into a normal Roku channel.",
  music: "Music extension blocks need a separate audio sequencer.",
  text2speech: "Text-to-speech extension blocks are not converted.",
  translate: "Translate extension blocks need a service call and policy review.",
};

const SCRATCH_KEYS = [
  "space",
  "up arrow",
  "down arrow",
  "left arrow",
  "right arrow",
  "enter",
  "w",
  "a",
  "s",
  "d",
  "z",
  "x",
];

const ROKU_BUTTONS = [
  { value: "", label: "No mapping" },
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "OK", label: "OK / Select" },
  { value: "back", label: "Back" },
  { value: "replay", label: "Replay" },
  { value: "options", label: "Options" },
  { value: "info", label: "Info" },
];

const DEFAULT_REMOTE_MAP = {
  "space": "OK",
  "up arrow": "up",
  "down arrow": "down",
  "left arrow": "left",
  "right arrow": "right",
  enter: "OK",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  z: "back",
  x: "replay",
};

const state = {
  projectName: "scratch-roku-project",
  project: null,
  analysis: null,
  files: new Map(),
  generated: new Map(),
  unsupported: [],
  remoteMap: { ...DEFAULT_REMOTE_MAP },
  keysUsed: new Set(SCRATCH_KEYS),
  manifestOverride: null,
  assetNameMap: new Map(),
  thumbnailAssetName: "",
  currentFile: "manifest",
  filter: "all",
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  chooseButton: document.querySelector("#chooseButton"),
  dropZone: document.querySelector("#dropZone"),
  sampleButton: document.querySelector("#sampleButton"),
  downloadButton: document.querySelector("#downloadButton"),
  targetCount: document.querySelector("#targetCount"),
  assetCount: document.querySelector("#assetCount"),
  scriptCount: document.querySelector("#scriptCount"),
  unsupportedCount: document.querySelector("#unsupportedCount"),
  projectStatus: document.querySelector("#projectStatus"),
  qualityPill: document.querySelector("#qualityPill"),
  stagePreview: document.querySelector("#stagePreview"),
  codeOutput: document.querySelector("#codeOutput code"),
  unsupportedList: document.querySelector("#unsupportedList"),
  mappingGrid: document.querySelector("#mappingGrid"),
  resetMappingButton: document.querySelector("#resetMappingButton"),
  tabs: document.querySelectorAll(".tab"),
  filters: document.querySelectorAll(".filter"),
};

renderMappingGrid();

els.chooseButton.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files?.[0];
  if (file) loadFile(file);
});

for (const eventName of ["dragenter", "dragover"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  });
}

els.dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files?.[0];
  if (file) loadFile(file);
});

els.sampleButton.addEventListener("click", () => {
  const sampleProject = createSampleProject();
  convertProject(sampleProject, createSampleFiles(), "demo-space-cat");
});

els.resetMappingButton.addEventListener("click", () => {
  state.remoteMap = { ...DEFAULT_REMOTE_MAP };
  renderMappingGrid();
  refreshGeneratedProject();
});

els.downloadButton.addEventListener("click", async () => {
  if (!state.generated.size) return;
  const zipBlob = await createZipBlob(state.generated);
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName(state.projectName)}-roku.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.currentFile = tab.dataset.file;
    els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    renderCode();
  });
});

els.filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    state.filter = filter.dataset.filter;
    els.filters.forEach((item) => item.classList.toggle("active", item === filter));
    renderUnsupported();
  });
});

async function loadFile(file) {
  setStatus(`Reading ${file.name}...`, "Waiting");
  try {
    const buffer = await file.arrayBuffer();
    if (file.name.toLowerCase().endsWith(".json")) {
      const project = JSON.parse(new TextDecoder().decode(buffer));
      await convertProject(project, new Map(), file.name.replace(/\.json$/i, ""));
      return;
    }

    const files = await unzip(buffer);
    const projectEntry = files.get("project.json");
    if (!projectEntry) {
      throw new Error("This .sb3 does not contain project.json.");
    }
    const project = JSON.parse(new TextDecoder().decode(projectEntry));
    await convertProject(project, files, file.name.replace(/\.sb3$/i, ""));
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not read that file.", "Problem", "warn");
  }
}

async function convertProject(project, sourceFiles, name) {
  state.projectName = project.meta?.semver ? name : name || "scratch-project";
  state.project = project;
  state.files = sourceFiles;
  const analysis = analyzeProject(project, sourceFiles);
  state.analysis = analysis;
  state.unsupported = analysis.unsupported;
  state.keysUsed = getKeyboardKeys(project);
  state.manifestOverride = getManifestOverride(project);
  state.assetNameMap = new Map();
  state.thumbnailAssetName = "";
  state.generated = await generateRokuProject(project, analysis, sourceFiles);
  els.downloadButton.disabled = false;
  renderMappingGrid();
  renderSummary(analysis);
  renderPreview(project);
  renderUnsupported();
  renderCode();
}

async function refreshGeneratedProject() {
  if (!state.project || !state.analysis) return;
  state.generated = await generateRokuProject(state.project, state.analysis, state.files);
  renderCode();
}

function analyzeProject(project, sourceFiles) {
  const targets = project.targets || [];
  const unsupported = [];
  let scriptCount = 0;
  const assetNames = new Set();

  for (const target of targets) {
    if (isManifestTarget(target)) {
      if (!getManifestNote(target)) {
        unsupported.push({
          type: "feature",
          title: "rokusmanifest sprite has no note",
          target: target.name || "rokusmanifest",
          severity: "low",
          detail: "Add one Scratch comment/note inside this sprite to override the generated Roku manifest.",
        });
      }
      continue;
    }

    if (isThumbnailTarget(target)) {
      continue;
    }

    for (const costume of target.costumes || []) {
      if (costume.md5ext) assetNames.add(costume.md5ext);
      const format = String(costume.dataFormat || costume.md5ext?.split(".").pop() || "").toLowerCase();
      if (format === "svg") {
        continue;
      }
    }
    for (const sound of target.sounds || []) {
      if (sound.md5ext) assetNames.add(sound.md5ext);
      const format = String(sound.dataFormat || sound.md5ext?.split(".").pop() || "").toLowerCase();
      if (format && !["mp3", "m4a", "aac", "wav"].includes(format)) {
        unsupported.push({
          type: "feature",
          title: "Unverified sound format",
          target: `${target.name || "Stage"} / ${sound.name || sound.md5ext}`,
          severity: "low",
          detail: "This sound format may need conversion before Roku playback.",
        });
      }
    }

    const blocks = target.blocks || {};
    for (const [blockId, block] of Object.entries(blocks)) {
      if (!block || Array.isArray(block)) continue;
      if (block.topLevel) scriptCount += 1;
      const opcode = block.opcode || "unknown";
      if (!SUPPORTED_BLOCKS.has(opcode)) {
        unsupported.push({
          type: "block",
          title: opcode,
          target: target.name || "Stage",
          severity: severityForOpcode(opcode),
          detail: BLOCK_NOTES[opcode] || CATEGORY_NOTES[opcode.split("_")[0]] || "No direct Roku conversion rule exists yet.",
          id: blockId,
        });
      }
    }

    if ((target.lists || []).length) {
      unsupported.push({
        type: "feature",
        title: "Scratch lists",
        target: target.name || "Stage",
        severity: "medium",
        detail: "Lists are detected but not emitted into generated BrightScript state yet.",
      });
    }
  }

  const copiedAssets = [...assetNames].filter((asset) => sourceFiles.has(asset));
  const missingAssets = [...assetNames].filter((asset) => sourceFiles.size && !sourceFiles.has(asset));
  for (const asset of missingAssets) {
    unsupported.push({
      type: "feature",
      title: "Missing packaged asset",
      target: asset,
      severity: "low",
      detail: "The project references this asset, but it was not found in the uploaded archive.",
    });
  }

  return {
    targets,
    targetCount: targets.filter((target) => !isHelperTarget(target)).length,
    scriptCount,
    copiedAssets,
    assetCount: copiedAssets.length,
    unsupported: compactIssues(unsupported),
  };
}

function compactIssues(issues) {
  const map = new Map();
  for (const issue of issues) {
    const key = `${issue.type}|${issue.title}|${issue.target}`;
    if (!map.has(key)) {
      map.set(key, { ...issue, count: 1 });
    } else {
      map.get(key).count += 1;
    }
  }
  return [...map.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityForOpcode(opcode) {
  if (opcode.includes("clone") || opcode.startsWith("pen_") || opcode.startsWith("videoSensing_")) return "high";
  if (opcode.startsWith("sensing_") || opcode.startsWith("procedures_")) return "medium";
  return "low";
}

function severityRank(severity) {
  return { low: 1, medium: 2, high: 3 }[severity] || 1;
}

async function generateRokuProject(project, analysis, sourceFiles) {
  const files = new Map();
  const title = state.projectName || "Scratch Roku Project";
  state.assetNameMap = new Map();
  state.thumbnailAssetName = "";

  for (const assetName of analysis.copiedAssets) {
    const converted = await convertAssetForRoku(assetName, sourceFiles.get(assetName));
    state.assetNameMap.set(assetName, converted.name);
    files.set(`assets/${converted.name}`, converted.bytes);
  }

  const thumbnail = await getThumbnailAsset(project, sourceFiles);
  if (thumbnail) {
    state.thumbnailAssetName = thumbnail.name;
    files.set(`assets/${thumbnail.name}`, thumbnail.bytes);
  }

  files.set("manifest", generateFinalManifest(title));
  files.set("source/main.brs", generateMainBrs());
  files.set("components/MainScene.xml", generateSceneXml());
  files.set("components/MainScene.brs", generateSceneBrs(project));
  files.set("source/ScratchLogic.brs", generateLogicBrs(project, analysis));
  files.set("source/RemoteInputMap.brs", generateRemoteInputMapBrs());
  files.set("README.txt", generateReadme(analysis));

  return files;
}

function generateFinalManifest(title) {
  const base = state.manifestOverride || generateManifest(title);
  if (!state.thumbnailAssetName) return base;
  return upsertManifestLine(base, "mm_icon_focus_hd", `pkg:/assets/${state.thumbnailAssetName}`);
}

function generateManifest(title) {
  return [
    `title=${title}`,
    "major_version=0",
    "minor_version=1",
    "build_version=00001",
    "ui_resolutions=hd",
    "",
  ].join("\n");
}

function generateMainBrs() {
  return [
    "sub Main()",
    "  screen = CreateObject(\"roSGScreen\")",
    "  port = CreateObject(\"roMessagePort\")",
    "  screen.SetMessagePort(port)",
    "  scene = screen.CreateScene(\"MainScene\")",
    "  screen.Show()",
    "",
    "  while true",
    "    msg = wait(0, port)",
    "    if type(msg) = \"roSGScreenEvent\" and msg.isScreenClosed() then return",
    "  end while",
    "end sub",
    "",
  ].join("\n");
}

function generateSceneXml() {
  return [
    "<?xml version=\"1.0\" encoding=\"utf-8\" ?>",
    "<component name=\"MainScene\" extends=\"Scene\">",
    "  <script type=\"text/brightscript\" uri=\"pkg:/components/MainScene.brs\" />",
    "  <script type=\"text/brightscript\" uri=\"pkg:/source/ScratchLogic.brs\" />",
    "  <script type=\"text/brightscript\" uri=\"pkg:/source/RemoteInputMap.brs\" />",
    "  <children>",
    "    <Rectangle id=\"stage\" width=\"1280\" height=\"720\" color=\"0x151922ff\" />",
    "    <Group id=\"spriteLayer\" />",
    "    <Label id=\"caption\" translation=\"40,36\" width=\"1200\" height=\"60\" font=\"font:MediumBoldSystemFont\" color=\"0xf3f6ffff\" />",
    "  </children>",
    "</component>",
    "",
  ].join("\n");
}

function generateSceneBrs(project) {
  const targets = project.targets || [];
  const spriteData = targets
    .filter((target) => !target.isStage && !isHelperTarget(target))
    .map((target) => ({
      name: target.name,
      x: numberOr(target.x, 0),
      y: numberOr(target.y, 0),
      visible: target.visible !== false,
      size: numberOr(target.size, 100),
      costume: getMappedAssetName(target.costumes?.[target.currentCostume || 0]?.md5ext || ""),
    }));

  const serialized = JSON.stringify(spriteData);
  return [
    "sub init()",
    "  m.spriteLayer = m.top.findNode(\"spriteLayer\")",
    "  m.caption = m.top.findNode(\"caption\")",
    `  m.caption.text = \"${escapeBright(project.targets?.[0]?.name || "Scratch project")} converted starter\"`,
    "  createSprites()",
    "  runScratchStarter()",
    "end sub",
    "",
    "sub createSprites()",
    `  sprites = ParseJson("${escapeBright(serialized)}")`,
    "  for each sprite in sprites",
    "    if sprite.visible then",
    "      node = CreateObject(\"roSGNode\", \"Poster\")",
    "      node.uri = \"pkg:/assets/\" + sprite.costume",
    "      node.width = 96 * sprite.size / 100",
    "      node.height = 96 * sprite.size / 100",
    "      node.translation = [640 + sprite.x - node.width / 2, 360 - sprite.y - node.height / 2]",
    "      m.spriteLayer.appendChild(node)",
    "    end if",
    "  end for",
    "end sub",
    "",
  ].join("\n");
}

function generateLogicBrs(project, analysis) {
  const lines = [
    "' Generated Scratch logic notes.",
    "' This starter maps project assets and initial sprite positions.",
    "' Add richer block behavior here as you expand the converter.",
    "",
    "sub runScratchStarter()",
    "  ' Green-flag scripts detected: " + countOpcode(project, "event_whenflagclicked").toString(),
    "  ' Unsupported items detected: " + analysis.unsupported.length.toString(),
    "end sub",
    "",
  ];

  for (const target of project.targets || []) {
    if (isManifestTarget(target)) continue;
    lines.push(`' Target: ${target.name || "Stage"}`);
    const topLevel = Object.values(target.blocks || {}).filter((block) => block && !Array.isArray(block) && block.topLevel);
    for (const block of topLevel) {
      lines.push(`'   Script starts with ${block.opcode}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function generateRemoteInputMapBrs() {
  const rows = [...state.keysUsed]
    .filter((key) => state.remoteMap[key])
    .map((key) => `  map["${escapeBright(key)}"] = "${escapeBright(state.remoteMap[key])}"`);

  return [
    "' Keyboard-to-Roku remote mapping generated before export.",
    "' Use this from onKeyEvent(key as String, press as Boolean) in your scene.",
    "' Roku Play/Pause is reserved for Scratch project start/stop.",
    "",
    "function GetScratchKeyToRemoteMap() as Object",
    "  map = {}",
    ...rows,
    "  return map",
    "end function",
    "",
    "function GetScratchKeyForRokuButton(rokuButton as String) as String",
    "  map = GetScratchKeyToRemoteMap()",
    "  for each scratchKey in map",
    "    if map[scratchKey] = rokuButton then return scratchKey",
    "  end for",
    "  return \"\"",
    "end function",
    "",
    "function GetScratchStartStopRemoteButton() as String",
    "  return \"play\"",
    "end function",
    "",
    "function ShouldToggleScratchProject(rokuButton as String) as Boolean",
    "  return rokuButton = GetScratchStartStopRemoteButton()",
    "end function",
    "",
  ].join("\n");
}

function generateReadme(analysis) {
  const manifestLine = state.manifestOverride
    ? "A rokusmanifest sprite note was used as the Roku manifest."
    : "No rokusmanifest note was found, so a basic manifest was generated.";
  const thumbnailLine = state.thumbnailAssetName
    ? `A rokuthumbnail sprite was exported as assets/${state.thumbnailAssetName}.`
    : "No rokuthumbnail sprite was found.";
  const keyMap = [...state.keysUsed]
    .filter((key) => state.remoteMap[key])
    .map((key) => `- ${key} -> ${state.remoteMap[key]}`)
    .join("\n");
  const issues = analysis.unsupported.length
    ? analysis.unsupported.map((issue) => `- [${issue.severity}] ${issue.target}: ${issue.title} (${issue.count}x)`).join("\n")
    : "- No unsupported blocks detected in this conversion pass.";
  return [
    "Scratch to Roku Converter output",
    "",
    "This package is a native Roku SceneGraph starter generated from a Scratch project.",
    "It copies known assets, positions visible sprites, and emits notes for scripts.",
    manifestLine,
    thumbnailLine,
    "Roku Play/Pause is reserved for Scratch start/stop behavior.",
    "",
    "Remote mapping:",
    keyMap || "- No keyboard mappings selected.",
    "",
    "Manual follow-up needed:",
    issues,
    "",
  ].join("\n");
}

function countOpcode(project, opcode) {
  let count = 0;
  for (const target of project.targets || []) {
    for (const block of Object.values(target.blocks || {})) {
      if (block && !Array.isArray(block) && block.opcode === opcode) count += 1;
    }
  }
  return count;
}

function renderSummary(analysis) {
  els.targetCount.textContent = analysis.targetCount;
  els.assetCount.textContent = analysis.assetCount;
  els.scriptCount.textContent = analysis.scriptCount;
  els.unsupportedCount.textContent = analysis.unsupported.length;
  const hasIssues = analysis.unsupported.length > 0;
  setStatus(`${state.projectName} converted into a Roku starter project.`, hasIssues ? "Needs Work" : "Ready", hasIssues ? "warn" : "ready");
}

function renderPreview(project) {
  const sprites = (project.targets || []).filter((target) => !target.isStage && !isHelperTarget(target));
  if (!sprites.length) {
    els.stagePreview.innerHTML = `<div class="empty-state"><p>This project has no visible sprite targets.</p></div>`;
    return;
  }

  els.stagePreview.innerHTML = "";
  for (const sprite of sprites) {
    const dot = document.createElement("div");
    dot.className = "sprite-dot";
    const leftPercent = ((numberOr(sprite.x, 0) + 240) / 480) * 100;
    dot.style.left = `${leftPercent}%`;
    dot.style.top = `${((180 - numberOr(sprite.y, 0)) / 360) * 100}%`;
    if (leftPercent > 72) dot.classList.add("edge-right");
    dot.style.background = colorFromName(sprite.name || "sprite");
    dot.style.opacity = sprite.visible === false ? "0.35" : "1";
    dot.innerHTML = `<span>${escapeHtml(sprite.name || "Sprite")}</span>`;
    els.stagePreview.append(dot);
  }
}

function renderMappingGrid() {
  const keys = [...state.keysUsed];
  els.mappingGrid.innerHTML = keys
    .map(
      (key) => `
        <div class="mapping-row">
          <label for="map-${safeName(key)}">
            ${escapeHtml(key)}
            <span>Scratch keyboard key</span>
          </label>
          <select id="map-${safeName(key)}" data-key="${escapeHtml(key)}">
            ${ROKU_BUTTONS.map(
              (button) => `<option value="${button.value}" ${state.remoteMap[key] === button.value ? "selected" : ""}>${button.label}</option>`,
            ).join("")}
          </select>
        </div>
      `,
    )
    .join("");

  els.mappingGrid.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", () => {
      state.remoteMap[select.dataset.key] = select.value;
      refreshGeneratedProject();
    });
  });
}

function getKeyboardKeys(project) {
  const keys = new Set(SCRATCH_KEYS);
  for (const target of project.targets || []) {
    for (const block of Object.values(target.blocks || {})) {
      if (!block || Array.isArray(block) || block.opcode !== "event_whenkeypressed") continue;
      const key = block.fields?.KEY_OPTION?.[0];
      if (key) keys.add(String(key).toLowerCase());
    }
  }
  return keys;
}

function getManifestOverride(project) {
  const target = (project.targets || []).find(isManifestTarget);
  const note = target ? getManifestNote(target) : "";
  return note ? ensureTrailingNewline(note) : null;
}

async function getThumbnailAsset(project, sourceFiles) {
  const target = (project.targets || []).find(isThumbnailTarget);
  const costume = target?.costumes?.[target.currentCostume || 0] || target?.costumes?.[0];
  if (!costume?.md5ext || !sourceFiles.has(costume.md5ext)) return null;
  const converted = await convertAssetForRoku(costume.md5ext, sourceFiles.get(costume.md5ext), "roku-thumbnail.png");
  return converted;
}

async function convertAssetForRoku(assetName, bytes, forcedName = "") {
  if (isSvgAsset(assetName, bytes)) {
    const pngName = forcedName || `${assetName.replace(/\.[^.]+$/, "")}.png`;
    return {
      name: pngName,
      bytes: await svgBytesToPng(bytes),
    };
  }

  return {
    name: forcedName || assetName,
    bytes,
  };
}

function isSvgAsset(assetName, bytes) {
  if (assetName.toLowerCase().endsWith(".svg")) return true;
  if (!bytes) return false;
  const text = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 160))).trimStart();
  return text.startsWith("<svg") || text.startsWith("<?xml");
}

async function svgBytesToPng(bytes) {
  const svgText = new TextDecoder().decode(bytes);
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const width = Math.max(1, image.naturalWidth || 480);
    const height = Math.max(1, image.naturalHeight || 360);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const pngBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not rasterize SVG asset."))), "image/png");
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load SVG asset for PNG conversion."));
    image.src = url;
  });
}

function getMappedAssetName(assetName) {
  return state.assetNameMap.get(assetName) || assetName;
}

function upsertManifestLine(manifest, key, value) {
  const lines = ensureTrailingNewline(manifest).split(/\r?\n/).filter((line) => line.length);
  const nextLine = `${key}=${value}`;
  const index = lines.findIndex((line) => line.trim().toLowerCase().startsWith(`${key.toLowerCase()}=`));
  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    lines.push(nextLine);
  }
  return `${lines.join("\n")}\n`;
}

function getManifestNote(target) {
  const comments = Object.values(target.comments || {});
  const note = comments.map((comment) => comment?.text || "").find((text) => text.trim());
  return note ? note.trim() : "";
}

function isManifestTarget(target) {
  return String(target?.name || "").trim().toLowerCase() === "rokusmanifest";
}

function isThumbnailTarget(target) {
  return String(target?.name || "").trim().toLowerCase() === "rokuthumbnail";
}

function isHelperTarget(target) {
  return isManifestTarget(target) || isThumbnailTarget(target);
}

function renderUnsupported() {
  const issues = state.filter === "all" ? state.unsupported : state.unsupported.filter((issue) => issue.type === state.filter);
  if (!issues.length) {
    els.unsupportedList.innerHTML = `
      <div class="empty-side">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>
        <p>${state.unsupported.length ? "No items match this filter." : "No unsupported items found yet."}</p>
      </div>
    `;
    return;
  }

  els.unsupportedList.innerHTML = issues
    .map(
      (issue) => `
        <article class="issue-card">
          <strong>${escapeHtml(issue.title)}</strong>
          <p>${escapeHtml(issue.detail)}</p>
          <div class="issue-meta">
            <span class="severity-${issue.severity}">${issue.severity}</span>
            <span>${escapeHtml(issue.target)}</span>
            <span>${issue.count}x</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderCode() {
  const content = state.generated.get(state.currentFile);
  if (!content) {
    els.codeOutput.textContent = "Generated Roku source will appear here.";
    return;
  }
  els.codeOutput.textContent = typeof content === "string" ? content : `[binary asset: ${content.byteLength} bytes]`;
}

function setStatus(message, label, className = "") {
  els.projectStatus.textContent = message;
  els.qualityPill.textContent = label;
  els.qualityPill.className = `status-pill ${className}`;
}

async function unzip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error("Could not find the ZIP directory in this .sb3.");

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let centralOffset = view.getUint32(eocdOffset + 16, true);
  const files = new Map();

  for (let i = 0; i < totalEntries; i += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) break;
    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const fileNameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const fileName = new TextDecoder().decode(bytes.slice(centralOffset + 46, centralOffset + 46 + fileNameLength));

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    if (!fileName.endsWith("/")) {
      files.set(fileName, await inflateZipEntry(compressed, method));
    }
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function findEndOfCentralDirectory(bytes) {
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66000); index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) {
      return index;
    }
  }
  return -1;
}

async function inflateZipEntry(bytes, method) {
  if (method === 0) return bytes;
  if (method !== 8) throw new Error(`ZIP compression method ${method} is not supported.`);
  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot decompress .sb3 files. Try a Chromium-based browser.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [path, rawContent] of files.entries()) {
    const content = typeof rawContent === "string" ? encoder.encode(rawContent) : new Uint8Array(rawContent);
    const name = encoder.encode(path);
    const crc = crc32(content);
    const local = new ArrayBuffer(30);
    const localView = new DataView(local);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    localParts.push(local, name, content);

    const central = new ArrayBuffer(46);
    const centralView = new DataView(central);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    centralParts.push(central, name);
    offset += 30 + name.length + content.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new ArrayBuffer(22);
  const endView = new DataView(end);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.size, true);
  endView.setUint16(10, files.size, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function createSampleProject() {
  return {
    targets: [
      { isStage: true, name: "Stage", costumes: [], sounds: [], blocks: {} },
      {
        isStage: false,
        name: "Space Cat",
        x: -80,
        y: 42,
        size: 110,
        visible: true,
        currentCostume: 0,
        costumes: [{ name: "cat-a", md5ext: "space-cat.svg" }],
        sounds: [],
        variables: {},
        lists: {},
        blocks: {
          a: { opcode: "event_whenflagclicked", topLevel: true, next: "b" },
          b: { opcode: "motion_movesteps", next: "c" },
          c: { opcode: "sensing_touchingcolor", next: "d" },
          d: { opcode: "control_create_clone_of" },
          k: { opcode: "event_whenkeypressed", topLevel: true, fields: { KEY_OPTION: ["space", null] } },
        },
      },
      {
        isStage: false,
        name: "Score Badge",
        x: 120,
        y: -70,
        size: 80,
        visible: true,
        currentCostume: 0,
        costumes: [{ name: "badge", md5ext: "score-badge.svg" }],
        sounds: [],
        variables: {},
        lists: {},
        blocks: {
          e: { opcode: "event_whenflagclicked", topLevel: true, next: "f" },
          f: { opcode: "looks_show" },
        },
      },
      {
        isStage: false,
        name: "rokusmanifest",
        x: 0,
        y: 0,
        size: 100,
        visible: false,
        currentCostume: 0,
        costumes: [],
        sounds: [],
        comments: {
          manifestNote: {
            blockId: null,
            x: 0,
            y: 0,
            width: 240,
            height: 160,
            minimized: false,
            text: "title=Demo Space Cat\nmajor_version=1\nminor_version=0\nbuild_version=00001\nui_resolutions=hd",
          },
        },
        variables: {},
        lists: {},
        blocks: {},
      },
      {
        isStage: false,
        name: "rokuthumbnail",
        x: 0,
        y: 0,
        size: 100,
        visible: false,
        currentCostume: 0,
        costumes: [{ name: "thumb", md5ext: "demo-thumb.svg" }],
        sounds: [],
        variables: {},
        lists: {},
        blocks: {},
      },
    ],
  };
}

function createSampleFiles() {
  const encoder = new TextEncoder();
  return new Map([
    [
      "space-cat.svg",
      encoder.encode(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#2b7cff"/><circle cx="46" cy="50" r="10" fill="#fff"/><circle cx="82" cy="50" r="10" fill="#fff"/><path d="M42 82c16 14 34 14 50 0" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/></svg>`),
    ],
    [
      "score-badge.svg",
      encoder.encode(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="22" fill="#f59e0b"/><text x="64" y="76" text-anchor="middle" font-family="Arial" font-size="44" font-weight="700" fill="#111827">10</text></svg>`),
    ],
    [
      "demo-thumb.svg",
      encoder.encode(`<svg xmlns="http://www.w3.org/2000/svg" width="540" height="405" viewBox="0 0 540 405"><rect width="540" height="405" fill="#10131a"/><circle cx="170" cy="170" r="72" fill="#2b7cff"/><rect x="260" y="128" width="150" height="110" rx="18" fill="#00a67e"/><text x="270" y="315" font-family="Arial" font-size="44" font-weight="700" fill="#ffffff">Demo Space Cat</text></svg>`),
    ],
  ]);
}

function colorFromName(name) {
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  const colors = ["#2b7cff", "#00a67e", "#df4a7d", "#f59e0b", "#7c3aed", "#0891b2"];
  return colors[Math.abs(hash) % colors.length];
}

function safeName(name) {
  return String(name || "scratch-roku-project").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
}

function escapeBright(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\"\"");
}

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}
