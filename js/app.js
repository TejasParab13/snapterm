/* ============================================================
   SnapTerm — Dark Edition
   Canvas renderer + UI logic
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     DEFAULTS
     ============================================================ */
  var DEFAULT_PROMPT = 'PS D:\\TEJ\\Study\\.INFORMATION TECHNOLOGY\\sem 3\\CODE\\FDS tejas\\exp 4> cd "d:\\TEJ\\Study\\.INFORMATION TECHNOLOGY\\sem 3\\CODE\\FDS tejas\\exp 4" ; if ($?) { g++ exp4_a.cpp -o exp4_a } ; if ($?) { .\\exp4_a }';

  var DEFAULT_OUTPUT = [
    "===== MENU =====",
    "[1] Insert at Start",
    "[2] Insert at End",
    "[3] Insert at Position",
    "[4] Delete at Start",
    "[5] Delete at End",
    "[6] Delete at Position",
    "[7] Display",
    "[8] Exit",
    "Enter your choice: "
  ].join("\n");

  /* ============================================================
     CANVAS GEOMETRY
     ============================================================ */
  var JPG_QUALITY = 0.95;
  var HEADER_H    = 35;
  var GUTTER      = 22;
  var PAD_L       = 6;
  var PAD_R       = 12;
  var PAD_T       = 4;
  var PAD_B       = 8;

  var MONO    = '"Cascadia Mono", "Cascadia Code", Consolas, "Courier New", monospace';
  var UI_FONT = '13px "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

  var C_PANEL  = "#181818";
  var C_BORDER = "#2b2b2b";
  var C_TAB    = "#9d9d9d";
  var C_TAB_ON = "#e7e7e7";
  var C_TAB_BG = "#2b2b2b";
  var C_TEXT   = "#cccccc";
  var C_ICON   = "#c8c8c8";
  var C_DOT    = "#8a8a8a";

  var MOBILE_BP = 1023;

  /* ============================================================
     ELEMENTS
     ============================================================ */
  function $(id) { return document.getElementById(id); }
  function isMobile() { return window.matchMedia("(max-width: " + MOBILE_BP + "px)").matches; }

  var els = {
    tabs:       $("tabs"),
    dots:       $("dots"),
    colEditor:  $("colEditor"),
    colPreview: $("colPreview"),

    /* Left column */
    outputFull:  $("outputFull"),
    promptInput: $("promptInput"),

    /* Right column views */
    outputFullRight:  $("outputFullRight"),
    promptInputRight: $("promptInputRight"),

    fontSize:    $("fontSize"),
    panelWidth:  $("panelWidth"),
    bottomSpace: $("bottomSpace"),
    cropRight:   $("cropRight"),
    cursor:      $("cursor"),

    fsVal: $("fsVal"),
    pwVal: $("pwVal"),
    bsVal: $("bsVal"),
    crVal: $("crVal"),

    dimInfo:  $("dimInfo"),
    lineInfo: $("lineInfo"),
    cropInfo: $("cropInfo"),

    presets:  $("presets"),
    dl:       $("dl"),
    copyBtn:  $("copyBtn"),
    resetBtn: $("resetBtn"),

    canvasWrap:   $("canvasWrap"),
    canvasScroll: document.querySelector(".preview-scroll"),
    cropOverlay:  $("cropOverlay"),
    cropLine:     $("cropLine"),

    toast: $("toast")
  };

  var canvas = $("termCanvas");
  var ctx    = canvas.getContext("2d");
  var meas   = document.createElement("canvas").getContext("2d");

  var views       = document.querySelectorAll(".view");
  var currentView = "preview";

  /* ============================================================
     VIEW SWITCHING (right column)
     ============================================================ */
  function applyLayout() {
    /* Nav underline */
    var navBtns = els.tabs.querySelectorAll(".nav-item");
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].classList.toggle("active", navBtns[i].dataset.view === currentView);
    }

    /* Indicator dots sync with active tab */
    if (els.dots) {
      var dots = els.dots.querySelectorAll("span");
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle("active", dots[d].dataset.view === currentView);
      }
    }

    /* Right-column views */
    for (var j = 0; j < views.length; j++) {
      views[j].classList.toggle("active", views[j].dataset.view === currentView);
    }

    /* Recompute canvas sizing + crop marker once the preview view is visible */
    updateCanvasDisplay(+els.panelWidth.value, +els.cropRight.value);
    requestAnimationFrame(function () {
      updateCropOverlay(+els.cropRight.value);
    });
  }

  function switchView(name) {
    if (currentView === name) return;
    currentView = name;
    applyLayout();
  }

  window.addEventListener("resize", function () {
    updateCanvasDisplay(+els.panelWidth.value, +els.cropRight.value);
    updateCropOverlay(+els.cropRight.value);
  });

  /* ============================================================
     TOAST
     ============================================================ */
  var toastTimer = null;
  function showToast(msg, kind) {
    els.toast.textContent = msg;
    els.toast.className = "toast show" + (kind ? " " + kind : "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.className = "toast" + (kind ? " " + kind : "");
    }, 1800);
  }

  /* ============================================================
     TEXT WRAPPING
     ============================================================ */
  function wrapChars(text, maxChars) {
    var out = [];
    var paras = String(text)
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "    ")
      .split("\n");

    for (var p = 0; p < paras.length; p++) {
      var para = paras[p];
      if (para.length === 0) { out.push(""); continue; }
      for (var i = 0; i < para.length; i += maxChars) {
        out.push(para.slice(i, i + maxChars));
      }
    }
    return out.length ? out : [""];
  }

  /* ============================================================
     DRAWING HELPERS
     ============================================================ */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawPlus(cx, cy) {
    var r = 5.5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();
  }

  function drawChevron(cx, cy, dir) {
    var w = 4.5, h = 2.5;
    var d = dir === "down" ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy - h * d);
    ctx.lineTo(cx, cy + h * d);
    ctx.lineTo(cx + w, cy - h * d);
    ctx.stroke();
  }

  function drawClose(cx, cy) {
    var r = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
    ctx.stroke();
  }

  function drawHeader(W) {
    ctx.font = UI_FONT;
    ctx.textBaseline = "middle";

    var tabs = [["Problems", false], ["Debug Console", false], ["Terminal", true]];
    var x = 0;
    for (var i = 0; i < tabs.length; i++) {
      var label  = tabs[i][0];
      var active = tabs[i][1];
      var tw = ctx.measureText(label).width + 22;

      if (active) {
        ctx.fillStyle = C_TAB_BG;
        roundRect(x + 3, 5, tw - 6, HEADER_H - 10, 5);
        ctx.fill();
      }
      ctx.fillStyle = active ? C_TAB_ON : C_TAB;
      ctx.fillText(label, x + 11, HEADER_H / 2 + 1);
      x += tw;
    }

    var iy = Math.round(HEADER_H / 2);
    ctx.strokeStyle = C_ICON;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    var cx = W - 16;
    drawClose(cx, iy);           cx -= 28;
    drawChevron(cx, iy, "up");   cx -= 28;
    drawChevron(cx, iy, "down"); cx -= 28;
    drawPlus(cx, iy);
  }

  /* ============================================================
     RESET BUTTON STATE
     ============================================================ */
  function refreshResetButtons() {
    var resets = document.querySelectorAll(".rst");
    for (var i = 0; i < resets.length; i++) {
      var btn = resets[i];
      var current = +els[btn.dataset.target].value;
      btn.disabled = (current === +btn.dataset.default);
    }
  }

  /* ============================================================
     CANVAS DISPLAY MODE
     ============================================================ */
  var CROP_PEEK_FRAC = 0.08;
  var CROP_PEEK_MIN  = 22;
  var CROP_PEEK_MAX  = 0.22;

  function updateCanvasDisplay(panelW, cropPct) {
    var previewView = document.querySelector('.view[data-view="preview"]');
    if (previewView && !previewView.classList.contains("active")) return;

    if (isMobile() && cropPct > 0) {
      els.canvasWrap.classList.add("cropping");

      var avail = els.canvasWrap.clientWidth || els.canvasScroll.clientWidth;
      var peek = Math.round(avail * CROP_PEEK_FRAC);
      if (peek < CROP_PEEK_MIN) peek = CROP_PEEK_MIN;
      if (peek > avail * CROP_PEEK_MAX) peek = Math.round(avail * CROP_PEEK_MAX);

      var visibleFrac = 1 - cropPct / 100;
      var w = Math.max((avail - peek) / visibleFrac, avail);

      canvas.style.width = Math.round(w) + "px";
      canvas.style.maxWidth = "none";
    } else {
      els.canvasWrap.classList.remove("cropping");
      canvas.style.width = panelW + "px";
      canvas.style.maxWidth = "";
    }
  }

  /* ============================================================
     CROP MARKER
     ============================================================ */
  function updateCropOverlay(cropPct) {
    var previewView = document.querySelector('.view[data-view="preview"]');
    if (previewView && !previewView.classList.contains("active")) return;

    if (cropPct <= 0) {
      els.cropOverlay.style.display = "none";
      els.cropLine.style.display = "none";
      return;
    }

    var wrapRect   = els.canvasWrap.getBoundingClientRect();
    var canvasRect = canvas.getBoundingClientRect();

    if (!wrapRect.width || !canvasRect.width) {
      els.cropOverlay.style.display = "none";
      els.cropLine.style.display = "none";
      return;
    }

    var visibleFrac = 1 - cropPct / 100;
    var boundary = (canvasRect.left - wrapRect.left) + canvasRect.width * visibleFrac;
    var fromRight = wrapRect.width - boundary;
    if (fromRight < 0) fromRight = 0;
    if (fromRight > wrapRect.width) fromRight = wrapRect.width;

    els.cropOverlay.style.display = "block";
    els.cropOverlay.style.width = fromRight + "px";
    els.cropLine.style.display = "block";
    els.cropLine.style.right = fromRight + "px";
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function render() {
    try {
      var fontSize    = +els.fontSize.value;
      var panelW      = +els.panelWidth.value;
      var bottomSpace = +els.bottomSpace.value;
      var cropPct     = +els.cropRight.value;
      var showCursor  = els.cursor.checked;
      var prompt      = els.promptInput.value;
      var output      = els.outputFull.value;

      els.fsVal.textContent = fontSize + "px";
      els.pwVal.textContent = panelW + "px";
      els.bsVal.textContent = bottomSpace + "px";
      els.crVal.textContent = cropPct + "%";
      els.cropInfo.textContent = cropPct + "%";

      var lineH    = Math.round(fontSize * 1.33);
      var bodyFont = fontSize + "px " + MONO;

      meas.font = bodyFont;
      var charW = meas.measureText("M").width || (fontSize * 0.6);
      var textLeft  = PAD_L + GUTTER;
      var maxChars  = Math.max(10, Math.floor((panelW - textLeft - PAD_R) / charW));

      var raw   = prompt.length ? (prompt + "\n" + output) : output;
      var lines = wrapChars(raw, maxChars);

      var cursorLine = lines.length - 1;
      var cursorCol  = (lines[cursorLine] || "").length;
      if (cursorCol >= maxChars) { cursorLine++; cursorCol = 0; }

      var bodyLines = Math.max(lines.length, showCursor ? cursorLine + 1 : 0);
      var H = HEADER_H + PAD_T + bodyLines * lineH + PAD_B + bottomSpace;
      if (H < 160) H = 160;

      var S = 2;
      if (panelW * S * H * S > 2.0e8) S = 1;

      canvas.width  = Math.round(panelW * S);
      canvas.height = Math.round(H * S);

      ctx.setTransform(S, 0, 0, S, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.textRendering = "geometricPrecision";

      ctx.fillStyle = C_PANEL;
      ctx.fillRect(0, 0, panelW, H);
      ctx.fillStyle = C_BORDER;
      ctx.fillRect(0, 0, panelW, 1);

      drawHeader(panelW);

      var startY = HEADER_H + PAD_T;

      if (prompt.length > 0 && lines.length > 0) {
        var dotCx = PAD_L + GUTTER / 2 - 2;
        var dotCy = startY + lineH / 2 - 1;
        ctx.beginPath();
        ctx.arc(dotCx, dotCy, 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = C_DOT;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.font = bodyFont;
      ctx.textBaseline = "middle";
      ctx.fillStyle = C_TEXT;

      for (var i = 0; i < lines.length; i++) {
        if (lines[i]) {
          ctx.fillText(lines[i], textLeft, startY + i * lineH + lineH / 2);
        }
      }

      if (showCursor) {
        var cy = startY + cursorLine * lineH;
        var ch = Math.round(fontSize * 1.15);
        ctx.fillStyle = C_TEXT;
        ctx.fillRect(textLeft + cursorCol * charW, cy + (lineH - ch) / 2, charW, ch);
      }

      /* Info pills */
      var visibleW = Math.round(panelW * (1 - cropPct / 100));
      els.dimInfo.textContent  = visibleW + " × " + H + " px";
      els.lineInfo.textContent = lines.length;

      updateCanvasDisplay(panelW, cropPct);
      refreshResetButtons();

      requestAnimationFrame(function () { updateCropOverlay(cropPct); });

      /* Preset highlight */
      var presetBtns = els.presets.querySelectorAll(".preset");
      for (var k = 0; k < presetBtns.length; k++) {
        var pw = +presetBtns[k].dataset.w;
        presetBtns[k].classList.toggle("active", pw === panelW);
      }
    } catch (err) {
      console.error("Render error:", err);
    }
  }

  /* ============================================================
     EXPORT
     ============================================================ */
  function buildExportCanvas() {
    var cropPct = +els.cropRight.value;
    var visibleFrac = 1 - cropPct / 100;
    var srcW = canvas.width;
    var srcH = canvas.height;
    var outW = Math.max(1, Math.round(srcW * visibleFrac));

    var tmp = document.createElement("canvas");
    tmp.width  = outW;
    tmp.height = srcH;

    var tctx = tmp.getContext("2d");
    tctx.fillStyle = "#181818";
    tctx.fillRect(0, 0, outW, srcH);
    tctx.drawImage(canvas, 0, 0, outW, srcH, 0, 0, outW, srcH);
    return tmp;
  }

  function download() {
    try {
      var tmp = buildExportCanvas();
      var dataUrl = tmp.toDataURL("image/jpeg", JPG_QUALITY);
      var a = document.createElement("a");
      a.href = dataUrl;
      a.download = "snapterm.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Saved · snapterm.jpg", "success");
    } catch (err) {
      console.error(err);
      showToast("Download failed", "error");
    }
  }

  function copyImage() {
    if (!navigator.clipboard || !window.ClipboardItem) {
      showToast("Clipboard unsupported", "error");
      return;
    }
    var tmp = buildExportCanvas();
    tmp.toBlob(function (blob) {
      navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        .then(function () { showToast("Copied", "success"); })
        .catch(function () { showToast("Copy failed", "error"); });
    }, "image/png");
  }

  function reset() {
    els.promptInput.value  = DEFAULT_PROMPT;
    els.outputFull.value   = DEFAULT_OUTPUT;
    els.fontSize.value     = 14;
    els.panelWidth.value   = 1500;
    els.bottomSpace.value  = 0;
    els.cropRight.value    = 0;
    els.cursor.checked     = true;
    syncLeftToRight();
    render();
    showToast("Settings reset");
  }

  /* ============================================================
     INPUT MIRROR  (left ↔ right views)
     ============================================================ */
  function syncLeftToRight() {
    if (els.outputFullRight)  els.outputFullRight.value  = els.outputFull.value;
    if (els.promptInputRight) els.promptInputRight.value = els.promptInput.value;
  }

  /* ============================================================
     BIND
     ============================================================ */
  function bind() {
    /* Nav — switch right-column view */
    els.tabs.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".nav-item");
      if (!btn) return;
      if (btn.dataset.view) switchView(btn.dataset.view);
    });

    /* Left column inputs — drive render + mirror to right */
    els.outputFull.addEventListener("input", function () {
      if (els.outputFullRight) els.outputFullRight.value = els.outputFull.value;
      render();
    });
    els.promptInput.addEventListener("input", function () {
      if (els.promptInputRight) els.promptInputRight.value = els.promptInput.value;
      render();
    });

    /* Right column inputs — mirror back to left + render */
    if (els.outputFullRight) {
      els.outputFullRight.addEventListener("input", function () {
        els.outputFull.value = els.outputFullRight.value;
        render();
      });
    }
    if (els.promptInputRight) {
      els.promptInputRight.addEventListener("input", function () {
        els.promptInput.value = els.promptInputRight.value;
        render();
      });
    }

    var inputs = [els.fontSize, els.panelWidth, els.bottomSpace, els.cropRight, els.cursor];
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener("input", render);
      inputs[i].addEventListener("change", render);
    }

    els.presets.addEventListener("click", function (ev) {
      var target = ev.target.closest(".preset");
      if (!target) return;
      els.panelWidth.value = target.dataset.w;
      render();
    });

    document.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".rst");
      if (!btn || btn.disabled) return;
      els[btn.dataset.target].value = btn.dataset.default;
      render();
    });

    els.dl.addEventListener("click", download);
    els.copyBtn.addEventListener("click", copyImage);
    els.resetBtn.addEventListener("click", reset);

    document.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        download();
      }
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    els.promptInput.value = DEFAULT_PROMPT;
    els.outputFull.value  = DEFAULT_OUTPUT;
    syncLeftToRight();

    bind();
    applyLayout();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();