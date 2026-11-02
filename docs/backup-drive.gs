/** Company-owned Google Apps Script. No credentials belong in this source.
 * In Script Properties set LUTERA_BACKUP_URL and LUTERA_BACKUP_TOKEN from the
 * owner's downloaded Drive setup file. Run installLuteraBackup once and approve
 * Google Drive / external request access using Lutera's designated account.
 */
const LUTERA_FOLDER = '1M5R-up413YeEzlRudOPObu2f258gkktD';
function copyLuteraBackups() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const url = props.getProperty('LUTERA_BACKUP_URL');
    const token = props.getProperty('LUTERA_BACKUP_TOKEN');
    if (!url || !token || !/^https:\/\/workspace\.luteratech\.com\//.test(url)) throw new Error('Configure the company backup connection in Script Properties.');
    const headers = {Authorization: 'Bearer ' + token};
    const folder = DriveApp.getFolderById(LUTERA_FOLDER);
    if (folder.getOwner().getEmail().toLowerCase() !== 'luteratech2@gmail.com') throw new Error('Use the Lutera company backup folder.');
    for (let n = 0; n < 5; n++) {
      const response = UrlFetchApp.fetch(url, {headers, muteHttpExceptions:true});
      if (response.getResponseCode() === 204) return;
      if (response.getResponseCode() !== 200) throw new Error('Lutera backup listing failed; inspect Operations settings.');
      const entry = JSON.parse(response.getContentText());
      const download = UrlFetchApp.fetch(entry.url, {muteHttpExceptions:true});
      if (download.getResponseCode() !== 200) throw new Error('Encrypted backup download failed.');
      const blob = download.getBlob().setName(entry.name);
      const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, blob.getBytes()).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
      if (hash !== entry.sha256) throw new Error('Backup checksum did not match; no copy was accepted.');
      const matches = folder.getFilesByName(entry.name);
      const file = matches.hasNext() ? matches.next() : folder.createFile(blob);
      // Verify the stored bytes as well, including a pre-existing retry copy.
      const stored = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,file.getBlob().getBytes()).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
      if (stored !== hash) throw new Error('Stored Drive copy failed verification.');
      const receipt = UrlFetchApp.fetch(url, {method:'post',headers,contentType:'application/json',payload:JSON.stringify({id:entry.id,sha256:hash,drive_id:file.getId()}),muteHttpExceptions:true});
      if (receipt.getResponseCode() !== 200) throw new Error('The Drive copy exists but its receipt needs retrying.');
    }
  } finally {lock.releaseLock();}
}
function installLuteraBackup() {
  copyLuteraBackups();
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='copyLuteraBackups').forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('copyLuteraBackups').timeBased().everyDays(1).atHour(9).inTimezone('Africa/Lagos').create();
}
