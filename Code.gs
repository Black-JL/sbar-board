/* ============================================================
   Mock Board — unified backend (Google Apps Script web app).
   ONE endpoint, routed by `action`, powering all the pages:

     POST {action:'upload'}        -> save PDF to a Drive folder you own
     POST {action:'vote'}          -> append a ballot
     POST {action:'setFinalists'}  -> publish the finalist set
     POST {action:'reset'}         -> clear a round (trash files + rows)
     GET  ?action=list&round=      -> {files:[...]}     (browse + pick + console)
     GET  ?action=finalists&round= -> {finalists:[...]} (vote + results)
     GET  ?action=tally&round=     -> {ballots:[...]}   (results + console)

   Students never log in: the script runs as YOU, so uploads land in YOUR
   Drive and files are shared view-only by link so anyone can read them.

   ── ONE-TIME SETUP (full walkthrough in SETUP.md) ──
   1. https://script.new  (sign in as the account that should OWN the files —
      a personal Gmail is safest; Baylor/.mil may block "Anyone" access).
   2. Delete the stub, paste this whole file, Save.
   3. Run > onceInit  (authorize when asked). Creates the Drive folder +
      spreadsheet and remembers their IDs.
   4. Deploy > New deployment > Web app:
        Execute as: Me     Who has access: Anyone
      Copy the /exec URL.
   5. Paste that URL into CONFIG.endpoint in EVERY page
      (upload, browse, pick, vote, results, console).
   ============================================================ */

var FOLDER_KEY = 'MB_FOLDER_ID';
var SHEET_KEY  = 'MB_SHEET_ID';
var TABS = { uploads: ['ts','round','id','pseudonym','filename','mime','url'],
             ballots: ['ts','round','voter','json'],
             finalists: ['round','json'] };

// ---- one-time: create the Drive folder + spreadsheet ----
function onceInit() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty(FOLDER_KEY)) {
    var folder = DriveApp.createFolder('Mock Board Submissions');
    props.setProperty(FOLDER_KEY, folder.getId());
  }
  if (!props.getProperty(SHEET_KEY)) {
    var ss = SpreadsheetApp.create('Mock Board Data');
    Object.keys(TABS).forEach(function (name) {
      var sh = ss.insertSheet(name);
      sh.appendRow(TABS[name]);
    });
    var def = ss.getSheetByName('Sheet1'); if (def) ss.deleteSheet(def);
    props.setProperty(SHEET_KEY, ss.getId());
  }
  Logger.log('Folder: ' + props.getProperty(FOLDER_KEY));
  Logger.log('Sheet:  ' + props.getProperty(SHEET_KEY));
}

function folder_() { return DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty(FOLDER_KEY)); }
function ss_()     { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(SHEET_KEY)); }
function tab_(n)   { return ss_().getSheetByName(n); }
function json_(o)  { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------------- POST ----------------
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var action = d.action || 'vote';
    if (action === 'upload')       return handleUpload_(d);
    if (action === 'setFinalists') return handleSetFinalists_(d);
    if (action === 'reset')        return handleReset_(d);
    // default: a ballot
    tab_('ballots').appendRow([d.ts || new Date().toISOString(), d.round || '', d.voter || '', JSON.stringify(d)]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function handleUpload_(d) {
  var bytes = Utilities.base64Decode(d.b64);
  var blob = Utilities.newBlob(bytes, d.mime || 'application/pdf', d.filename || 'submission.pdf');
  var safe = (d.pseudonym || 'anon').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 40);
  blob.setName(safe + ' — ' + (d.filename || 'submission.pdf'));
  var file = folder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var id = file.getId();
  var url = 'https://drive.google.com/file/d/' + id + '/preview';
  tab_('uploads').appendRow([d.ts || new Date().toISOString(), d.round || '', id,
                             d.pseudonym || '', d.filename || '', d.mime || '', url]);
  return json_({ ok: true, id: id });
}

function handleSetFinalists_(d) {
  var sh = tab_('finalists'); var rows = sh.getDataRange().getValues(); var round = d.round || '';
  for (var i = rows.length - 1; i >= 1; i--) { if (rows[i][0] === round) sh.deleteRow(i + 1); }
  sh.appendRow([round, JSON.stringify(d.finalists || [])]);
  return json_({ ok: true });
}

function handleReset_(d) {
  var round = d.round || '';
  // trash this round's Drive files
  var up = tab_('uploads'); var rows = up.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][1] === round) {
      try { DriveApp.getFileById(rows[i][2]).setTrashed(true); } catch (e) {}
      up.deleteRow(i + 1);
    }
  }
  // drop ballots + finalists for the round
  [['ballots', 1], ['finalists', 0]].forEach(function (pair) {
    var sh = tab_(pair[0]); var col = pair[1]; var r = sh.getDataRange().getValues();
    for (var j = r.length - 1; j >= 1; j--) { if (r[j][col] === round) sh.deleteRow(j + 1); }
  });
  return json_({ ok: true });
}

// ---------------- GET ----------------
function doGet(e) {
  var action = (e.parameter.action) || '';
  var round = e.parameter.round || '';
  if (action === 'list') {
    var r = tab_('uploads').getDataRange().getValues(); var out = [];
    for (var i = 1; i < r.length; i++) {
      if (round && r[i][1] !== round) continue;
      out.push({ ts: r[i][0], round: r[i][1], id: r[i][2], pseudonym: r[i][3],
                 filename: r[i][4], mime: r[i][5], url: r[i][6] });
    }
    return json_({ files: out });
  }
  if (action === 'finalists') {
    var r2 = tab_('finalists').getDataRange().getValues();
    for (var k = 1; k < r2.length; k++) { if (r2[k][0] === round) return json_({ finalists: JSON.parse(r2[k][1] || '[]') }); }
    return json_({ finalists: [] });
  }
  if (action === 'tally') {
    var r3 = tab_('ballots').getDataRange().getValues(); var byVoter = {};
    for (var m = 1; m < r3.length; m++) {
      if (round && r3[m][1] !== round) continue;
      try { var p = JSON.parse(r3[m][3]); byVoter[p.voter || ('row' + m)] = p; } catch (e) {}
    }
    return json_({ ballots: Object.keys(byVoter).map(function (kk) { return byVoter[kk]; }) });
  }
  return json_({ ok: true, info: 'Mock Board backend is running.' });
}
