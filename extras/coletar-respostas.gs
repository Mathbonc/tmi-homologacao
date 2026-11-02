// Google Apps Script que recebe as respostas do site (POST) e as entrega ao painel (GET).
// Planilha Google → Extensões → Apps Script → colar → Implantar como App da Web
// (executar como você; acesso: qualquer pessoa) → copiar a URL /exec para docs/config.js.

function doPost(e) {
  const sh = sheet_();
  if (sh.getLastRow() === 0) sh.appendRow(['quando', 'json']);
  sh.appendRow([new Date(), e.postData.contents]);
  return ContentService.createTextOutput('ok');
}

function doGet() {
  const rows = sheet_().getDataRange().getValues().slice(1).map(r => JSON.parse(r[1]));
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('respostas') || ss.insertSheet('respostas');
}
