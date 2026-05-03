// ==UserScript==
// @name         E-MASTER Auto-Fill Aktivitas Harian
// @namespace    https://github.com/kangsotox991/emasterjs
// @version      1.0.0
// @description  Skrip auto-fill form Aktivitas Harian SKP di Si-MASTER BKD Jatim dengan GUI panel. Login manual, skrip hanya mengisi data form.
// @author       kangsotox991
// @match        https://master.bkd.jatimprov.go.id/*
// @match        https://wbs.jatimprov.go.id/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  //  KONFIGURASI DEFAULT
  //  Field form sesuai halaman "Edit Akfitas" E-MASTER:
  //    - Tanggal Aktivitas  (format dd/mm/yyyy)
  //    - Detail Aktifitas   (textarea)
  //    - Satuan             (input text)
  //    - WPT                (input number, menit)
  //    - Volume             (input number)
  //    - Objek Kerja / Topik (textarea)
  // ============================================================
  const DEFAULT_CONFIG = {
    templates: [
      {
        label: 'Administrasi Surat',
        detail: 'Menerima, mencatat, dan mendistribusikan surat masuk serta menyiapkan surat keluar',
        satuan: 'Dokumen',
        wpt: 120,
        volume: 5,
        objekKerja: 'Surat masuk dan surat keluar',
      },
      {
        label: 'Menyusun Laporan',
        detail: 'Menyusun laporan harian/mingguan/bulanan sesuai tupoksi',
        satuan: 'Laporan',
        wpt: 90,
        volume: 1,
        objekKerja: 'Laporan kegiatan berkala',
      },
      {
        label: 'Rapat Koordinasi',
        detail: 'Menghadiri rapat koordinasi internal dengan rekan kerja dan pimpinan',
        satuan: 'Kegiatan',
        wpt: 60,
        volume: 1,
        objekKerja: 'Rapat internal',
      },
      {
        label: 'Pelayanan Publik',
        detail: 'Memberikan pelayanan informasi dan administrasi kepada tamu dan masyarakat',
        satuan: 'Orang',
        wpt: 60,
        volume: 3,
        objekKerja: 'Pelayanan tamu / masyarakat',
      },
      {
        label: 'Pengelolaan Data',
        detail: 'Menginput, memperbarui, dan mengarsipkan data kepegawaian',
        satuan: 'Data',
        wpt: 90,
        volume: 10,
        objekKerja: 'Data kepegawaian',
      },
      {
        label: 'Tindakan Keperawatan',
        detail: 'Melaksanakan tindakan keperawatan tepat waktu sesuai standar prosedur operasional',
        satuan: 'Pasien',
        wpt: 120,
        volume: 5,
        objekKerja: 'Pasien rawat inap / rawat jalan',
      },
    ],
    delayMs: 300,
    targetHarianMenit: 330,
    targetMaksimalMenit: 660,
  };

  // ============================================================
  //  STORAGE
  // ============================================================
  function loadConfig() {
    try {
      const saved = GM_getValue('emasterConfig2', null);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('[EM-AutoFill] load error', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function saveConfig(cfg) {
    try {
      GM_setValue('emasterConfig2', JSON.stringify(cfg));
    } catch (e) {
      console.warn('[EM-AutoFill] save error', e);
    }
  }

  let config = loadConfig();

  // ============================================================
  //  DOM HELPERS
  // ============================================================
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  function setVal(el, v) {
    if (!el) return false;
    const setter =
      Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value'
      )?.set;
    if (setter) setter.call(el, v);
    else el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ============================================================
  //  FORM FIELD DETECTION
  //  Mencari field berdasarkan label teks di halaman form
  // ============================================================
  function findFieldByLabel(labelText) {
    // Strategi 1: cari semua teks yang mengandung labelText
    const allLabels = $$('td, th, label, span, div, b, strong');
    for (const lbl of allLabels) {
      if (
        lbl.childElementCount <= 1 &&
        lbl.textContent.trim().toLowerCase().includes(labelText.toLowerCase())
      ) {
        // Cari input/textarea/select terdekat
        // Cek sibling berikutnya
        let next = lbl.nextElementSibling;
        while (next) {
          const field = next.querySelector('input, textarea, select') || (next.matches('input, textarea, select') ? next : null);
          if (field) return field;
          next = next.nextElementSibling;
        }
        // Cek parent row
        const row = lbl.closest('tr');
        if (row) {
          const field = row.querySelector('input, textarea, select');
          if (field) return field;
        }
        // Cek parent container
        const parent = lbl.parentElement;
        if (parent) {
          const field = parent.querySelector('input, textarea, select');
          if (field) return field;
        }
      }
    }
    return null;
  }

  function detectFields() {
    return {
      kegiatan: findFieldByLabel('Kegiatan Tugas Jabatan'),
      tanggal: findFieldByLabel('Tanggal Aktivitas'),
      detail: findFieldByLabel('Detail Aktifitas') || findFieldByLabel('Detail Aktivitas'),
      satuan: findFieldByLabel('Satuan'),
      wpt: findFieldByLabel('WPT'),
      volume: findFieldByLabel('Volume'),
      objekKerja: findFieldByLabel('Objek Kerja') || findFieldByLabel('Topik'),
      saveBtn: $$('input[type="submit"], input[type="button"], button').find(
        (b) => b.value?.toLowerCase() === 'save' || b.textContent?.trim().toLowerCase() === 'save'
      ),
      cancelBtn: $$('input[type="submit"], input[type="button"], button').find(
        (b) => b.value?.toLowerCase() === 'cancel' || b.textContent?.trim().toLowerCase() === 'cancel'
      ),
    };
  }

  // ============================================================
  //  AUTO-FILL
  // ============================================================
  async function fillForm(tpl, autoSave) {
    const f = detectFields();
    const log = [];

    // Tanggal — isi dengan hari ini jika kosong
    if (f.tanggal) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const current = f.tanggal.value.replace(/[^0-9]/g, '');
      if (!current || current === '00000000') {
        setVal(f.tanggal, `${dd}/${mm}/${yyyy}`);
        log.push(`Tanggal: ${dd}/${mm}/${yyyy}`);
      } else {
        log.push(`Tanggal: sudah terisi`);
      }
      await wait(config.delayMs);
    }

    if (f.detail) {
      setVal(f.detail, tpl.detail);
      log.push(`Detail: ${tpl.detail.substring(0, 40)}...`);
      await wait(config.delayMs);
    }

    if (f.satuan) {
      setVal(f.satuan, tpl.satuan);
      log.push(`Satuan: ${tpl.satuan}`);
      await wait(config.delayMs);
    }

    if (f.wpt) {
      setVal(f.wpt, String(tpl.wpt));
      log.push(`WPT: ${tpl.wpt} menit`);
      await wait(config.delayMs);
    }

    if (f.volume) {
      setVal(f.volume, String(tpl.volume));
      log.push(`Volume: ${tpl.volume}`);
      await wait(config.delayMs);
    }

    if (f.objekKerja) {
      setVal(f.objekKerja, tpl.objekKerja);
      log.push(`Objek Kerja: ${tpl.objekKerja}`);
      await wait(config.delayMs);
    }

    if (autoSave && f.saveBtn) {
      f.saveBtn.click();
      log.push('Tombol Save diklik!');
    }

    return log;
  }

  // ============================================================
  //  GUI — STYLES
  // ============================================================
  GM_addStyle(`
    #em-panel{position:fixed;top:16px;right:16px;width:370px;max-height:85vh;background:#fff;border:2px solid #1565c0;border-radius:10px;box-shadow:0 6px 28px rgba(0,0,0,.18);z-index:2147483647;font:13px/1.45 "Segoe UI",Tahoma,sans-serif;color:#333;display:flex;flex-direction:column}
    #em-hdr{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:linear-gradient(135deg,#1565c0,#0d47a1);color:#fff;border-radius:8px 8px 0 0;cursor:move;user-select:none}
    #em-hdr span{font-weight:700;font-size:13px}
    #em-hdr button{background:rgba(255,255,255,.2);border:none;color:#fff;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:700;margin-left:4px}
    #em-hdr button:hover{background:rgba(255,255,255,.35)}
    #em-body{padding:10px 12px;overflow-y:auto;flex:1}
    .em-tabs{display:flex;gap:3px;margin-bottom:10px}
    .em-tab{flex:1;padding:6px 4px;border:1px solid #ccc;border-radius:5px 5px 0 0;background:#f5f5f5;cursor:pointer;font-size:11px;font-weight:600;color:#666;text-align:center}
    .em-tab.on{background:#1565c0;color:#fff;border-color:#1565c0}
    .em-pane{display:none}.em-pane.on{display:block}
    .em-lbl{display:block;font-weight:600;margin:8px 0 4px;font-size:11px;color:#555}
    .em-inp{width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:12px;box-sizing:border-box;margin-bottom:4px}
    .em-inp:focus{border-color:#1565c0;outline:none;box-shadow:0 0 0 2px rgba(21,101,192,.15)}
    .em-row{display:flex;gap:6px}
    .em-row .em-inp{width:100%}
    .em-btn{padding:7px 12px;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;color:#fff;transition:opacity .2s}
    .em-btn:hover{opacity:.85}
    .em-pri{background:#1565c0}.em-suc{background:#2e7d32}.em-dan{background:#c62828}.em-warn{background:#e65100}
    .em-btngrp{display:flex;gap:6px;margin-top:8px}
    .em-card{border:1px solid #e0e0e0;border-radius:6px;padding:8px;margin-bottom:6px;background:#fafafa;cursor:pointer;transition:background .15s}
    .em-card:hover{background:#e3f2fd}
    .em-card.on{background:#e3f2fd;border-color:#1565c0}
    .em-card-t{font-weight:600;font-size:12px;color:#333}
    .em-card-d{font-size:10px;color:#888;margin-top:2px}
    .em-badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:#e3f2fd;color:#1565c0;margin-top:3px;margin-right:3px}
    .em-bar-wrap{width:100%;height:7px;background:#e0e0e0;border-radius:4px;overflow:hidden;margin:4px 0}
    .em-bar-fill{height:100%;border-radius:4px;transition:width .3s}
    .em-msg{margin-top:8px;padding:7px;border-radius:5px;font-size:11px;line-height:1.35;white-space:pre-line;display:none}
    .em-msg.i{display:block;background:#e3f2fd;color:#1565c0;border:1px solid #90caf9}
    .em-msg.s{display:block;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
    .em-msg.e{display:block;background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
    .em-msg.w{display:block;background:#fff3e0;color:#e65100;border:1px solid #ffcc80}
    .em-det{padding:3px 6px;margin-bottom:3px;border-radius:3px;font-size:11px;font-family:monospace}
    .em-det.ok{background:#e8f5e9;color:#2e7d32}.em-det.no{background:#ffebee;color:#c62828}
    .em-del{background:none;border:none;color:#c62828;cursor:pointer;font-size:16px;padding:0 4px}
    .em-mini{padding:0}
    .em-mini button{width:100%;padding:8px 12px;background:linear-gradient(135deg,#1565c0,#0d47a1);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700}
  `);

  // ============================================================
  //  GUI — BUILD
  // ============================================================
  function buildPanel() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div id="em-panel">
      <div id="em-hdr">
        <span>E-MASTER AutoFill</span>
        <div><button id="em-min" title="Minimize">_</button><button id="em-cls" title="Tutup">X</button></div>
      </div>
      <div id="em-body">
        <div class="em-tabs">
          <div class="em-tab on" data-t="fill">Isi Form</div>
          <div class="em-tab" data-t="cfg">Konfigurasi</div>
          <div class="em-tab" data-t="det">Deteksi</div>
        </div>

        <!-- FILL -->
        <div class="em-pane on" id="em-p-fill">
          <label class="em-lbl">Pilih template aktivitas:</label>
          <div id="em-tpl-list"></div>
          <label class="em-lbl">Tanggal Aktivitas (kosong = hari ini):</label>
          <input id="em-tanggal" class="em-inp" placeholder="dd/mm/yyyy" />
          <label class="em-lbl">Total WPT terpilih: <b id="em-wpt-total">0</b> menit</label>
          <div class="em-bar-wrap"><div id="em-bar" class="em-bar-fill" style="width:0%;background:#e65100"></div></div>
          <small style="font-size:10px;color:#888">Target: ${config.targetHarianMenit}-${config.targetMaksimalMenit} mnt/hari</small>
          <div class="em-btngrp">
            <button class="em-btn em-pri" id="em-go">Isi Form</button>
            <button class="em-btn em-suc" id="em-go-save">Isi & Save</button>
          </div>
          <div id="em-status" class="em-msg"></div>
        </div>

        <!-- CONFIG -->
        <div class="em-pane" id="em-p-cfg">
          <label class="em-lbl">Tambah Template:</label>
          <input id="em-c-label" class="em-inp" placeholder="Nama / Label" />
          <textarea id="em-c-detail" class="em-inp" rows="2" placeholder="Detail Aktifitas"></textarea>
          <div class="em-row">
            <input id="em-c-satuan" class="em-inp" placeholder="Satuan" />
            <input id="em-c-wpt" class="em-inp" type="number" placeholder="WPT (menit)" value="60" min="1" />
          </div>
          <div class="em-row">
            <input id="em-c-vol" class="em-inp" type="number" placeholder="Volume" value="1" min="1" />
            <input id="em-c-delay" class="em-inp" type="number" placeholder="Delay (ms)" value="${config.delayMs}" min="100" />
          </div>
          <textarea id="em-c-objek" class="em-inp" rows="2" placeholder="Objek Kerja / Topik"></textarea>
          <button class="em-btn em-pri" id="em-c-add">Tambah</button>

          <label class="em-lbl" style="margin-top:12px">Template Tersimpan:</label>
          <div id="em-c-list"></div>
          <div class="em-btngrp">
            <button class="em-btn em-pri" id="em-c-save">Simpan Konfigurasi</button>
            <button class="em-btn em-dan" id="em-c-reset">Reset Default</button>
          </div>
        </div>

        <!-- DETECT -->
        <div class="em-pane" id="em-p-det">
          <label class="em-lbl">Field form yang terdeteksi di halaman ini:</label>
          <div id="em-det-list"></div>
          <button class="em-btn em-pri" id="em-det-btn" style="margin-top:6px">Deteksi Ulang</button>
        </div>
      </div>
      <div id="em-panel-mini" class="em-mini" style="display:none">
        <button id="em-restore">E-MASTER AutoFill</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    bindEvents();
    renderTemplates();
    renderSavedList();
    makeDraggable();
  }

  // ============================================================
  //  EVENTS
  // ============================================================
  function bindEvents() {
    // Tabs
    $$('.em-tab').forEach((t) =>
      t.addEventListener('click', () => {
        $$('.em-tab').forEach((x) => x.classList.remove('on'));
        $$('.em-pane').forEach((x) => x.classList.remove('on'));
        t.classList.add('on');
        $(`#em-p-${t.dataset.t}`).classList.add('on');
      })
    );

    // Minimize / restore / close
    $('#em-min').onclick = () => {
      $('#em-body').style.display = 'none';
      $('#em-hdr').style.display = 'none';
      $('#em-panel-mini').style.display = 'block';
    };
    $('#em-restore').onclick = () => {
      $('#em-body').style.display = '';
      $('#em-hdr').style.display = 'flex';
      $('#em-panel-mini').style.display = 'none';
    };
    $('#em-cls').onclick = () => ($('#em-panel').style.display = 'none');

    // Fill
    $('#em-go').onclick = () => doFill(false);
    $('#em-go-save').onclick = () => doFill(true);

    // Config — add
    $('#em-c-add').onclick = addTemplate;
    $('#em-c-save').onclick = () => {
      config.delayMs = parseInt($('#em-c-delay').value) || 300;
      saveConfig(config);
      msg('Konfigurasi disimpan!', 's');
    };
    $('#em-c-reset').onclick = () => {
      if (!confirm('Reset semua template ke default?')) return;
      config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      saveConfig(config);
      renderTemplates();
      renderSavedList();
      msg('Reset ke default.', 'i');
    };

    // Detect
    $('#em-det-btn').onclick = renderDetected;
  }

  // ============================================================
  //  FILL LOGIC
  // ============================================================
  async function doFill(autoSave) {
    const sel = getSelected();
    if (!sel) {
      msg('Pilih satu template dulu!', 'w');
      return;
    }

    // Override tanggal jika diisi manual
    const tglInput = $('#em-tanggal').value.trim();
    const tpl = { ...sel };

    msg('Mengisi form...', 'i');
    const f = detectFields();

    const log = [];

    // Tanggal
    if (f.tanggal) {
      let tgl = tglInput;
      if (!tgl) {
        const now = new Date();
        tgl = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      }
      const cur = f.tanggal.value.replace(/[^0-9]/g, '');
      if (!cur || cur === '00000000') {
        setVal(f.tanggal, tgl);
        log.push(`Tanggal: ${tgl}`);
      } else {
        log.push(`Tanggal: sudah terisi (${f.tanggal.value})`);
      }
      await wait(config.delayMs);
    }

    if (f.detail) { setVal(f.detail, tpl.detail); log.push(`Detail: ${tpl.detail.substring(0, 50)}...`); await wait(config.delayMs); }
    if (f.satuan) { setVal(f.satuan, tpl.satuan); log.push(`Satuan: ${tpl.satuan}`); await wait(config.delayMs); }
    if (f.wpt) { setVal(f.wpt, String(tpl.wpt)); log.push(`WPT: ${tpl.wpt} menit`); await wait(config.delayMs); }
    if (f.volume) { setVal(f.volume, String(tpl.volume)); log.push(`Volume: ${tpl.volume}`); await wait(config.delayMs); }
    if (f.objekKerja) { setVal(f.objekKerja, tpl.objekKerja); log.push(`Objek Kerja: ${tpl.objekKerja}`); await wait(config.delayMs); }

    if (log.length === 0) {
      msg('Tidak ada field yang terdeteksi!\nPastikan Anda di halaman form Aktivitas Harian.', 'e');
      return;
    }

    if (autoSave && f.saveBtn) {
      f.saveBtn.click();
      log.push('Tombol Save diklik!');
    } else if (autoSave) {
      log.push('Tombol Save tidak ditemukan — klik manual.');
    }

    msg(log.join('\n'), 's');
  }

  // ============================================================
  //  RENDER
  // ============================================================
  function renderTemplates() {
    const box = $('#em-tpl-list');
    if (!box) return;
    box.innerHTML = config.templates
      .map(
        (t, i) => `
      <div class="em-card" data-i="${i}">
        <div class="em-card-t">${esc(t.label)}</div>
        <div class="em-card-d">${esc(t.detail)}</div>
        <span class="em-badge">${t.wpt} mnt</span>
        <span class="em-badge">Vol ${t.volume}</span>
        <span class="em-badge">${esc(t.satuan)}</span>
      </div>`
      )
      .join('');

    $$('.em-card', box).forEach((c) =>
      c.addEventListener('click', () => {
        $$('.em-card', box).forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        updateBar();
      })
    );
  }

  function renderSavedList() {
    const box = $('#em-c-list');
    if (!box) return;
    box.innerHTML = config.templates
      .map(
        (t, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:3px;font-size:11px">
        <span>${esc(t.label)} (${t.wpt}m, vol ${t.volume})</span>
        <button class="em-del" data-i="${i}" title="Hapus">&times;</button>
      </div>`
      )
      .join('');

    $$('.em-del', box).forEach((b) =>
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.i);
        if (confirm(`Hapus "${config.templates[i].label}"?`)) {
          config.templates.splice(i, 1);
          saveConfig(config);
          renderTemplates();
          renderSavedList();
        }
      })
    );
  }

  function renderDetected() {
    const f = detectFields();
    const map = {
      kegiatan: 'Kegiatan Tugas Jabatan',
      tanggal: 'Tanggal Aktivitas',
      detail: 'Detail Aktifitas',
      satuan: 'Satuan',
      wpt: 'WPT',
      volume: 'Volume',
      objekKerja: 'Objek Kerja / Topik',
      saveBtn: 'Tombol Save',
      cancelBtn: 'Tombol Cancel',
    };
    const box = $('#em-det-list');
    box.innerHTML = Object.entries(map)
      .map(([k, label]) => {
        const el = f[k];
        const ok = !!el;
        const tag = el ? `<${el.tagName.toLowerCase()} ${el.name ? 'name="' + el.name + '"' : ''} ${el.id ? 'id="' + el.id + '"' : ''}>` : 'Tidak ditemukan';
        return `<div class="em-det ${ok ? 'ok' : 'no'}">${label}: ${esc(tag)}</div>`;
      })
      .join('');
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function getSelected() {
    const card = $('.em-card.on');
    if (!card) return null;
    return config.templates[parseInt(card.dataset.i)] || null;
  }

  function updateBar() {
    const sel = getSelected();
    const total = sel ? sel.wpt : 0;
    $('#em-wpt-total').textContent = total;
    const pct = Math.min((total / config.targetHarianMenit) * 100, 100);
    const bar = $('#em-bar');
    bar.style.width = pct + '%';
    bar.style.background = total < config.targetHarianMenit ? '#e65100' : total <= config.targetMaksimalMenit ? '#2e7d32' : '#c62828';
  }

  function addTemplate() {
    const label = $('#em-c-label').value.trim();
    const detail = $('#em-c-detail').value.trim();
    const satuan = $('#em-c-satuan').value.trim() || 'Kegiatan';
    const wpt = parseInt($('#em-c-wpt').value) || 60;
    const vol = parseInt($('#em-c-vol').value) || 1;
    const objek = $('#em-c-objek').value.trim();

    if (!label) { msg('Nama template harus diisi!', 'w'); return; }
    if (!detail) { msg('Detail aktifitas harus diisi!', 'w'); return; }

    config.templates.push({ label, detail, satuan, wpt, volume: vol, objekKerja: objek || label });
    saveConfig(config);

    $('#em-c-label').value = '';
    $('#em-c-detail').value = '';
    $('#em-c-satuan').value = '';
    $('#em-c-wpt').value = '60';
    $('#em-c-vol').value = '1';
    $('#em-c-objek').value = '';

    renderTemplates();
    renderSavedList();
    msg(`Template "${label}" ditambahkan!`, 's');
  }

  function msg(text, type) {
    const el = $('#em-status');
    if (!el) return;
    el.className = `em-msg ${type || 'i'}`;
    el.textContent = text;
  }

  // ============================================================
  //  DRAGGABLE
  // ============================================================
  function makeDraggable() {
    const panel = $('#em-panel');
    const hdr = $('#em-hdr');
    let dragging = false, ox, oy;
    hdr.addEventListener('mousedown', (e) => {
      dragging = true;
      ox = e.clientX - panel.getBoundingClientRect().left;
      oy = e.clientY - panel.getBoundingClientRect().top;
      panel.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.left = Math.max(0, e.clientX - ox) + 'px';
      panel.style.top = Math.max(0, e.clientY - oy) + 'px';
      panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      dragging = false;
      panel.style.transition = '';
    });
  }

  // ============================================================
  //  INIT
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel);
  } else {
    buildPanel();
  }
})();
